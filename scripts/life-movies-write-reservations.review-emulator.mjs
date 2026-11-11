/**
 * R520 review-only original-source Firebase Firestore emulator acceptance.
 * Use exclusively with the disposable urai-staging-test emulator project.
 * There is no Storage write, cloud credential, production grant or media.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROJECT = 'urai-staging-test';
assert.equal(process.env.URAI_EMULATOR_PROJECT, PROJECT);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
for (const name of ['GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) {
  // Never echo a credential value into CI or provider logs.
  if (process.env[name]) throw new Error(name + ' must be absent');
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
  assertReviewOnlyBrokerPreByte,
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
  // R1043: both simulated pre-byte boundaries must recheck the canonical
  // owner revocation and current consent block, not trust admission snapshots.
  const s7=scope('prebyte'), k=ident(s7,'k'), m=ident(s7,'m');
  await fixture(s7,k);await fixture(s7,m);await seedReviewOnlyOutputScope(s7);
  const blockId=createHash('sha256').update(s7.ownerUid+'\n'+'life-movie.render').digest('hex');
  const blockRef=db.collection('jobConsentBlocks').doc(blockId);
  const canonicalPrebyte=db.collection(PRIVATE_OUTPUT_FENCE_COLLECTION)
    .doc(privateOutputFenceId(s7.ownerUid,'life-movie.render'));
  await check('R1043 canonical revocation after simulated upload start vetoes pre-byte',async()=>{
    await reserveReviewOnlyOutputAttempt(k,1);
    await beginReviewOnlySimulatedUpload(k);
    await assertReviewOnlyBrokerPreByte(k);
    await canonicalPrebyte.create({phase:'FENCING',eventId:'synthetic-r1043'});
    await denied(assertReviewOnlyBrokerPreByte(k),'canonical_revocation_fenced');
    // Preserve R1044 peer's independent invariant: the old project review fence
    // can still read OPEN while the canonical owner-wide veto blocks all bytes.
    const status = await reviewOnlyDrainStatus(s7);
    assert.equal(status.state, 'OPEN');
    assert.equal(status.activeOrUnproven, 1);
    assert.equal(status.revocationAcknowledgementPermitted, false);
    assert.equal(status.productionAuthorized, false);
  });
  await check('R1043 active consent block added after reservation vetoes begin',async()=>{
    await reserveReviewOnlyOutputAttempt(m,1).then(()=>assert.fail('canonical veto should reject'),error=>
      assert.match(error.message,/canonical_revocation_fenced/));
    // A fresh owner allows us to isolate block revocation from canonical veto.
    const s8=scope('consentblock'), n=ident(s8,'n'), o=ident(s8,'o');
    await fixture(s8,n);await fixture(s8,o);await seedReviewOnlyOutputScope(s8);
    await reserveReviewOnlyOutputAttempt(n,1);
    const consentId=createHash('sha256').update(s8.ownerUid+'\n'+'life-movie.render').digest('hex');
    const consentRef=db.collection('jobConsentBlocks').doc(consentId);
    await consentRef.create({active:true,eventId:'withdrawn'});
    await denied(beginReviewOnlySimulatedUpload(n),'consent_blocked_or_unverified');
    await denied(reserveReviewOnlyOutputAttempt(o,1),'consent_blocked_or_unverified');
  });
  await check('R1043 active or malformed consent block after in-flight start vetoes pre-byte',async()=>{
    const s9=scope('lateblock'), p=ident(s9,'p');
    await fixture(s9,p);await seedReviewOnlyOutputScope(s9);
    await reserveReviewOnlyOutputAttempt(p,1);
    await beginReviewOnlySimulatedUpload(p);
    const id=createHash('sha256').update(s9.ownerUid+'\n'+'life-movie.render').digest('hex');
    const r=db.collection('jobConsentBlocks').doc(id);
    await r.create({active:true});
    await denied(assertReviewOnlyBrokerPreByte(p),'consent_blocked_or_unverified');
    await r.set({active:'forged'});
    await denied(assertReviewOnlyBrokerPreByte(p),'consent_blocked_or_unverified');
    await r.set({active:false});
    await assertReviewOnlyBrokerPreByte(p);
  });
  await check('R1043 cancelled job is denied after reservation and after simulated begin',async()=>{
    const s10=scope('joblive'), q=ident(s10,'q');
    await fixture(s10,q);await seedReviewOnlyOutputScope(s10);
    await reserveReviewOnlyOutputAttempt(q,1);
    const job=db.collection('jobs').doc(q.jobId);
    await job.update({status:'CANCELLED'});
    await denied(beginReviewOnlySimulatedUpload(q),'job_unverified');
    await job.update({status:'RUNNING'});
    await beginReviewOnlySimulatedUpload(q);
    await job.update({status:'CANCELLED'});
    await denied(assertReviewOnlyBrokerPreByte(q),'job_unverified');
  });
  await check('R1043 owner disabled or deletion-pending is denied at both later stages',async()=>{
    const s11=scope('ownerlive'), t=ident(s11,'t');
    await fixture(s11,t);await seedReviewOnlyOutputScope(s11);
    await reserveReviewOnlyOutputAttempt(t,1);
    const owner=db.collection('users').doc(s11.ownerUid);
    await owner.update({disabled:true});
    await denied(beginReviewOnlySimulatedUpload(t),'owner_unverified');
    await owner.update({disabled:false});
    await beginReviewOnlySimulatedUpload(t);
    await owner.update({deletionPending:true});
    await denied(assertReviewOnlyBrokerPreByte(t),'owner_unverified');
    await owner.update({deletionPending:false});
    await assertReviewOnlyBrokerPreByte(t);
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
