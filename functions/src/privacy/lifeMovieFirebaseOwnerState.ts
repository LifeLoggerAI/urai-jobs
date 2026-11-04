import { getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { RightsBackend } from './lifeMovieSourceRightsVerifier.js';

/**
 * REVIEW-ONLY Firebase owner-state verifier for Life Movie source admission.
 *
 * It reads REAL server-owned Auth, profile and central Privacy deletion state,
 * rather than trusting an owner/tenant flag supplied by Studio or a Jobs caller.
 * This is deliberately NOT installed in the operational Jobs or worker bridge.
 * A successful point-in-time owner check is NOT a C6 grant, source clearance,
 * authenticated Jobs service identity, or authorization to render/replay.
 *
 * Before activation, independently review cross-project IAM, the authoritative
 * tenant-membership schema, concurrent deletion/revocation guarantees, and the
 * owner-approved scoped grant issuer. Jobs' hard-false render gate stays intact.
 */
const DENIED = 'life_movie_owner_state_unverified';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const PLANNING = [
  'deletionPlanningLeaseToken',
  'deletionPlanningLeaseUntil',
  'deletionPlanningLeaseRequestId',
  'deletionPlanningLeaseOperation',
  'deletionPlanningLeaseBy',
] as const;

function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(DENIED);
  }
  const prop = Object.getOwnPropertyDescriptor(value, key);
  if (!prop || !Object.prototype.hasOwnProperty.call(prop, 'value')) {
    throw new Error(DENIED);
  }
  return prop.value;
}

function clearOwnerProfile(
  value: unknown,
  uid: string,
  tenantId: string,
): boolean {
  try {
    if (ownData(value, 'uid') !== uid ||
        ownData(value, 'tenantId') !== tenantId ||
        ownData(value, 'accountStatus') !== 'active' ||
        ownData(value, 'deleted') !== false ||
        ownData(value, 'markedForDeletion') !== false) return false;
    // Older profiles can lack the newer central deletion fence, but a
    // present true, malformed or getter-backed value is NEVER clearance.
    if (Object.prototype.hasOwnProperty.call(value, 'dataRightsDeletionPendingCentralPrivacy') &&
        ownData(value, 'dataRightsDeletionPendingCentralPrivacy') !== false) return false;
    if ('dataRightsDeletionPendingCentralPrivacy' in (value as object) &&
        !Object.prototype.hasOwnProperty.call(value, 'dataRightsDeletionPendingCentralPrivacy')) return false;
    return true;
  } catch {
    return false;
  }
}

function clearTombstone(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const obj = snapshot as { exists?: unknown; data?: () => unknown };
  if (obj.exists === false) return true; // Verified absence from Firestore.
  if (obj.exists !== true || typeof obj.data !== 'function') return false;
  try {
    const record = obj.data();
    if (ownData(record, 'active') !== false) return false;
    // A pending dry-run/deletion planning lease is not a clear deletion state.
    return !PLANNING.some(key => Object.prototype.hasOwnProperty.call(record, key));
  } catch {
    return false;
  }
}

/**
 * This is a server-only, read-only callback for the review-stage
 * source-rights preflight. It cannot authenticate a Studio caller: that is a
 * separate, mandatory admission boundary. Fail CLOSED on every unknown state,
 * missing profile, tenant mismatch, disabled Auth user or Firebase API error.
 */
export function createReviewOnlyFirebaseLifeMovieOwnerVerifier(
  config: Readonly<{ firebaseProjectId: string }>,
): RightsBackend['assertCurrentOwner'] {
  if (!config || typeof config.firebaseProjectId !== 'string' ||
      !PROJECT.test(config.firebaseProjectId)) throw new Error(DENIED);

  let auth: ReturnType<typeof getAuth>;
  let db: ReturnType<typeof getFirestore>;
  try {
    const app = getApp();
    if (app.options.projectId !== config.firebaseProjectId) throw new Error(DENIED);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch {
    throw new Error(DENIED);
  }

  return async (ownerUid: string, tenantId: string): Promise<void> => {
    try {
      if (typeof ownerUid !== 'string' || !ID.test(ownerUid) ||
          typeof tenantId !== 'string' || !ID.test(tenantId)) throw new Error(DENIED);

      const [authUser, profile, tombstone] = await Promise.all([
        auth.getUser(ownerUid),
        db.collection('users').doc(ownerUid).get(),
        db.collection('privacyDeletionTombstones').doc(ownerUid).get(),
      ]);
      if (!authUser || authUser.uid !== ownerUid || authUser.disabled !== false ||
          !profile || profile.exists !== true ||
          !clearOwnerProfile(profile.data(), ownerUid, tenantId) ||
          !clearTombstone(tombstone)) throw new Error(DENIED);

      // A signed Firebase tenant claim is not required on legacy accounts, but
      // a present and conflicting tenant claim must not be ignored.
      const claims = authUser.customClaims;
      if (claims != null && typeof claims === 'object' &&
          Object.prototype.hasOwnProperty.call(claims, 'tenantId') &&
          ownData(claims, 'tenantId') !== tenantId) throw new Error(DENIED);
      if (claims != null && typeof claims !== 'object') throw new Error(DENIED);
    } catch {
      throw new Error(DENIED);
    }
  };
}
