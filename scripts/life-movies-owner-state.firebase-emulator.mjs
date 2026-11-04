/**
 * NONPRODUCTION: Original compiled Jobs owner-state verifier against REAL
 * disposable Firebase Auth + Firestore emulators.
 *
 * Requires the emulators to be started by an external firebase-tools binary.
 * Example from a prepared workspace:
 *   firebase emulators:exec --project urai-staging-test --config firebase.json \
 *     --only auth,firestore \
 *     'node /absolute/path/to/urai-jobs/scripts/life-movies-owner-state.firebase-emulator.mjs'
 *
 * This is NOT an owner C6 consent issuer, source-rights approval, signed Jobs
 * IAM, transaction-time deletion guarantee, movie rendering or launch approval.
 * Never accept actual cloud credentials or a nonlocal Firebase endpoint.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createReviewOnlyFirebaseLifeMovieOwnerVerifier } from
  '../functions/lib/functions/privacy/lifeMovieFirebaseOwnerState.js';

const PROJECT = 'urai-staging-test';
const REQUIRED = Object.freeze({
  URAI_EMULATOR_PROJECT: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
});
for (const [name, value] of Object.entries(REQUIRED)) {
  assert.equal(process.env[name], value, 'Disallow nonlocal/mismatched emulator: ' + name);
}
for (const name of [
  'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
]) {
  assert.equal(process.env[name] ?? '', '', 'Cloud credential forbidden: ' + name);
}
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name]) assert.equal(process.env[name], PROJECT, name + ' must be disposable');
}

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp, getApps } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
assert.equal(getApps().length, 0, 'No other Firebase Admin app may be active');
const app = initializeApp({ projectId: PROJECT }, 'jobs-owner-state-emulator-only');
const auth = getAuth(app);
const db = getFirestore(app);
const uid = 'synthetic-owner-' + randomUUID();
const tenant = 'synthetic-tenant-1';
const profileRef = db.collection('users').doc(uid);
const deletionRef = db.collection('privacyDeletionTombstones').doc(uid);
const DENIED = /life_movie_owner_state_unverified/;
const checks = [];
const profile = {
  uid, tenantId: tenant, accountStatus: 'active', deleted: false,
  markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: false,
};

async function pass(label, action) {
  await action();
  checks.push(label);
}
async function deny(label, action) {
  await assert.rejects(action, DENIED, label + ': must deny');
  checks.push(label);
}
async function assertOwner(verifier, ownerUid = uid, tenantId = tenant) {
  return verifier(ownerUid, tenantId);
}
try {
  const verifier = createReviewOnlyFirebaseLifeMovieOwnerVerifier({ firebaseProjectId: PROJECT });
  assert.throws(() =>
    createReviewOnlyFirebaseLifeMovieOwnerVerifier({ firebaseProjectId: 'urai-production' }),
    DENIED);
  checks.push('cannot-create-review-verifier-for-other-project');

  // The checks below read ACTUAL Firebase Auth user state and ACTUAL Firestore
  // records. No mocks/fixtures replace these backend APIs.
  await auth.createUser({
    uid, email: 'synthetic-' + uid + '@example.test',
    disabled: false,
  });
  await auth.setCustomUserClaims(uid, { tenantId: tenant });
  await profileRef.set(profile);
  await pass('real-auth-plus-firestore-owner-active', () => assertOwner(verifier));

  await deny('foreign-request-tenant', () => assertOwner(verifier, uid, 'another-tenant'));
  await deny('foreign-request-uid', () => assertOwner(verifier, 'unknown-synthetic-owner', tenant));
  await deny('malformed-owner-uid', () => assertOwner(verifier, 'bad/uid', tenant));

  await profileRef.update({ tenantId: 'another-tenant' });
  await deny('real-profile-tenant-mismatch', () => assertOwner(verifier));
  await profileRef.update({ tenantId: tenant });
  await pass('real-profile-tenant-restored', () => assertOwner(verifier));

  await auth.setCustomUserClaims(uid, { tenantId: 'another-tenant' });
  await deny('auth-tenant-claim-mismatch', () => assertOwner(verifier));
  await auth.setCustomUserClaims(uid, { tenantId: tenant });

  await auth.updateUser(uid, { disabled: true });
  await deny('real-firebase-auth-disabled', () => assertOwner(verifier));
  await auth.updateUser(uid, { disabled: false });
  await pass('real-firebase-auth-restored', () => assertOwner(verifier));

  await profileRef.update({ accountStatus: 'disabled' });
  await deny('real-profile-inactive', () => assertOwner(verifier));
  await profileRef.update({ accountStatus: 'active' });

  await profileRef.update({ markedForDeletion: true });
  await deny('real-profile-marked-for-deletion', () => assertOwner(verifier));
  await profileRef.update({ markedForDeletion: false });

  await profileRef.update({ dataRightsDeletionPendingCentralPrivacy: true });
  await deny('central-privacy-deletion-pending', () => assertOwner(verifier));
  await profileRef.update({ dataRightsDeletionPendingCentralPrivacy: false });

  await deletionRef.set({ uid, active: true });
  await deny('real-active-deletion-tombstone', () => assertOwner(verifier));

  await deletionRef.set({ uid, active: false, deletionPlanningLeaseToken: 'lease-pending' });
  await deny('real-deletion-planning-lease', () => assertOwner(verifier));

  await deletionRef.set({ uid, active: false });
  await pass('real-cleared-deletion-tombstone', () => assertOwner(verifier));

  await deletionRef.set({ uid }); // Unknown active state must never clear owner.
  await deny('real-malformed-deletion-tombstone', () => assertOwner(verifier));

  await deletionRef.delete();
  await pass('real-tombstone-verified-absent', () => assertOwner(verifier));

  await profileRef.delete();
  await deny('real-missing-protected-owner-profile', () => assertOwner(verifier));
  await profileRef.set(profile);
  await pass('real-profile-restored', () => assertOwner(verifier));

  await auth.deleteUser(uid);
  await deny('real-deleted-firebase-auth-account', () => assertOwner(verifier));

  const receipt = {
    schemaVersion: 'urai-jobs-owner-state-disposable-emulator-v1',
    projectId: PROJECT,
    originalCompiledJobsModule: true,
    actualFirebaseAuthEmulator: true,
    actualFirestoreEmulator: true,
    checksPassed: checks.length,
    checks,
    ownerConsentIssuerApproved: false,
    tenantAuthorityIndependentlyReviewed: false,
    jobsServiceIdentityVerified: false,
    liveMovieRenderAuthorized: false,
    productionChanged: false,
    finalReleaseAccepted: false,
  };
  console.log('R490_JOBS_OWNER_STATE_FIREBASE_EMULATOR_PASS ' + JSON.stringify(receipt));
} finally {
  await deleteApp(app).catch(() => {});
}
