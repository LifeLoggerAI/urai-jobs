import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  canonicalConsentAckHash,
  canonicalSourceRevocationAckHash,
  consentBlockRef,
  consentEventReceiptRef,
} from './consentBlocks.js';
import { invalidateLifeMovieDerivativesForConsent, type LifeMovieRevocationEvent } from './lifeMovieDerivativeRevocation.js';
import { mayApplyNewConsentRevocation } from './consentRevocationOrder.js';
import { PRIVATE_OUTPUT_FENCE_COLLECTION, nextPrivateOutputFence, privateOutputFenceId } from './privateOutputRevocationFence.js';

const privacyEventToken = defineSecret('URAI_JOBS_PRIVACY_EVENT_TOKEN');

const revocationFields = {
  eventId: z.string().trim().min(8).max(160),
  ownerUid: z.string().trim().min(1).max(160),
  purpose: z.string().trim().min(1).max(160),
  policyVersion: z.string().trim().min(1).max(80),
  correlationId: z.string().trim().min(1).max(160),
  revokedAt: z.string().datetime(),
};

const ConsentRevokedEventSchema = z.discriminatedUnion('type', [
  z.object({ ...revocationFields, type: z.literal('consent.revoked.v1'),
    decisionReceiptId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ ...revocationFields, type: z.literal('consent.revoked.v2'), eventId: z.string().regex(/^[0-9a-f]{64}$/),
    ownerUid: z.string().min(1).max(160).refine(value => value === value.trim() && !/[\r\n]/.test(value)),
    purpose: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
    policyVersion: z.string().min(1).max(80).refine(value => value === value.trim() && !/[\r\n]/.test(value)),
    sourceReceiptHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
]).superRefine((value, context) => {
  if (value.type === 'consent.revoked.v2' && value.correlationId !== `revocation:${value.eventId}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['correlationId'], message: 'Invalid revocation correlation.' });
  }
});

function expectedBearer(): string {
  try {
    return privacyEventToken.value() || process.env.URAI_JOBS_PRIVACY_EVENT_TOKEN || '';
  } catch {
    return process.env.URAI_JOBS_PRIVACY_EVENT_TOKEN || '';
  }
}

export const ingestConsentRevocation = onRequest({
  secrets: [privacyEventToken],
  cors: false,
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  const expected = expectedBearer();
  const authorization = String(request.headers.authorization || '');
  const expectedTokenHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  const actualTokenHash = createHash('sha256').update(authorization).digest();
  if (!expected || !timingSafeEqual(expectedTokenHash, actualTokenHash)) {
    response.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const parsed = ConsentRevokedEventSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'invalid-event' });
    return;
  }

  const event = parsed.data;
  const eventId = event.eventId;
  const ownerUid = event.ownerUid;
  const purpose = event.purpose;
  const revokedAt = event.revokedAt;
  if (!eventId || !ownerUid || !purpose || !revokedAt) {
    response.status(400).json({ ok: false, error: 'invalid-event' });
    return;
  }
  const lifeMovieRevocationEvent: LifeMovieRevocationEvent = { eventId, ownerUid, purpose, revokedAt };
  const db = getFirestore();
  const blockRef = consentBlockRef(event.ownerUid, event.purpose);
  const receiptRef = consentEventReceiptRef(event.eventId);
  const outputFenceRef = purpose === 'life-movie.render'
    ? db.collection(PRIVATE_OUTPUT_FENCE_COLLECTION).doc(privateOutputFenceId(ownerUid, purpose))
    : null;
  const expectedHash = event.type === 'consent.revoked.v2'
    ? canonicalSourceRevocationAckHash({
      eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose,
      policyVersion: event.policyVersion, sourceReceiptHash: event.sourceReceiptHash,
      correlationId: event.correlationId, revokedAt: event.revokedAt, status: 'blocked',
    })
    : canonicalConsentAckHash({
      eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose,
      policyVersion: event.policyVersion, decisionReceiptId: event.decisionReceiptId,
      status: 'blocked',
    });
  const referenceMatches = (record: Record<string, unknown>) => event.type === 'consent.revoked.v2'
    ? record.eventType === event.type && record.sourceReceiptHash === event.sourceReceiptHash
      && record.decisionReceiptId === undefined
    : (record.eventType === undefined || record.eventType === event.type)
      && record.decisionReceiptId === event.decisionReceiptId && record.sourceReceiptHash === undefined;

  const outcome = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(receiptRef);
    // Read all authority documents before any transaction write. The fence
    // and consent block therefore serialize under Firestore commit retries.
    const existingBlock = await transaction.get(blockRef);
    const outputFenceSnap = outputFenceRef ? await transaction.get(outputFenceRef) : null;
    if (existing.exists) {
      const receipt = existing.data() ?? {};
      const receiptMatches = receipt.consumerId === 'urai-jobs'
        && receipt.eventId === event.eventId
        && receipt.ownerUid === event.ownerUid
        && receipt.purpose === event.purpose
        && receipt.policyVersion === event.policyVersion
        && referenceMatches(receipt)
        && receipt.correlationId === event.correlationId
        && receipt.status === 'blocked'
        && receipt.integrityHash === expectedHash;
      if (!receiptMatches) return { conflict: true as const };

      // Older receipts did not persist revokedAt. The corresponding active
      // block contains the original timestamp and event binding, so only an
      // exact, still-current replay can safely retry derivative cleanup.
      const block = existingBlock;
      const blockData = block.data() ?? {};
      const blockMatches = block.exists && blockData.active === true
        && blockData.eventId === event.eventId
        && blockData.ownerUid === event.ownerUid
        && blockData.purpose === event.purpose
        && blockData.policyVersion === event.policyVersion
        && referenceMatches(blockData)
        && blockData.correlationId === event.correlationId
        && blockData.revokedAt === event.revokedAt;
      if (!blockMatches || (receipt.revokedAt !== undefined && receipt.revokedAt !== event.revokedAt)) {
        return { conflict: true as const };
      }
      if (outputFenceRef && outputFenceSnap) {
        let transition;
        try {
          transition = nextPrivateOutputFence(outputFenceSnap.data(),
            { eventId, ownerUid, purpose },
            { replay: true, priorBlockExists: block.exists, priorBlock: blockData });
        } catch { return { conflict: true as const }; }
        // Historical receipts predate this epoch. Import as an *unverified*
        // fenced lineage, never a cloud write or deletion acknowledgement.
        if (transition.kind === 'create') {
          transaction.create(outputFenceRef, {
            ...transition.state, createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      return { conflict: false as const, ack: receipt };
    }

    // First delivery of this event is not automatically the latest revocation.
    // Check the existing consent block in the same transaction before writing.
    // A stale or ambiguous order must not alter current enforcement state.
    if (!mayApplyNewConsentRevocation(existingBlock.exists, existingBlock.data(), {
      eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose,
      revokedAt: event.revokedAt,
    })) return { conflict: true as const };

    let outputFenceTransition;
    if (outputFenceRef && outputFenceSnap) {
      try {
        outputFenceTransition = nextPrivateOutputFence(outputFenceSnap.data(),
          { eventId, ownerUid, purpose },
          { replay: false, priorBlockExists: existingBlock.exists,
            priorBlock: existingBlock.data() });
      } catch { return { conflict: true as const }; }
    }
    const now = FieldValue.serverTimestamp();
    const status = 'blocked';
    const receipt = {
      consumerId: 'urai-jobs',
      eventType: event.type,
      eventId: event.eventId,
      correlationId: event.correlationId,
      ownerUid: event.ownerUid,
      purpose: event.purpose,
      policyVersion: event.policyVersion,
      ...(event.type === 'consent.revoked.v2'
        ? { sourceReceiptHash: event.sourceReceiptHash }
        : { decisionReceiptId: event.decisionReceiptId }),
      revokedAt: event.revokedAt,
      status,
      integrityHash: expectedHash,
      receivedAt: now,
    };

    transaction.set(blockRef, {
      active: true,
      ...receipt,
      // A prior event may have used the other receipt version. Remove its
      // reference so a later exact replay is checked against only this event.
      ...(event.type === 'consent.revoked.v2'
        ? { decisionReceiptId: FieldValue.delete() }
        : { sourceReceiptHash: FieldValue.delete() }),
      revokedAt: event.revokedAt,
      updatedAt: now,
    }, { merge: true });
    transaction.create(receiptRef, receipt);
    if (outputFenceRef && outputFenceTransition) {
      if (outputFenceTransition.kind === 'create') {
        transaction.create(outputFenceRef, {
          ...outputFenceTransition.state, createdAt: now, updatedAt: now,
        });
      } else if (outputFenceTransition.kind === 'update') {
        transaction.update(outputFenceRef, { ...outputFenceTransition.state, updatedAt: now });
      }
    }
    return { conflict: false as const, ack: receipt };
  });

  if (outcome.conflict) {
    response.status(409).json({ ok: false, error: 'revocation-event-conflict' });
    return;
  }
  const ack = outcome.ack;
  // Generation fences are internal recovery state, not part of the
  // acknowledgement contract; especially on retries they may be large.
  // The authenticated receipt only acknowledges the consent BLOCK. A
  // point-in-time derivative sweep cannot prove no former privileged Storage
  // writer can finalize a late upload. Never replay historical "completed"
  // fields or let an ordinary HTTP 200 imply a physical deletion ACK.
  const responseAck: Record<string, unknown> = {
    ...ack,
    privateOutputDeletionAcknowledged: false,
    storageWriteFenceVerified: false,
    derivativeInvalidationStatus: 'STORAGE_WRITE_FENCE_UNVERIFIED',
  };
  delete responseAck.storageGenerationFences;
  delete responseAck.derivativeInvalidationCompletedAt;
  delete responseAck.derivativeInvalidation;
  delete responseAck.derivativeInvalidationAttemptedAt;

  try {
    // Re-run derivative invalidation even for a replayed event receipt. The consent
    // block is already fail-closed, while repeated propagation makes cleanup
    // retryable after transient Storage or Firestore failures.
    const derivativeInvalidation = await invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent);
    // Preserve useful point-in-time cleanup counts, but explicitly do not
    // certify physical private output deletion while old direct GCS writers
    // and in-flight streams have no independently verified storage fence.
    // Delete legacy completion timestamps during exact authenticated retries.
    await receiptRef.set({
      derivativeInvalidation,
      derivativeInvalidationAttemptedAt: FieldValue.serverTimestamp(),
      derivativeInvalidationCompletedAt: FieldValue.delete(),
      derivativeInvalidationStatus: 'STORAGE_WRITE_FENCE_UNVERIFIED',
      privateOutputDeletionAcknowledged: false,
      storageWriteFenceVerified: false,
    }, { merge: true });
    response.status(200).json({
      ok: true,
      acknowledgement: {
        ...responseAck,
        derivativeInvalidation,
      },
    });
  } catch (error) {
    // Storage and Firestore errors may contain private object paths or other
    // request details. Log only known local error codes, never raw exceptions.
    const knownCleanupErrors = new Set([
      'life_movie_revocation_output_ref_invalid', 'life_movie_revocation_output_boundary_mismatch',
      'life_movie_revocation_job_changed', 'life_movie_revocation_plan_changed',
      'life_movie_revocation_output_changed', 'life_movie_revocation_inflight_unresolved',
      'life_movie_revocation_output_generation_invalid', 'life_movie_revocation_output_generation_changed',
      'life_movie_revocation_receipt_invalid',
    ]);
    const message = error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message : undefined;
    console.error('Consent revocation derivative invalidation failed', {
      eventId: event.eventId,
      ownerUid: event.ownerUid,
      purpose: event.purpose,
      errorCode: typeof message === 'string' && knownCleanupErrors.has(message) ? message : 'storage_or_firestore_failure',
    });
    response.status(500).json({
      ok: false,
      error: 'derivative-invalidation-failed',
      acknowledgement: responseAck,
    });
  }
});
