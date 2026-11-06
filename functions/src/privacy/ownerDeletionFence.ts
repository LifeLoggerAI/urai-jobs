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

/**
 * Transaction-local defense in depth for private Life Movie job admission.
 *
 * The caller-supplied Studio tenant/owner pair is NOT an owner membership
 * assertion. Only the server-read owner document at users/{ownerUid} may
 * establish the binding; a missing legacy projection is NOT a grant.
 *
 * This does not replace Firebase Auth, canonical Privacy C6 approval,
 * source-rights clearance, or the independent render/write hard-off gates.
 */
export function assertLifeMovieOwnerTenantAuthorityClear(
  snapshot: unknown,
  ownerUid: string,
  tenantId: string,
): void {
  const DENIED = 'life_movie_owner_tenant_authority_unavailable';
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  try {
    if (!ID.test(ownerUid) || !ID.test(tenantId) || !snapshot ||
        typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error(DENIED);
    const document = snapshot as { exists?: unknown; data?: () => unknown };
    if (document.exists !== true || typeof document.data !== 'function') throw new Error(DENIED);
    const owner = document.data();
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) throw new Error(DENIED);
    const prototype = Object.getPrototypeOf(owner);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(DENIED);
    const record = owner as Record<string, unknown>;
    const ownValue = (key: string) => {
      const field = Object.getOwnPropertyDescriptor(record, key);
      if (!field || !Object.prototype.hasOwnProperty.call(field, 'value')) throw new Error(DENIED);
      return field.value;
    };
    if (ownValue('uid') !== ownerUid || ownValue('tenantId') !== tenantId ||
        ownValue('accountStatus') !== 'active' || ownValue('deleted') !== false ||
        ownValue('markedForDeletion') !== false) throw new Error(DENIED);
    // An absent legacy disabled flag is not an enablement grant, but if the
    // field is present it must be unambiguously false. Firebase Auth state
    // still needs separate, live checking in the approved owner verifier.
    if (Object.prototype.hasOwnProperty.call(record, 'disabled') &&
        ownValue('disabled') !== false) throw new Error(DENIED);
    if ('disabled' in record && !Object.prototype.hasOwnProperty.call(record, 'disabled')) {
      throw new Error(DENIED);
    }
    // Owner deletion is checked by the original dedicated veto too; repeat
    // it here so future call sites cannot accidentally use tenant binding
    // without the central Privacy deletion fence.
    assertOwnerDeletionFenceClear(snapshot);
  } catch {
    throw new Error(DENIED);
  }
}
