/**
 * Review-only source-rights + owner-state acceptance using REAL disposable
 * Firebase Auth, Firestore and Storage emulators. Synthetic records are seeded
 * by the test, NOT issued by an approved consent or third-party rights issuer.
 * The operational Jobs render gate remains hard false.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createReviewOnlyFirebaseLifeMovieOwnerVerifier } from
  '../functions/lib/functions/privacy/lifeMovieFirebaseOwnerState.js';
import { createFirebaseLifeMovieSourceRightsVerifier } from
  '../functions/lib/functions/privacy/lifeMovieFirebaseSourceRightsAdapter.js';
import { deriveStudioLifeMovieRenderScope } from
  '../functions/lib/functions/jobs/studioLifeMovieContract.js';

const PROJECT = 'urai-staging-test';
const REQUIRED = {
  URAI_EMULATOR_PROJECT: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};
for (const [key, expected] of Object.entries(REQUIRED)) {
  assert.equal(process.env[key], expected, key + ' must use disposable local emulator');
}
for (const key of [
  'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
]) assert.equal(process.env[key] ?? '', '', 'cloud credential forbidden: ' + key);
for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[key]) assert.equal(process.env[key], PROJECT, key + ' must be disposable');
}
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp, getApps } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
const { getStorage } = requireFunctions('firebase-admin/storage');
assert.equal(getApps().length, 0);
const app = initializeApp({ projectId: PROJECT }); // original server verifiers read getApp()
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const uid = 'owner-' + randomUUID();
const tenantId = 'synthetic-tenant-1';
const movieId = 'movie-1';
const rightsId = 'rights-' + randomUUID();
const bucket = 'urai-staging-test.appspot.com';
const sourceId = 'source-1';
const path = 'tenants/' + tenantId + '/sources/' + sourceId + '-' + randomUUID() + '.png';
const sourceFile = storage.bucket(bucket).file(path);
const userRef = db.collection('users').doc(uid);
const tombstoneRef = db.collection('privacyDeletionTombstones').doc(uid);
const rightsRef = db.collection('lifeMovieSourceRights').doc(rightsId);
const audits = db.collection('lifeMovieSourceRightsDecisions');
const checks = [];
const DENIED = /life_movie_source_rights_unverified/;
const PLAN_DIGEST = 'a'.repeat(64);
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/U5YAAAAASUVORK5CYII=',
  'base64',
);
const profile = {
  uid, tenantId, accountStatus: 'active', deleted: false,
  markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: false,
};

const currentOwner = createReviewOnlyFirebaseLifeMovieOwnerVerifier({
  firebaseProjectId: PROJECT,
});
const createVerifier = (assertCurrentOwner = currentOwner) =>
  createFirebaseLifeMovieSourceRightsVerifier({
    firebaseProjectId: PROJECT, allowedBuckets: [bucket], assertCurrentOwner,
    nowMs: () => Date.now(),
  });
const auditCount = async () => (await audits.where('ownerUid', '==', uid).get()).size;
const pass = async (label, action) => {
  await action();
  checks.push(label);
};
const deny = async (label, action) => {
  const count = await auditCount();
  await assert.rejects(action, DENIED, label + ' must deny');
  assert.equal(await auditCount(), count, label + ' cannot write positive rights audit');
  checks.push(label);
};

try {
  await auth.createUser({
    uid, email: uid + '@review-only.example.test', disabled: false,
  });
  await auth.setCustomUserClaims(uid, { tenantId });
  await userRef.set(profile);
  await sourceFile.save(ONE_PIXEL_PNG, {
    resumable: false, metadata: { contentType: 'image/png' },
  });
  const [meta] = await sourceFile.getMetadata();
  const generation = String(meta.generation);
  assert.match(generation, /^[1-9][0-9]{0,19}$/);
  assert.equal(Number.isSafeInteger(Number(generation)), true);

  const originalSource = {
    id: sourceId, bucket, objectPath: path, generation,
    mimeType: 'image/png', provenance: 'original-source',
    sourceRefs: ['synthetic-record-1'], consentRef: 'synthetic-consent-ref-1',
    ownerOrRightsRef: rightsId,
  };
  const makeRequest = (src = originalSource) => {
    const selection = {
      projectId: movieId, renderPlanDigest: PLAN_DIGEST, sources: [src],
    };
    return {
      ownerUid: uid, tenantId, selection,
      renderScope: deriveStudioLifeMovieRenderScope(selection),
    };
  };
  const request = makeRequest();
  const now = Date.now();
  const rights = {
    schemaVersion: 'urai-life-movie-source-rights-v1',
    issuer: 'trusted-server-source-rights-v1', // SYNTHETIC fixture, not a real issuer.
    status: 'approved', purpose: 'life-movie.render',
    ownerUid: uid, tenantId, projectId: movieId, sourceId,
    bucket, objectPath: path, generation, mimeType: 'image/png',
    consentRef: originalSource.consentRef,
    ownerOrRightsRef: rightsId, provenance: originalSource.provenance,
    sourceRefs: originalSource.sourceRefs,
    thirdPartyClearance: 'verified', evidenceHash: 'b'.repeat(64),
    reviewedAt: new Date(now - 3000).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
  };
  await rightsRef.set(rights);
  const verifier = createVerifier();
  const receipt = await verifier(request);
  assert.equal(receipt.ownerUid, uid);
  assert.equal(receipt.tenantId, tenantId);
  assert.deepEqual(receipt.renderScope, request.renderScope);
  assert.match(receipt.rightsEventId, /^[0-9a-f-]{36}$/);
  const audit = await audits.doc(receipt.rightsEventId).get();
  assert.equal(audit.exists, true);
  assert.equal(audit.data()?.renderPlanDigest, PLAN_DIGEST);
  assert.equal(audit.data()?.sourceSetDigest, request.renderScope.sourceSetDigest);
  assert.equal(audit.data()?.sourceCount, 1);
  assert.equal(audit.data()?.action, 'life_movie_source_rights_preflight_verified');
  checks.push('real-auth-firestore-storage-synthetic-rights-and-bound-audit');

  await deny('foreign-tenant-denied', () =>
    verifier({ ...request, tenantId: 'another-tenant' }));
  await deny('changed-selection-digest-denied', () =>
    verifier({ ...request, renderScope: { ...request.renderScope, sourceSetDigest: 'f'.repeat(64) } }));
  await deny('changed-object-generation-denied', () => {
    const changed = { ...originalSource, generation: String(Number(generation) + 1) };
    return verifier(makeRequest(changed));
  });

  await userRef.update({ markedForDeletion: true });
  await deny('live-owner-marked-for-deletion', () => verifier(request));
  await userRef.update({ markedForDeletion: false });

  await auth.updateUser(uid, { disabled: true });
  await deny('live-owner-auth-disabled', () => verifier(request));
  await auth.updateUser(uid, { disabled: false });

  await tombstoneRef.set({ uid, active: true });
  await deny('real-deletion-tombstone-denied', () => verifier(request));
  await tombstoneRef.delete();

  await rightsRef.update({ status: 'revoked' });
  await deny('actual-rights-revocation-denied', () => verifier(request));
  await rightsRef.set(rights);

  await rightsRef.update({ thirdPartyClearance: 'pending' });
  await deny('unverified-third-party-clearance-denied', () => verifier(request));
  await rightsRef.set(rights);

  await rightsRef.update({ ownerUid: 'foreign-owner' });
  await deny('server-owned-rights-owner-mismatch-denied', () => verifier(request));
  await rightsRef.set(rights);

  // A deletion between the FIRST and SECOND owner checks must deny without
  // emitting an allow audit. The mutation is test-controlled, but both
  // checks and tombstone writes use real Firebase services.
  let ownerChecks = 0;
  const flipDeletion = async (ownerUid, tenant) => {
    ownerChecks++;
    if (ownerChecks === 2) await tombstoneRef.set({ uid, active: true });
    await currentOwner(ownerUid, tenant);
  };
  await deny('real-deletion-between-two-owner-checks-denied', () =>
    createVerifier(flipDeletion)(request));
  assert.equal(ownerChecks, 2);
  await tombstoneRef.delete();

  // A rights revocation after the second owner check but BEFORE the second
  // server-owned rights read must also deny and produce no positive audit.
  ownerChecks = 0;
  const flipRights = async (ownerUid, tenant) => {
    ownerChecks++;
    await currentOwner(ownerUid, tenant);
    if (ownerChecks === 2) await rightsRef.update({ status: 'revoked' });
  };
  await deny('real-rights-revoked-before-final-reread-denied', () =>
    createVerifier(flipRights)(request));
  assert.equal(ownerChecks, 2);
  await rightsRef.set(rights);

  // Editing a GCS object at the same path changes its current generation.
  // A stale selected generation must never be admitted.
  await sourceFile.save(Buffer.concat([ONE_PIXEL_PNG, Buffer.from('synthetic')]), {
    resumable: false, metadata: { contentType: 'image/png' },
  });
  const [latest] = await sourceFile.getMetadata();
  assert.notEqual(String(latest.generation), generation);
  await deny('real-current-storage-generation-drift-denied', () => verifier(request));

  const c6 = await db.collection('consentRecords').doc(uid + '_life-movie_render').get();
  assert.equal(c6.exists, false, 'synthetic rights audit must not mint a C6 consent');
  checks.push('synthetic-rights-audit-does-not-issue-C6-consent');

  console.log('R493_OWNER_RIGHTS_THREE_EMULATOR_PASS ' + JSON.stringify({
    schemaVersion: 'urai-r493-disposable-owner-rights-three-emulator-v1',
    projectId: PROJECT, exactJobsOriginalCompiledModule: true,
    firebaseAuthEmulator: true, firestoreEmulator: true, storageEmulator: true,
    syntheticRightsSeededNotIssuerApproved: true, checksPassed: checks.length, checks,
    approvedSourceRightsIssuer: false, approvedOwnerC6Grant: false,
    productionJobsIamVerified: false, jobsWorkerIntegrated: false,
    movieRendered: false, privateReplayVerified: false,
    productionChanged: false, finalReleaseAccepted: false,
  }));
} finally {
  await deleteApp(app).catch(() => {});
}
