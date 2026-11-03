/**
 * Authoritative Jobs owner-deletion veto shared by every job-producing bridge.
 * An absent legacy field is allowed; any explicit pending or malformed field
 * prevents creating or re-queuing private work until central reconciliation.
 * Must be called on a Firestore snapshot read IN the creating transaction.
 */
export type OwnerDeletionFenceState = 'clear' | 'pending' | 'unverified';

export function ownerDeletionFenceState(snapshot: unknown): OwnerDeletionFenceState {
  try {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'unverified';
    const record = snapshot as { exists?: unknown; data?: () => unknown };
    if (record.exists !== true || typeof record.data !== 'function') return 'unverified';
    const owner = record.data();
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return 'unverified';
    const field = Object.getOwnPropertyDescriptor(owner, 'dataRightsDeletionPendingCentralPrivacy');
    if (!field) return 'dataRightsDeletionPendingCentralPrivacy' in owner ? 'unverified' : 'clear';
    if (!Object.prototype.hasOwnProperty.call(field, 'value')) return 'unverified';
    return field.value === false ? 'clear'
      : field.value === true ? 'pending' : 'unverified';
  } catch {
    return 'unverified';
  }
}

export function assertOwnerDeletionFenceClear(snapshot: unknown): void {
  const state = ownerDeletionFenceState(snapshot);
  if (state !== 'clear') {
    throw new Error(state === 'pending'
      ? 'owner_data_rights_deletion_pending'
      : 'owner_data_rights_authority_unavailable');
  }
}
