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
for (const name of ['GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) {
  assert.equal(process.env[name] || '', '', name + ' must be absent');
}
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name]) assert.equal(process.env[name], PROJECT,
    name + ' must identify only the disposable emulator project');
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
  reviewOnlyScopeId,
} = require('../functions/lib/functions/privacy/lifeMovieWriteReservationsReview.js');
const { PRIVATE_OUTPUT_FENCE_COLLECTION, privateOutputFenceId } =
  require('../functions/lib/functions/privacy/privateOutputRevocationFence.js');

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
    assert.equal(r.alreadyFenced, false);
    assert.equal(r.revocationAcknowledgementPermitted, false);
    assert.equal((await reviewOnlyDrainStatus(s)).state, 'FENCING');
    await denied(reserveReviewOnlyOutputAttempt({ ...b, attemptId: 'attempt-late' }, 1), 'revoked_or_stale');
    await denied(beginReviewOnlySimulatedUpload(b), 'revoked_or_stale');
    const retry = await revokeReviewOnlyOutputScope(s, 'event-a');
    assert.equal(retry.alreadyFenced, true);
    assert.equal(retry.revocationAcknowledgementPermitted, false);
    await denied(revokeReviewOnlyOutputScope(s, 'event-other'), 'revocation_conflict');
  });
  await check('unstarted attempts can reconcile but never authorize ACK', async () => {
    await cancelUnstartedReviewOnlyAttempt(a);
    await cancelUnstartedReviewOnlyAttempt(b);
    const x = await reviewOnlyDrainStatus(s);
    assert.equal(x.activeOrUnproven, 0);
    assert.equal(x.state, 'FENCING');
    assert.equal(x.withdrawalFenced, true);
    assert.equal(x.revocationComplete, false);
    assert.equal(x.revocationAcknowledgementPermitted, false);
    assert.equal(x.storageWriteFenceVerified, false);
  });

  await check('same-event retry after simulated drain cannot mark deletion complete', async () => {
    const retry = await revokeReviewOnlyOutputScope(s, 'event-a');
    assert.equal(retry.alreadyFenced, true);
    assert.equal(retry.revocationAcknowledgementPermitted, false);
    const x = await reviewOnlyDrainStatus(s);
    assert.equal(x.state, 'FENCING');
    assert.equal(x.activeOrUnproven, 0);
    assert.equal(x.revocationComplete, false);
    assert.equal(x.revocationAcknowledgementPermitted, false);
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
    assert.equal(x.state, 'FENCING');
    assert.equal(x.revocationComplete, false);
    assert.equal(x.revocationAcknowledgementPermitted, false);
  });
  await check('independent tenant remains isolated', async () => {
    await denied(reserveReviewOnlyOutputAttempt(d, 2), 'revoked_or_stale');
    const s3 = scope('c'), e = ident(s3, 'e');
    await fixture(s3, e);
    await seedReviewOnlyOutputScope(s3);
    await reserveReviewOnlyOutputAttempt(e, 1);
    assert.equal((await reviewOnlyDrainStatus(s3)).state, 'OPEN');
    assert.equal((await reviewOnlyDrainStatus(s2)).state, 'FENCING');
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
  // R1042 extra native tests: canonical withdrawal blocks review reservations
  // independently of the older per-project review-only OPEN state.
  const s5=scope('canonical'), g=ident(s5,'g'), h=ident(s5,'h');
  await fixture(s5,g); await fixture(s5,h); await seedReviewOnlyOutputScope(s5);
  const canonicalRef=db.collection(PRIVATE_OUTPUT_FENCE_COLLECTION).doc(privateOutputFenceId(s5.ownerUid,'life-movie.render'));
  await check('R1042 pre-withdrawal review reservation never grants cloud authority',async()=>{
    const r=await reserveReviewOnlyOutputAttempt(g,1);
    assert.equal(r.productionAuthorized,false);assert.equal(r.simulatedOnly,true);
  });
  await check('R1042 canonical withdrawal denies new reservation and pending start',async()=>{
    await canonicalRef.create({phase:'FENCING',eventId:'synthetic-event',ownerUid:s5.ownerUid,purpose:'life-movie.render',storageWriteAuthorized:false});
    await denied(reserveReviewOnlyOutputAttempt(h,1),'canonical_revocation_fenced');
    await denied(beginReviewOnlySimulatedUpload(g),'canonical_revocation_fenced');
    assert.equal((await reviewOnlyDrainStatus(s5)).state,'OPEN');
  });
  await check('R1042 malformed or privilege-injected canonical fence still denies',async()=>{
    await canonicalRef.update({phase:'OPEN',authorized:true});
    await denied(reserveReviewOnlyOutputAttempt(h,1),'canonical_revocation_fenced');
    await denied(beginReviewOnlySimulatedUpload(g),'canonical_revocation_fenced');
  });
  await check('R1042 same owner other tenant blocked, other owner isolated',async()=>{
    const s6={...scope('ownerwide'),ownerUid:s5.ownerUid},i=ident(s6,'i');
    await fixture(s6,i);await seedReviewOnlyOutputScope(s6);
    await denied(reserveReviewOnlyOutputAttempt(i,1),'canonical_revocation_fenced');
    const independent=scope('independent'),j=ident(independent,'j');
    await fixture(independent,j);await seedReviewOnlyOutputScope(independent);
    const result=await reserveReviewOnlyOutputAttempt(j,1);assert.equal(result.productionAuthorized,false);
  });
  await check('R1042 no physical deletion ACK follows canonical denial',async()=>{
    const status=await reviewOnlyDrainStatus(s5);
    assert.equal(status.revocationAcknowledgementPermitted,false);
    assert.equal(status.storageWriteFenceVerified,false);
    assert.equal(status.productionAuthorized,false);
  });
  await check('forged completed REVOKED state fails closed without cloud proof', async () => {
    const forged = scope('forged');
    await seedReviewOnlyOutputScope(forged);
    await db.collection('lifeMovieWriteFencesReviewOnly')
      .doc(reviewOnlyScopeId(forged))
      .update({ state: 'REVOKED', revocationEventId: 'forged-ack' });
    await denied(reviewOnlyDrainStatus(forged), 'fence_unverified');
    await denied(revokeReviewOnlyOutputScope(forged, 'forged-ack'), 'fence_unverified');
  });
  await check('review model never returns production grants or Storage write permission', async () => {
    for (const x of [await reviewOnlyDrainStatus(s), await reviewOnlyDrainStatus(s2)]) {
      assert.equal(x.productionAuthorized, false);
      assert.equal(x.revocationAcknowledgementPermitted, false);
      assert.equal(x.storageWriteFenceVerified, false);
      assert.equal(x.revocationComplete, false);
    }
  });
  console.log('R523_REVIEW_ONLY_FENCING_EMULATOR_PASS checks=' + results.length
    + ' productionAuthorized=false deletionAck=false');
} finally {
  await deleteApp(app);
}
