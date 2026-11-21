'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[path.join(__dirname,'../functions')]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[path.join(__dirname,'../functions')]}));
const {executeJobsScopedDelete}=require('../functions/lib/functions/privacy/dataRightsExecution.js');
const {updateJobResult}=require('../functions/lib/functions/core/results.js');
assert.equal(process.env.GCLOUD_PROJECT,'urai-jobs-r1618-disposable');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18180');
for(const k of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GITHUB_TOKEN','RUNPOD_API_KEY'])assert.equal(process.env[k],undefined);
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'r1618-jobs-synthetic');
(async()=>{
 const db=getFirestore(app),token=randomBytes(5).toString('hex');
 const owner='r1618-owner-'+token,outsider='r1618-outsider-'+token;
 const ownJob='r1618-job-'+token,foreignJob='r1618-other-'+token;
 const orphanJob='r1618-orphan-'+token, taggedOrphanJob='r1621-tagged-'+token, lateJob='r1621-late-'+token,checks=[];
 const collection=name=>db.collection(name);
 try{
  await Promise.all([
   collection('jobs').doc(ownJob).set({ownerUid:owner,status:'SUCCESS',payload:{private:true},output:{signedMediaUrl:'synthetic-only'}}),
   collection('jobQueue').doc(ownJob).set({private:true}),
   collection('jobResults').doc(ownJob).set({jobId:ownJob,status:'SUCCESS',result:{syntheticSecret:'synthetic'}}),
   collection('jobs').doc(foreignJob).set({ownerUid:outsider,status:'SUCCESS',payload:{private:true}}),
   collection('jobResults').doc(foreignJob).set({jobId:foreignJob,result:{syntheticSecret:'other-user'}}),
   collection('jobResults').doc(orphanJob).set({jobId:orphanJob,result:{unbound:true}}),
   collection('jobResults').doc(taggedOrphanJob).set({jobId:taggedOrphanJob,ownerUid:owner,result:{private:'synthetic-tagged'}}),
   collection('jobs').doc(lateJob).set({ownerUid:owner,status:'RUNNING'}),
   collection('users').doc(owner).set({private:true})
  ]);
  await updateJobResult(lateJob,'SUCCESS',{syntheticResult:true});
  assert.equal((await collection('jobResults').doc(lateJob).get()).data().ownerUid,owner);
  checks.push('current result writer binds owner from authoritative job');
  await collection('jobs').doc(ownJob).collection('logs').doc('log1').set({private:'synthetic'});
  const result=await executeJobsScopedDelete(db,'r1618-test-delete-'+token,owner);
  assert.equal(result.jobsAnonymized,2);
  assert.equal(result.queueDeletes,1);
  assert.equal(result.jobResultDeletes,3);
  assert.equal(result.logDeletes,1);
  checks.push('deletion reports exact owner job queue result and log counts');
  for(const [col,id] of [['jobQueue',ownJob],['jobResults',ownJob]]){
    assert.equal((await collection(col).doc(id).get()).exists,false,col);
  }
  assert.equal((await collection('jobs').doc(ownJob).collection('logs').doc('log1').get()).exists,false);
  checks.push('owner linked result queue and logs actually deleted');
  const own=await collection('jobs').doc(ownJob).get();
  assert.ok(own.exists);
  assert.match(own.data().ownerUid,/^deleted:[0-9a-f]{64}$/);
  for(const key of ['payload','output','consent','consents','error'])assert.equal(own.data()[key],undefined,key);
  checks.push('owner job anonymized without leaking output');
  assert.equal((await collection('jobResults').doc(foreignJob).get()).exists,true);
  assert.equal((await collection('jobs').doc(foreignJob).get()).data().ownerUid,outsider);
  checks.push('other owner job and result untouched');
  assert.equal((await collection('jobResults').doc(taggedOrphanJob).get()).exists,false);
  checks.push('owner-tagged orphan result deleted with no parent');
  assert.equal((await collection('jobResults').doc(orphanJob).get()).exists,true);
  assert.ok(result.unresolvedDomains.includes('orphan-job-results-without-parent-job'));
  checks.push('unmatched orphan result remains explicitly unresolved not falsely certified');
  const u=(await collection('users').doc(owner).get()).data();
  assert.equal(u.dataRightsDeletionPendingCentralPrivacy,true);
  assert.notEqual(u.dataRightsDeletionRequestId,undefined);
  checks.push('central Privacy completion remains pending');
  await assert.rejects(
    updateJobResult(lateJob,'SUCCESS',{lateWrite:true}),
    /job_result_owner_unavailable/
  );
  assert.equal((await collection('jobResults').doc(lateJob).get()).exists,false);
  checks.push('late result writer cannot resurrect output after owner anonymization');
  const fencedJob='r1621-fenced-'+token;
  await collection('jobs').doc(fencedJob).set({ownerUid:owner,status:'RUNNING'});
  await collection('accountDeletionFences').doc(owner).set({uid:owner,active:true});
  await assert.rejects(updateJobResult(fencedJob,'SUCCESS',{lateWrite:true}),/job_result_owner_deletion_fenced/);
  assert.equal((await collection('jobResults').doc(fencedJob).get()).exists,false);
  await collection('jobs').doc(fencedJob).delete();
  await collection('accountDeletionFences').doc(owner).delete();
  checks.push('active deletion fence blocks future result creation');
  console.log('R1621_JOBS_OWNER_TAGGED_RESULT_DELETION_PASS '+JSON.stringify({checksPassed:checks.length,checks,scope:'jobs-only',globalDeletionCertified:false,privateMemoryWritesEnabled:false}));
 } finally {
  for(const [col,id] of [['jobs',ownJob],['jobs',foreignJob],['jobQueue',ownJob],['jobResults',ownJob],['jobResults',foreignJob],['jobResults',orphanJob],['jobResults',taggedOrphanJob],['jobResults',lateJob],['jobs',lateJob],['users',owner]]){
   await collection(col).doc(id).delete();
  }
  await collection('jobs').doc(ownJob).collection('logs').doc('log1').delete();
 }
})().catch(e=>{console.error('R1618_NATIVE_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>deleteApp(app));
