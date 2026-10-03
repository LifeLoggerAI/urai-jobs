import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { Job } from '@urai-jobs/shared-types';

export const consentRevocationSecret = defineSecret('URAI_JOBS_CONSENT_REVOCATION_SECRET');

export const ConsentRevocationEventSchema = z.object({
  schemaVersion: z.literal('consent.revoked.v1'),
  eventId: z.string().regex(/^[0-9a-f]{64}$/),
  uid: z.string().min(1).max(200),
  purpose: z.string().min(1).max(160),
  policyVersion: z.string().min(1).max(160),
  sourceReceiptHash: z.string().regex(/^[0-9a-f]{64}$/),
  integrityHash: z.string().regex(/^[0-9a-f]{64}$/),
  correlationId: z.string().min(8).max(160).optional(),
  revokedAt: z.string().datetime().optional(),
});

export type ConsentRevocationEvent = z.infer<typeof ConsentRevocationEventSchema>;

export function consentBlockId(uid: string, purpose: string): string {
  return createHash('sha256').update(uid + '\0' + purpose).digest('hex');
}

export function consentContextFromJob(job: Job) {
  const context = job.consent;
  if (!context || context.decision !== 'granted' || !context.purpose || !context.policyVersion || !context.decisionReceiptId) {
    return null;
  }
  return context;
}

export async function isConsentBlocked(
  job: Job,
  transaction?: import('firebase-admin/firestore').Transaction,
): Promise<boolean> {
  const db = getFirestore();
  const context = consentContextFromJob(job);
  if (!context || !job.ownerUid) return true;
  const ref = db.collection('consentRevocationBlocks').doc(consentBlockId(job.ownerUid, context.purpose));
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  return snapshot.exists;
}

function canonicalEventForIntegrity(event: ConsentRevocationEvent) {
  return {
    schemaVersion: event.schemaVersion,
    eventId: event.eventId,
    uid: event.uid,
    purpose: event.purpose,
    policyVersion: event.policyVersion,
    sourceReceiptHash: event.sourceReceiptHash,
  };
}

function verifyIntegrity(event: ConsentRevocationEvent): boolean {
  const expected = createHash('sha256').update(JSON.stringify(canonicalEventForIntegrity(event))).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(event.integrityHash));
  } catch {
    return false;
  }
}

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = consentRevocationSecret.value() || process.env.URAI_JOBS_CONSENT_REVOCATION_SECRET || '';
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace(/^sha256=/, '')));
  } catch {
    return false;
  }
}

export const ingestConsentRevocation = onRequest(
  { region: 'us-central1', secrets: [consentRevocationSecret], cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const rawBody = typeof request.rawBody?.toString === 'function'
      ? request.rawBody.toString('utf8')
      : JSON.stringify(request.body ?? {});
    if (!verifySignature(rawBody, String(request.header('x-urai-consent-signature') || ''))) {
      response.status(401).json({ ok: false, error: 'invalid_signature' });
      return;
    }

    const parsed = ConsentRevocationEventSchema.safeParse(request.body ?? {});
    if (!parsed.success || !verifyIntegrity(parsed.data)) {
      response.status(400).json({ ok: false, error: 'invalid_event' });
      return;
    }

    const event = parsed.data;
    const db = getFirestore();
    const eventRef = db.collection('consentRevocationEvents').doc(event.eventId);
    const blockRef = db.collection('consentRevocationBlocks').doc(consentBlockId(event.uid, event.purpose));

    const result = await db.runTransaction(async (transaction) => {
      const [existing, block] = await Promise.all([transaction.get(eventRef), transaction.get(blockRef)]);
      if (!existing.exists) {
        transaction.create(eventRef, {
          ...event,
          status: 'applied',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (!block.exists) {
        transaction.create(blockRef, {
          uid: event.uid,
          purpose: event.purpose,
          policyVersion: event.policyVersion,
          eventId: event.eventId,
          sourceReceiptHash: event.sourceReceiptHash,
          revokedAt: event.revokedAt ? new Date(event.revokedAt) : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          integrityHash: createHash('sha256').update(JSON.stringify(canonicalEventForIntegrity(event))).digest('hex'),
        });
      }
      return { idempotent: existing.exists };
    });

    response.status(result.idempotent ? 200 : 201).json({
      ok: true,
      schemaVersion: event.schemaVersion,
      eventId: event.eventId,
      uid: event.uid,
      purpose: event.purpose,
      status: 'applied',
      idempotent: result.idempotent,
      consumerId: 'urai-jobs',
      correlationId: event.correlationId ?? event.eventId,
    });
  },
);

export function assertConsentContext(job: Job): void {
  if (!job.ownerUid || !consentContextFromJob(job)) {
    throw new Error('User-scoped provider jobs require a granted canonical consent context.');
  }
}
