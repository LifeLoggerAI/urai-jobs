import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  canonicalConsentAckHash,
  consentBlockRef,
  consentEventReceiptRef,
} from './consentBlocks.js';
import { invalidateLifeMovieDerivativesForConsent, type LifeMovieRevocationEvent } from './lifeMovieDerivativeRevocation.js';

const privacyEventToken = defineSecret('URAI_JOBS_PRIVACY_EVENT_TOKEN');

const LegacyConsentRevokedEventSchema = z.object({
  type: z.literal('consent.revoked.v1'),
  eventId: z.string().trim().min(8).max(160),
  ownerUid: z.string().trim().min(1).max(160),
  purpose: z.string().trim().min(1).max(160),
  policyVersion: z.string().trim().min(1).max(80),
  decisionReceiptId: z.string().trim().min(1).max(160),
  correlationId: z.string().trim().min(1).max(160),
  revokedAt: z.string().datetime(),
}).strict();
export const NativeConsentRevokedEventSchema = z.object({
  type: z.literal('consent.revoked.v2'),
  schemaVersion: z.literal('consent.revoked.v1'),
  eventId: z.string().regex(/^[0-9a-f]{64}$/),
  consentRecordId: z.string().trim().min(1).max(160),
  uid: z.string().trim().min(1).max(160),
  purpose: z.string().trim().min(1).max(160),
  consentTier: z.string().trim().min(1).max(160),
  policyVersion: z.string().trim().min(1).max(80),
  sourceReceiptHash: z.string().regex(/^[0-9a-f]{64}$/),
  priorGrantReceiptHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  priorGrantEvidenceState: z.enum(['present', 'missing_or_invalid', 'not_applicable']),
  integrityHash: z.string().regex(/^[0-9a-f]{64}$/),
  correlationId: z.string().regex(/^[0-9a-f]{64}$/),
  revokedAt: z.string().datetime(),
}).strict();
export const ConsentRevokedEventSchema = z.discriminatedUnion('type', [LegacyConsentRevokedEventSchema, NativeConsentRevokedEventSchema]);
function sha(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function verifyNativeLineage(event: z.infer<typeof NativeConsentRevokedEventSchema>): boolean {
  const eventId = sha({
    schemaVersion: event.schemaVersion, recordId: event.consentRecordId,
    uid: event.uid, purpose: event.purpose, consentTier: event.consentTier,
    policyVersion: event.policyVersion, receiptHash: event.sourceReceiptHash,
  });
  const evidenceConsistent = event.priorGrantEvidenceState === 'present'
    ? event.priorGrantReceiptHash !== null
    : event.priorGrantReceiptHash === null;
  return evidenceConsistent && event.eventId === eventId && event.correlationId === eventId
    && event.integrityHash === sha({
      eventId, recordId: event.consentRecordId, uid: event.uid, purpose: event.purpose,
      priorGrantReceiptHash: event.priorGrantReceiptHash,
      priorGrantEvidenceState: event.priorGrantEvidenceState,
    });
}

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
  if (!expected || authorization !== `Bearer ${expected}`) {
    response.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const parsed = ConsentRevokedEventSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'invalid-event' });
    return;
  }

  const event = parsed.data;
  if (event.type === 'consent.revoked.v2' && !verifyNativeLineage(event)) {
    response.status(400).json({ ok: false, error: 'invalid-lineage' });
    return;
  }
  const eventId = event.eventId;
  const ownerUid = event.type === 'consent.revoked.v2' ? event.uid : event.ownerUid;
  const decisionReceiptId = event.type === 'consent.revoked.v2' ? event.sourceReceiptHash : event.decisionReceiptId;
  const purpose = event.purpose;
  const revokedAt = event.revokedAt;
  if (!eventId || !ownerUid || !purpose || !revokedAt) {
    response.status(400).json({ ok: false, error: 'invalid-event' });
    return;
  }
  const lifeMovieRevocationEvent: LifeMovieRevocationEvent = { eventId, ownerUid, purpose, revokedAt };
  const db = getFirestore();
  const blockRef = consentBlockRef(ownerUid, event.purpose);
  const receiptRef = consentEventReceiptRef(event.eventId);

  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(receiptRef);
    const existingBlock = await transaction.get(blockRef);
    if (event.type === 'consent.revoked.v1' && existingBlock.data()?.schemaVersion === 'consent.revoked.v2') {
      return { conflict: 'v2-enforced', ack: null };
    }
    if (existing.exists) {
      const prior = existing.data() ?? {};
      if (prior.eventId !== eventId || prior.ownerUid !== ownerUid
        || prior.purpose !== purpose || prior.policyVersion !== event.policyVersion
        || prior.decisionReceiptId !== decisionReceiptId
        || prior.correlationId !== event.correlationId
        || (event.type === 'consent.revoked.v2' && prior.revokedAt !== event.revokedAt)
        || prior.schemaVersion !== event.type
        || (event.type === 'consent.revoked.v2'
          && (prior.sourceReceiptHash !== event.sourceReceiptHash
            || prior.priorGrantReceiptHash !== event.priorGrantReceiptHash
            || prior.priorGrantEvidenceState !== event.priorGrantEvidenceState))) {
        return { conflict: 'event-id-collision', ack: null };
      }
      transaction.set(blockRef, { active: true, ...prior, schemaVersion: event.type, revokedAt: event.revokedAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { conflict: null, ack: prior };
    }

    const now = FieldValue.serverTimestamp();
    const status = 'blocked';
    const integrityHash = canonicalConsentAckHash({
      eventId: event.eventId,
      ownerUid,
      purpose: event.purpose,
      policyVersion: event.policyVersion,
      decisionReceiptId: decisionReceiptId,
      status,
    });

    const receipt = {
      consumerId: 'urai-jobs',
      eventId: event.eventId,
      correlationId: event.correlationId,
      ownerUid,
      purpose: event.purpose,
      policyVersion: event.policyVersion,
      decisionReceiptId: decisionReceiptId,
      schemaVersion: event.type,
      revokedAt: event.revokedAt,
      ...(event.type === 'consent.revoked.v2'
        ? {
          sourceReceiptHash: event.sourceReceiptHash,
          consentRecordId: event.consentRecordId,
          priorGrantReceiptHash: event.priorGrantReceiptHash,
          priorGrantEvidenceState: event.priorGrantEvidenceState,
        }
        : {}),
      status,
      integrityHash,
      receivedAt: now,
    };

    transaction.set(blockRef, {
      active: true,
      ...receipt,
      revokedAt: event.revokedAt,
      updatedAt: now,
    }, { merge: true });
    transaction.create(receiptRef, receipt);
    return { conflict: null, ack: receipt };
  });
  if (result.conflict) {
    response.status(409).json({ ok: false, error: result.conflict });
    return;
  }
  const ack = result.ack;

  try {
    // Re-run derivative invalidation even for a replayed event receipt. The consent
    // block is already fail-closed, while repeated propagation makes cleanup
    // retryable after transient Storage or Firestore failures.
    const derivativeInvalidation = await invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent);
    await receiptRef.set({
      derivativeInvalidation,
      derivativeInvalidationCompletedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    response.status(200).json({
      ok: true,
      acknowledgement: {
        ...ack,
        derivativeInvalidation,
      },
    });
  } catch (error) {
    console.error('Consent revocation derivative invalidation failed', {
      eventId: event.eventId,
      ownerUid,
      purpose: event.purpose,
      error,
    });
    response.status(500).json({
      ok: false,
      error: 'derivative-invalidation-failed',
      acknowledgement: ack,
    });
  }
});
