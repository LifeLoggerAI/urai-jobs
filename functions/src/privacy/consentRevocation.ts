import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  canonicalConsentAckHash,
  consentBlockRef,
  consentEventReceiptRef,
} from './consentBlocks.js';

const privacyEventToken = defineSecret('URAI_JOBS_PRIVACY_EVENT_TOKEN');

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
  const db = getFirestore();
  const blockRef = consentBlockRef(event.ownerUid, event.purpose);
  const receiptRef = consentEventReceiptRef(event.eventId);

  const ack = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(receiptRef);
    if (existing.exists) {
      return existing.data();
    }

    const now = FieldValue.serverTimestamp();
    const status = 'blocked';
    const integrityHash = canonicalConsentAckHash({
      eventId: event.eventId,
      ownerUid: event.ownerUid,
      purpose: event.purpose,
      policyVersion: event.policyVersion,
      decisionReceiptId: event.decisionReceiptId,
      status,
    });

    const receipt = {
      consumerId: 'urai-jobs',
      eventId: event.eventId,
      correlationId: event.correlationId,
      ownerUid: event.ownerUid,
      purpose: event.purpose,
      policyVersion: event.policyVersion,
      decisionReceiptId: event.decisionReceiptId,
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
    return receipt;
  });

  response.status(200).json({ ok: true, acknowledgement: ack });
});
