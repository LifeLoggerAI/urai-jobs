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
  for (const flag of ['disabled', 'deleted', 'markedForDeletion']) {
    if (Object.prototype.hasOwnProperty.call(user, flag) && user[flag] !== false) return null;
  }
  if (Object.prototype.hasOwnProperty.call(user, 'dataRightsDeletionPendingCentralPrivacy')
    && user.dataRightsDeletionPendingCentralPrivacy !== false) return null;
  if (user.accountStatus !== undefined && user.accountStatus !== 'active') return null;
  return Object.freeze({ uid, operator: role === 'admin' || role === 'operator' });
}
