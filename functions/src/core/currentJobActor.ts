import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { User } from '@urai-jobs/shared-types';

type JobActorRequest = {
  auth?: { uid: string };
  rawRequest?: { headers?: { authorization?: unknown } };
};

export type CurrentJobActor = { uid: string; operator: boolean; profile: User };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function operatorClaim(value: unknown): boolean {
  const claims = asRecord(value);
  return claims.role === 'admin' || claims.role === 'operator' || claims.uraiJobsAdmin === true
    || (Array.isArray(claims.roles) && (claims.roles.includes('admin') || claims.roles.includes('operator')));
}

/**
 * Use the supplied Firebase bearer with revocation checking, current live Auth
 * and the existing protected profile. Auth is a separate service: callers
 * re-read at their final decision, without claiming an Auth/Firestore atomicity.
 */
export async function currentJobActor(request: JobActorRequest, transaction?: Transaction): Promise<CurrentJobActor> {
  const uid = request.auth?.uid;
  const header = request.rawRequest?.headers?.authorization;
  const match = typeof header === 'string' ? /^Bearer ([^\s]+)$/.exec(header) : null;
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || !match) {
    throw new HttpsError('unauthenticated', 'Current Firebase authentication is required.');
  }

  let decoded: DecodedIdToken;
  let live: UserRecord;
  try {
    decoded = await getAuth().verifyIdToken(match[1], true);
    live = await getAuth().getUser(uid);
    if (decoded.uid !== uid || live.uid !== uid || live.disabled !== false) throw new Error('inactive-account');
  } catch {
    throw new HttpsError('unauthenticated', 'Current Firebase authentication is unavailable or inactive.');
  }

  const profileRef = getFirestore().collection('users').doc(uid);
  const snapshot = transaction ? await transaction.get(profileRef) : await profileRef.get();
  const profile = snapshot.exists ? snapshot.data() : undefined;
  if (!profile || (profile.uid !== undefined && profile.uid !== uid)
    || (profile.disabled !== undefined && profile.disabled !== false)
    || (profile.deleted !== undefined && profile.deleted !== false)
    || (profile.suspended !== undefined && profile.suspended !== false)
    || (profile.status !== undefined && profile.status !== 'active')
    || !['admin', 'operator', 'user'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'A current active protected account is required.');
  }

  const operator = (profile.role === 'admin' || profile.role === 'operator')
    && operatorClaim(decoded) && operatorClaim(live.customClaims);
  return { uid, operator, profile: { ...profile, uid } as User };
}

export function requireJobOperator(actor: CurrentJobActor): void {
  if (!actor.operator) throw new HttpsError('permission-denied', 'Current protected admin/operator access is required.');
}
