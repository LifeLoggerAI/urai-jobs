import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';

export const CONSENT_BLOCKS_COLLECTION = 'jobConsentBlocks';
export const CONSENT_EVENT_RECEIPTS_COLLECTION = 'jobConsentEventReceipts';

export type JobConsentContext = {
  purpose: string;
  policyVersion: string;
  decisionReceiptId: string;
};

export function consentBlockId(ownerUid: string, purpose: string): string {
  return createHash('sha256').update(ownerUid + '\n' + purpose).digest('hex');
}

export function consentBlockRef(ownerUid: string, purpose: string) {
  return getFirestore().collection(CONSENT_BLOCKS_COLLECTION).doc(consentBlockId(ownerUid, purpose));
}

export function consentEventReceiptRef(eventId: string) {
  const id = createHash('sha256').update(eventId).digest('hex');
  return getFirestore().collection(CONSENT_EVENT_RECEIPTS_COLLECTION).doc(id);
}

export function canonicalConsentAckHash(input: {
  eventId: string;
  ownerUid: string;
  purpose: string;
  policyVersion: string;
  decisionReceiptId: string;
  status: string;
}): string {
  return createHash('sha256')
    .update([
      input.eventId,
      input.ownerUid,
      input.purpose,
      input.policyVersion,
      input.decisionReceiptId,
      input.status,
    ].join('\n'))
    .digest('hex');
}

/** Versioned acknowledgement for a revocation receipt, not a consent decision. */
export function canonicalSourceRevocationAckHash(input: {
  eventId: string;
  ownerUid: string;
  purpose: string;
  policyVersion: string;
  sourceReceiptHash: string;
  correlationId: string;
  revokedAt: string;
  status: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      type: 'consent.revoked.v2',
      eventId: input.eventId,
      ownerUid: input.ownerUid,
      purpose: input.purpose,
      policyVersion: input.policyVersion,
      sourceReceiptHash: input.sourceReceiptHash,
      correlationId: input.correlationId,
      revokedAt: input.revokedAt,
      status: input.status,
    }))
    .digest('hex');
}

export function isConsentContext(value: unknown): value is JobConsentContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.purpose === 'string'
    && record.purpose.length > 0
    && typeof record.policyVersion === 'string'
    && record.policyVersion.length > 0
    && typeof record.decisionReceiptId === 'string'
    && record.decisionReceiptId.length > 0;
}
