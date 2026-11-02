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

export type JobConsentBlockState = 'clear' | 'revoked' | 'unverified';

/** A missing Firestore document is clear. An existing block must own a
 * literal boolean active field; malformed or unreadable evidence denies. */
export function checkedJobConsentBlockState(snapshot: unknown): JobConsentBlockState {
  try {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'unverified';
    const recordSnapshot = snapshot as { exists?: unknown; data?: () => unknown };
    if (recordSnapshot.exists === false) return 'clear';
    if (recordSnapshot.exists !== true || typeof recordSnapshot.data !== 'function') return 'unverified';
    const record = recordSnapshot.data();
    if (!record || typeof record !== 'object' || Array.isArray(record)) return 'unverified';
    const active = Object.getOwnPropertyDescriptor(record, 'active');
    if (!active || !Object.prototype.hasOwnProperty.call(active, 'value') ||
        typeof active.value !== 'boolean') return 'unverified';
    return active.value ? 'revoked' : 'clear';
  } catch {
    return 'unverified';
  }
}

/** Shared preflight; this is a revocation veto, never a positive grant. */
export function assertJobConsentBlockClear(snapshot: unknown, revokedCode: string): void {
  const state = checkedJobConsentBlockState(snapshot);
  if (state !== 'clear') {
    throw new Error(state === 'revoked' ? revokedCode : 'life_movie_consent_block_unverified');
  }
}
