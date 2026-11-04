/**
 * R520 review-only original-source Firebase Firestore emulator acceptance.
 * Use exclusively with the disposable urai-staging-test emulator project.
 * There is no Storage write, cloud credential, production grant or media.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROJECT = 'urai-staging-test';
assert.equal(process.env.URAI_EMULATOR_PROJECT, PROJECT);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT', 'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) {
  assert.equal(process.env[name] || '', '', name + ' must be absent');
}

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ projectId: PROJECT });
const db = getFirestore(app);
const {
  seedReviewOnlyOutputScope,
  reserveReviewOnlyOutputAttempt,
  beginReviewOnlySimulatedUpload,
  revokeReviewOnlyOutputScope,
  cancelUnstartedReviewOnlyAttempt,
  reviewOnlyDrainStatus,
} = require('../functions/lib/functions/privacy/lifeMovieWriteReservationsReview.js');

const token = randomUUID().replaceAll('-', '').slice(0, 16);
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(name); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, e); throw e; }
};
const scope = suffix => ({
  ownerUid: 'synthetic-' + token + suffix,
  tenantId: 'tenant-1',
  projectId: 'movie-' + token + suffix,
});
const ident = (s, id) => ({ ...s, jobId: 'job-' + token + '-' + id, attemptId: 'attempt-' + id });
async function fixture(s, identity, overrides = {}) {
  await db.collection('users').doc(s.ownerUid).set({
    disabled: false, deletionPending: false, role: 'user',
  });
  await db.collection('jobs').doc(identity.jobId).set({
    ownerUid: s.ownerUid, tenantId: s.tenantId, sourceSystem: 'urai-studio',
    jobType: 'studio.render.video', status: 'RUNNING',
    payload: { projectId: s.projectId },
    consent: { purpose: 'life-movie.render' }, ...overrides,
  });
}
async function denied(promise, code) {
  await assert.rejects(promise, error =>
    typeof error?.message === 'string' && error.message.includes(code));
}
try {
  const s = scope('a'), a = ident(s, 'a'), b = ident(s, 'b');
  await check('missing scope fails closed', async () => {
    await denied(reserveReviewOnlyOutputAttempt(a, 1), 'fence_missing');
    await denied(reviewOnlyDrainStatus(s), 'fence_missing');
  });
  await fixture(s, a);
  await fixture(s, b);
  await check('one-time immutable fixture initializes epoch 1', async () => {
    const x = await seedReviewOnlyOutputScope(s);
    assert.equal(x.epoch, 1);
    assert.equal(x.productionAuthorized, false);
    await denied(seedReviewOnlyOutputScope(s), 'already_exists');
  });
  await check('reservation requires exact epoch and authenticated owner/job evidence', async () => {
    await denied(reserveReviewOnlyOutputAttempt(a, 2), 'revoked_or_stale');
    await reserveReviewOnlyOutputAttempt(a, 1);
    await denied(reserveReviewOnlyOutputAttempt(a, 1), 'attempt_reused');
    await reserveReviewOnlyOutputAttempt(b, 1);
  });
  await check('revocation increments epoch and rejects new reservations', async () => {
    const r = await revokeReviewOnlyOutputScope(s, 'event-a');
    assert.equal(r.epoch, 2);
    await denied(reserveReviewOnlyOutputAttempt({ ...b, attemptId: 'attempt-late' }, 1), 'revoked_or_stale');
    await denied(beginReviewOnlySimulatedUpload(b), 'revoked_or_stale');
    const retry = await revokeReviewOnlyOutputScope(s, 'event-a');
    assert.equal(retry.alreadyRevoked, true);
    await denied(revokeReviewOnlyOutputScope(s, 'event-other'), 'revocation_conflict');
  });
  await check('unstarted attempts can reconcile but never authorize ACK', async () => {
    await cancelUnstartedReviewOnlyAttempt(a);
    await cancelUnstartedReviewOnlyAttempt(b);
    const x = await reviewOnlyDrainStatus(s);
    assert.equal(x.activeOrUnproven, 0);
    assert.equal(x.revocationAcknowledgementPermitted, false);
    assert.equal(x.storageWriteFenceVerified, false);
  });

  const s2 = scope('b'), c = ident(s2, 'c'), d = ident(s2, 'd');
  await fixture(s2, c);
  await fixture(s2, d);
  await seedReviewOnlyOutputScope(s2);
  await check('simulated upload already in flight cannot be abandoned by timeout', async () => {
    await reserveReviewOnlyOutputAttempt(c, 1);
    await beginReviewOnlySimulatedUpload(c);
    await revokeReviewOnlyOutputScope(s2, 'event-b');
    await denied(cancelUnstartedReviewOnlyAttempt(c), 'cannot_reconcile');
    const x = await reviewOnlyDrainStatus(s2);
    assert.equal(x.activeOrUnproven, 1);
    assert.equal(x.revocationAcknowledgementPermitted, false);
  });
  await check('independent tenant remains isolated', async () => {
    await denied(reserveReviewOnlyOutputAttempt(d, 2), 'revoked_or_stale');
    const s3 = scope('c'), e = ident(s3, 'e');
    await fixture(s3, e);
    await seedReviewOnlyOutputScope(s3);
    await reserveReviewOnlyOutputAttempt(e, 1);
    assert.equal((await reviewOnlyDrainStatus(s3)).state, 'OPEN');
    assert.equal((await reviewOnlyDrainStatus(s2)).state, 'REVOKED');
  });

  const s4 = scope('d'), f = ident(s4, 'f');
  await fixture(s4, f);
  await seedReviewOnlyOutputScope(s4);
  await check('owner deletion and malformed jobs deny admission', async () => {
    await db.collection('users').doc(s4.ownerUid).update({ deletionPending: true });
    await denied(reserveReviewOnlyOutputAttempt(f, 1), 'owner_unverified');
    await db.collection('users').doc(s4.ownerUid).update({ deletionPending: false });
    await db.collection('jobs').doc(f.jobId).update({ status: 'CANCELLED' });
    await denied(reserveReviewOnlyOutputAttempt(f, 1), 'job_unverified');
  });
  await check('review model never returns production grants or Storage write permission', async () => {
    for (const x of [await reviewOnlyDrainStatus(s), await reviewOnlyDrainStatus(s2)]) {
      assert.equal(x.productionAuthorized, false);
      assert.equal(x.revocationAcknowledgementPermitted, false);
      assert.equal(x.storageWriteFenceVerified, false);
    }
  });
  console.log('R520_REVIEW_ONLY_FIRESTORE_EMULATOR_PASS checks=' + results.length);
} finally {
  await deleteApp(app);
}
