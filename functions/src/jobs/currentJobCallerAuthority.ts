/**
 * Current Firestore user state is the authority for Jobs callable operations.
 * Firebase ID-token role/custom claims can remain valid after a role change;
 * they identify the caller but must not grant a stale operator override.
 * This pure check does not read Firestore: callers must obtain the user record
 * from the same Firestore transaction as the protected job or job query.
 */
export type CurrentJobCaller = Readonly<{ uid: string; operator: boolean }>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function checkedCurrentJobCaller(auth: unknown, serverUser: unknown): CurrentJobCaller | null {
  const caller = record(auth);
  const user = record(serverUser);
  const uid = caller?.uid;
  if (typeof uid !== 'string' || !uid.trim() || uid !== uid.trim() || !user) return null;
  if (user.uid !== undefined && user.uid !== uid) return null;
  const role = user.role;
  if (role !== 'admin' && role !== 'operator' && role !== 'user') return null;
  // Malformed scope data cannot silently become unscoped access (including operators).
  if (scopeId(user, 'tenantId') === INVALID_SCOPE || scopeId(user, 'orgId') === INVALID_SCOPE) return null;
  for (const flag of ['disabled', 'deleted', 'markedForDeletion']) {
    if (Object.prototype.hasOwnProperty.call(user, flag) && user[flag] !== false) return null;
  }
  if (Object.prototype.hasOwnProperty.call(user, 'dataRightsDeletionPendingCentralPrivacy')
    && user.dataRightsDeletionPendingCentralPrivacy !== false) return null;
  if (user.accountStatus !== undefined && user.accountStatus !== 'active') return null;
  return Object.freeze({ uid, operator: role === 'admin' || role === 'operator' });
}


/** Normalized organization/tenant scope for Jobs-created records. */
const INVALID_SCOPE = Symbol('malformed-job-owner-scope');

function scopeId(value: Record<string, unknown> | null, key: 'orgId' | 'tenantId'): string | null | typeof INVALID_SCOPE {
  const raw = value?.[key];
  // Historical records can omit scope, store null or have a blank string.
  // A non-string object/number/boolean, however, is not a legacy missing scope.
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return INVALID_SCOPE;
  return raw.trim() || null;
}

function sameScope(left: Record<string, unknown>, right: Record<string, unknown>, key: 'orgId' | 'tenantId'): boolean {
  const a = scopeId(left, key), b = scopeId(right, key);
  return a !== INVALID_SCOPE && b !== INVALID_SCOPE && a === b;
}

/**
 * A handler may have read its user at callable entry, then waited on validation
 * and rate-limit reads before beginning a Firestore write transaction.
 * Reject if the server moved that user between tenants/orgs in that window.
 */
export function sameCurrentJobOwnerScope(initialUser: unknown, currentUser: unknown): boolean {
  const initial = record(initialUser), current = record(currentUser);
  return !!initial && !!current
    && sameScope(initial, current, 'tenantId')
    && sameScope(initial, current, 'orgId');
}

/**
 * Idempotency binding identity alone (ownerUid + job type + key) does not bind
 * the historical job to the owner's CURRENT tenant/org after a transfer.
 * Check the referenced original job inside the same read transaction.
 */
export function boundJobMatchesCurrentOwnerScope(
  job: unknown, currentUser: unknown, ownerUid: string,
): boolean {
  const data = record(job), owner = record(currentUser);
  return !!data && !!owner && typeof ownerUid === 'string' && ownerUid.length > 0
    && data.ownerUid === ownerUid
    && sameScope(data, owner, 'tenantId')
    && sameScope(data, owner, 'orgId');
}

/**
 * Administrative retry must not restart work for deleted, suspended or
 * transferred owners. Verify the actual owner record in the same transaction
 * as the failed job; the operator's current authority alone is insufficient.
 */
export function currentJobOwnerEligibleForRetry(job: unknown, serverOwner: unknown): boolean {
  const data = record(job);
  const ownerUid = data?.ownerUid;
  if (typeof ownerUid !== 'string' || !ownerUid.trim() || ownerUid !== ownerUid.trim()) return false;
  const owner = checkedCurrentJobCaller({uid: ownerUid}, serverOwner);
  return !!owner && boundJobMatchesCurrentOwnerScope(data, serverOwner, ownerUid);
}

/**
 * A generic admin retry cannot prove a new positive consent/source decision,
 * protected-output writer authority, or provider-side delivery idempotency.
 * These jobs must use their dedicated authorized dispatch/admission surface.
 */
export function genericAdminRetryAllowed(job: unknown): boolean {
  const data = record(job);
  if (!data || data.consent !== undefined || data.consents !== undefined ||
      data.sourceSystem === 'urai-studio') return false;
  const declared = [data.jobType, data.type].filter(value => value !== undefined);
  if (!declared.length || declared.some(value => typeof value !== 'string' || value.trim() !== value || !value)) return false;
  if (declared.some(value => value !== declared[0])) return false;
  const type = declared[0] as string;
  if (type.startsWith('memory.private-source.') || type.startsWith('studio.') ||
      type === 'narrator.tts' || type === 'web.agent' ||
      type === 'communications.message.send' || type === 'asset.render' ||
      type === 'asset-render') return false;
  // Do not permit a malformed/unknown job type to evade the privacy veto.
  return type === 'web.search' || type === 'web.fetch';
}
