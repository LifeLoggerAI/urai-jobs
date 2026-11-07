/**
 * R857: disposable Firebase Auth? No: Firestore + Storage original broker
 * ledger acceptance. Review-only physical synthetic bytes, never real media.
 * This is a test of accounting, not GCS IAM or a production writer.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const PROJECT='urai-staging-test';
for(const [name,value] of Object.entries({
  URAI_EMULATOR_PROJECT: PROJECT,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
})) assert.equal(process.env[name],value);
for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN',
  'GITHUB_TOKEN','GH_TOKEN','RUNPOD_API_KEY','GOOGLE_APPLICATION_CREDENTIALS_JSON']) {
  assert.equal(process.env[name]||'','',name+' must not contain credentials');
}
for(const name of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT']) {
  if(process.env[name])assert.equal(process.env[name],PROJECT);
}
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const { initializeApp,deleteApp,getApps }=require('firebase-admin/app');
const { getFirestore }=require('firebase-admin/firestore');
const { getStorage }=require('firebase-admin/storage');
assert.equal(getApps().length,0);
const app=initializeApp({projectId:PROJECT});
const db=getFirestore(app);
const bucket=getStorage(app).bucket(PROJECT+'.appspot.com');
const {
  seedReviewOnlyOutputScope,
  reserveReviewOnlyOutputAttempt,
  beginReviewOnlySimulatedUpload,
  assertReviewOnlyBrokerPreByte,
  recordReviewOnlyBrokerPhysicalGeneration,
  reviewOnlySyntheticOutputObjectPath,
  revokeReviewOnlyOutputScope,
  cancelUnstartedReviewOnlyAttempt,
  reviewOnlyDrainStatus,
  reviewOnlyScopeId,
}=require('../functions/lib/functions/privacy/lifeMovieWriteReservationsReview.js');
const token=randomUUID().replaceAll('-','').slice(0,16);
const cases=[];
const attempts=[];
const check=async(name,fn)=>{await fn();cases.push(name);console.log('R857_PASS',name);};
const scope=n=>({ownerUid:'synthetic-r857-'+token+'-'+n,tenantId:'tenant-1',projectId:'movie-'+token+'-'+n});
const attempt=(s,n)=>({...s,jobId:'job-'+token+'-'+n,attemptId:'attempt-'+n});
const deny=(action,code)=>assert.rejects(action,e=>typeof e?.message==='string'&&e.message.includes(code));
const fixture=async(s,a)=>{
  await db.collection('users').doc(s.ownerUid).set({disabled:false,deletionPending:false,role:'user'});
  await db.collection('jobs').doc(a.jobId).set({
    ownerUid:s.ownerUid,tenantId:s.tenantId,sourceSystem:'urai-studio',
    jobType:'studio.render.video',status:'RUNNING',payload:{projectId:s.projectId},
    consent:{purpose:'life-movie.render'},
  });
  await seedReviewOnlyOutputScope(s);
};
async function save(a,name){
  const path=reviewOnlySyntheticOutputObjectPath(a);
  const file=bucket.file(path);
  attempts.push(file);
  await file.save(Buffer.from('R857-disposable-'+name),{resumable:false,metadata:{contentType:'application/octet-stream'}});
  const [meta]=await file.getMetadata();
  const gen=String(meta.generation);
  assert.match(gen,/^[1-9][0-9]*$/);
  return {path,file,gen};
}
try{
  const aScope=scope('before'),a=attempt(aScope,'before');
  await fixture(aScope,a);
  await check('a reservation is durable but a revoke before first byte denies broker pre-byte check',async()=>{
    const grant=await reserveReviewOnlyOutputAttempt(a,1);
    assert.equal(grant.productionAuthorized,false);
    await beginReviewOnlySimulatedUpload(a);
    await revokeReviewOnlyOutputScope(aScope,'revoke-before');
    await deny(()=>assertReviewOnlyBrokerPreByte(a),'fence_revoked_or_stale');
    assert.equal((await reviewOnlyDrainStatus(aScope)).activeOrUnproven,1);
    assert.equal((await reviewOnlyDrainStatus(aScope)).revocationAcknowledgementPermitted,false);
  });

  const bScope=scope('late'),b=attempt(bScope,'late');
  await fixture(bScope,b);
  await check('real emulator bytes after prebyte but before withdraw are tracked by durable generation',async()=>{
    await reserveReviewOnlyOutputAttempt(b,1);
    await beginReviewOnlySimulatedUpload(b);
    await assertReviewOnlyBrokerPreByte(b);
    const {gen}=await save(b,'before-revoke');
    await revokeReviewOnlyOutputScope(bScope,'revoke-after-bytes');
    const recorded=await recordReviewOnlyBrokerPhysicalGeneration(b,gen);
    assert.equal(recorded.observed,true);
    assert.equal(recorded.withdrawalFenced,true);
    assert.equal(recorded.revocationAcknowledgementPermitted,false);
    const ledger=(await db.collection('lifeMovieWriteAttemptsReviewOnly')
      .where('scopeId','==',reviewOnlyScopeId(bScope)).get()).docs;
    assert.equal(ledger.length,1);
    assert.equal(ledger[0].data().state,'PHYSICAL_GENERATION_UNVERIFIED');
    assert.equal(ledger[0].data().physicalGeneration,gen);
    assert.equal(ledger[0].data().storageWriteFenceVerified,false);
    assert.equal(ledger[0].data().storageMetadataReadbackVerified,true);
    assert.equal((await reviewOnlyDrainStatus(bScope)).activeOrUnproven,1);
  });

  await check('forged and absent physical generations cannot create a durable ledger record',async()=>{
    const noScope=scope('missing'),no=attempt(noScope,'missing');
    await fixture(noScope,no);
    await reserveReviewOnlyOutputAttempt(no,1);
    await beginReviewOnlySimulatedUpload(no);
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(no,'1'),'generation_not_observed');
    const snap=await db.collection('lifeMovieWriteAttemptsReviewOnly')
      .where('scopeId','==',reviewOnlyScopeId(noScope)).get();
    assert.equal(snap.size,1);
    assert.equal(snap.docs[0].data().state,'SIMULATED_IN_FLIGHT');
    assert.equal(snap.docs[0].data().physicalGeneration,undefined);

    const real=await db.collection('lifeMovieWriteAttemptsReviewOnly')
      .where('scopeId','==',reviewOnlyScopeId(bScope)).get();
    const actual=real.docs[0].data().physicalGeneration;
    const wrong=(BigInt(actual)===1n?'2':'1');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,wrong),'generation_conflict');
    const unchanged=(await real.docs[0].ref.get()).data();
    assert.equal(unchanged.physicalGeneration,actual);
    assert.equal(unchanged.state,'PHYSICAL_GENERATION_UNVERIFIED');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,'18446744073709551616'),'generation_invalid');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,'9007199254740993x'),'generation_invalid');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,'01'),'generation_invalid');
  });

  await check('legacy unverified physical record cannot be silently promoted by replay',async()=>{
    const legacyScope=scope('legacy'),legacy=attempt(legacyScope,'legacy');
    await fixture(legacyScope,legacy);
    await reserveReviewOnlyOutputAttempt(legacy,1);
    await beginReviewOnlySimulatedUpload(legacy);
    const snap=await db.collection('lifeMovieWriteAttemptsReviewOnly')
      .where('scopeId','==',reviewOnlyScopeId(legacyScope)).get();
    assert.equal(snap.size,1);
    await snap.docs[0].ref.update({
      state:'PHYSICAL_GENERATION_UNVERIFIED',
      physicalGeneration:'1',
      objectPath:reviewOnlySyntheticOutputObjectPath(legacy),
      storageWriteFenceVerified:false,
      storageMetadataReadbackVerified:false,
    });
    await deny(()=>reviewOnlyDrainStatus(legacyScope),'physical_generation_unverified');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(legacy,'1'),'physical_generation_unverified');
  });

  await check('repeat same physical generation is idempotent but a new generation cannot replace it',async()=>{
    const snapshot=await db.collection('lifeMovieWriteAttemptsReviewOnly')
      .where('scopeId','==',reviewOnlyScopeId(bScope)).get();
    const gen=snapshot.docs[0].data().physicalGeneration;
    const replay=await recordReviewOnlyBrokerPhysicalGeneration(b,gen);
    assert.equal(replay.alreadyRecorded,true);
    assert.equal(replay.storageCurrentlyObserved,true);
    const other=String(BigInt(gen)+1n);
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,other),'generation_conflict');
    await deny(()=>recordReviewOnlyBrokerPhysicalGeneration(b,'0'),'generation_invalid');
  });
  await check('physical generation cannot be forged into acknowledged state even after file deletion',async()=>{
    const path=reviewOnlySyntheticOutputObjectPath(b);
    const file=bucket.file(path);
    const [meta]=await file.getMetadata();
    await bucket.file(path,{preconditionOpts:{ifGenerationMatch:String(meta.generation)}}).delete();
    const replay=await recordReviewOnlyBrokerPhysicalGeneration(b,String(meta.generation));
    assert.equal(replay.alreadyRecorded,true,'previous real observation survives precise cleanup');
    assert.equal(replay.storageCurrentlyObserved,false,'not a claim the object is still present');
    assert.equal(replay.revocationAcknowledgementPermitted,false);
    const state=await reviewOnlyDrainStatus(bScope);
    assert.equal(state.activeOrUnproven,1);
    assert.equal(state.revocationComplete,false);
    assert.equal(state.storageWriteFenceVerified,false);
    assert.equal(state.revocationAcknowledgementPermitted,false);
    await deny(()=>cancelUnstartedReviewOnlyAttempt(b),'cannot_reconcile');
  });

  const cScope=scope('unattributed'),c=attempt(cScope,'unattributed');
  await fixture(cScope,c);
  await check('unknown old Admin writer can still bypass broker: never certify exclusive IAM',async()=>{
    await revokeReviewOnlyOutputScope(cScope,'revoke-no-attempt');
    assert.equal((await reviewOnlyDrainStatus(cScope)).activeOrUnproven,0);
    await deny(()=>reserveReviewOnlyOutputAttempt(c,1),'fence_revoked_or_stale');
    const {file}=await save(c,'after-withdrawal');
    const [meta]=await file.getMetadata();
    assert.ok(meta.generation);
    assert.equal((await reviewOnlyDrainStatus(cScope)).revocationAcknowledgementPermitted,false);
  });
  await check('different owner and attempt paths are non-colliding',async()=>{
    assert.notEqual(reviewOnlySyntheticOutputObjectPath(b),reviewOnlySyntheticOutputObjectPath(c));
    assert.notEqual(reviewOnlySyntheticOutputObjectPath(a),reviewOnlySyntheticOutputObjectPath(b));
    assert.match(reviewOnlySyntheticOutputObjectPath(c),/^tenants\/tenant-1\/life-movies\/movie-/);
  });

  console.log('R857_REVIEW_ONLY_PHYSICAL_GENERATION_LEDGER_PASS checks='+cases.length+
    ' actualFirestoreEmulator=true actualStorageEmulator=true'+
    ' privilegedBypassObserved=true exclusiveIAMVerified=false'+
    ' privateDeletionAcknowledged=false productionAuthorized=false');
} finally {
  for(const file of attempts)await file.delete({ignoreNotFound:true}).catch(()=>{});
  await deleteApp(app);
}
