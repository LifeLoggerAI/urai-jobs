import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { canonicalConsentAckHash, consentBlockRef, consentEventReceiptRef } from './consentBlocks.js';
import { invalidateLifeMovieDerivativesForConsent, type LifeMovieRevocationEvent } from './lifeMovieDerivativeRevocation.js';
import { invalidateCapturedRealityDerivativesForConsent } from './capturedRealityDerivativeRevocation.js';
import { invalidatePrivateLifeModelForConsent } from './privateLifeModelDataRights.js';

const privacyEventToken = defineSecret('URAI_JOBS_PRIVACY_EVENT_TOKEN');
const EVENT_BINDING_VERSION = 'urai-jobs-consent-event-binding-v1';

const ConsentRevokedEventSchema = z.object({
  type: z.literal('consent.revoked.v1'),
  eventId: z.string().trim().min(8).max(160),
  ownerUid: z.string().trim().min(1).max(160),
  purpose: z.string().trim().min(1).max(160),
  policyVersion: z.string().trim().min(1).max(80),
  decisionReceiptId: z.string().trim().min(1).max(160),
  correlationId: z.string().trim().min(1).max(160),
  revokedAt: z.string().datetime(),
}).strict();

type ConsentRevokedEvent = z.infer<typeof ConsentRevokedEventSchema>;
class ConsentEventConflict extends Error {}

function eventBindingHash(event: ConsentRevokedEvent) {
  return createHash('sha256').update(JSON.stringify({
    type: event.type, eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose,
    policyVersion: event.policyVersion, decisionReceiptId: event.decisionReceiptId,
    correlationId: event.correlationId, revokedAt: event.revokedAt,
  })).digest('hex');
}

function assertBoundReceipt(record: any, event: ConsentRevokedEvent) {
  if (!record || record.consumerId !== 'urai-jobs' || record.status !== 'blocked'
    || record.eventBindingVersion !== EVENT_BINDING_VERSION || record.eventBindingHash !== eventBindingHash(event)
    || ['eventId', 'ownerUid', 'purpose', 'policyVersion', 'decisionReceiptId', 'correlationId', 'revokedAt']
      .some(key => record[key] !== event[key as keyof ConsentRevokedEvent])
    || record.integrityHash !== canonicalConsentAckHash(record)) {
    throw new ConsentEventConflict('event-id-conflict');
  }
}

function assertCurrentBlock(record: any, event: ConsentRevokedEvent) {
  // A newer revocation may supersede this event for the same owner/purpose.
  // A replay never overwrites it or recreates an inactive canonical block.
  if (!record || record.active !== true || record.consumerId !== 'urai-jobs' || record.status !== 'blocked'
    || record.ownerUid !== event.ownerUid || record.purpose !== event.purpose
    || record.integrityHash !== canonicalConsentAckHash(record)) {
    throw new ConsentEventConflict('consent-authority-not-current');
  }
}

function acknowledgement(record: any) {
  return {
    consumerId: record.consumerId, eventId: record.eventId, correlationId: record.correlationId,
    ownerUid: record.ownerUid, purpose: record.purpose, policyVersion: record.policyVersion,
    decisionReceiptId: record.decisionReceiptId, revokedAt: record.revokedAt,
    status: record.status, integrityHash: record.integrityHash,
    eventBindingVersion: record.eventBindingVersion, eventBindingHash: record.eventBindingHash,
    receivedAt: record.receivedAt,
  };
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
  const actualBytes = Buffer.from(String(request.headers.authorization || ''));
  const expectedBytes = Buffer.from('Bearer ' + expected);
  if (!expected || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    response.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  const parsed = ConsentRevokedEventSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'invalid-event' });
    return;
  }
  const event = parsed.data;
  const { eventId, ownerUid, purpose, revokedAt } = event;
  const lifeMovieRevocationEvent: LifeMovieRevocationEvent = { eventId, ownerUid, purpose, revokedAt };
  const db = getFirestore();
  const blockRef = consentBlockRef(event.ownerUid, event.purpose);
  const receiptRef = consentEventReceiptRef(event.eventId);
  let admittedAck: ReturnType<typeof acknowledgement> | undefined;

  try {
    const ack = await db.runTransaction(async (transaction) => {
      const [existing, currentBlock] = await Promise.all([transaction.get(receiptRef), transaction.get(blockRef)]);
      if (existing.exists) {
        assertBoundReceipt(existing.data(), event);
        assertCurrentBlock(currentBlock.data(), event);
        return acknowledgement(existing.data());
      }
      if (currentBlock.exists && (currentBlock.data()?.ownerUid !== event.ownerUid || currentBlock.data()?.purpose !== event.purpose)) {
        throw new ConsentEventConflict('consent-authority-not-current');
      }
      const now = FieldValue.serverTimestamp();
      const status = 'blocked';
      const integrityHash = canonicalConsentAckHash({
        eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose,
        policyVersion: event.policyVersion, decisionReceiptId: event.decisionReceiptId, status,
      });
      const receipt = {
        consumerId: 'urai-jobs', eventId: event.eventId, correlationId: event.correlationId,
        ownerUid: event.ownerUid, purpose: event.purpose, policyVersion: event.policyVersion,
        decisionReceiptId: event.decisionReceiptId, status, integrityHash,
        revokedAt: event.revokedAt, eventBindingVersion: EVENT_BINDING_VERSION,
        eventBindingHash: eventBindingHash(event), receivedAt: now,
      };
      transaction.set(blockRef, { active: true, ...receipt, updatedAt: now }, { merge: true });
      transaction.create(receiptRef, receipt);
      return acknowledgement(receipt);
    });
    admittedAck = ack;
    const currentAuthority = async (transaction: any) => {
      const [receipt, block] = await Promise.all([transaction.get(receiptRef), transaction.get(blockRef)]);
      assertBoundReceipt(receipt.data(), event);
      assertCurrentBlock(block.data(), event);
    };
    const checkpoint = async () => { await db.runTransaction(currentAuthority); };

    // Exact replays retry derivative cleanup after transient failures, while
    // current canonical block/receipt authority is checked between each phase.
    await checkpoint();
    const derivativeInvalidation = await invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent);
    await checkpoint();
    const capturedRealityInvalidation = await invalidateCapturedRealityDerivativesForConsent(lifeMovieRevocationEvent);
    await checkpoint();
    const privateLifeModelInvalidation = await invalidatePrivateLifeModelForConsent(lifeMovieRevocationEvent);
    await db.runTransaction(async transaction => {
      await currentAuthority(transaction);
      transaction.set(receiptRef, {
        derivativeInvalidation, capturedRealityInvalidation, privateLifeModelInvalidation,
        derivativeInvalidationCompletedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    response.status(200).json({
      ok: true,
      acknowledgement: { ...ack, derivativeInvalidation, capturedRealityInvalidation, privateLifeModelInvalidation },
    });
  } catch (error) {
    if (error instanceof ConsentEventConflict) {
      response.status(409).json({ ok: false, error: error.message });
      return;
    }
    // Storage/database exceptions can contain owner IDs, source paths and payloads.
    console.error('Consent revocation failed', {
      eventBindingHash: eventBindingHash(event), stage: admittedAck ? 'derivative-invalidation' : 'admission',
    });
    response.status(500).json({
      ok: false,
      error: admittedAck ? 'derivative-invalidation-failed' : 'consent-admission-failed',
      ...(admittedAck ? { acknowledgement: admittedAck } : {}),
    });
  }
});
