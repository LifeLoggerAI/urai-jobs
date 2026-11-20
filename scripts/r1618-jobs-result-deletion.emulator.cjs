'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[path.join(__dirname,'../functions')]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[path.join(__dirname,'../functions')]}));
const {executeJobsScopedDelete}=require('../functions/lib/functions/privacy/dataRightsExecution.js');
assert.equal(process.env.GCLOUD_PROJECT,'urai-jobs-r1618-disposable');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18180');
for(const k of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GITHUB_TOKEN','RUNPOD_API_KEY'])assert.equal(process.env[k],undefined);
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'r1618-jobs-synthetic');
(async()=>{
 const db=getFirestore(app),token=randomBytes(5).toString('hex');
 const owner='r1618-owner-'+token,outsider='r1618-outsider-'+token;
 const ownJob='r1618-job-'+token,foreignJob='r1618-other-'+token;
 const orphanJob='r1618-orphan-'+token,checks=[];
 const collection=name=>db.collection(name);
 try{
  await Promise.all([
   collection('jobs').doc(ownJob).set({ownerUid:owner,status:'SUCCESS',payload:{private:true},output:{signedMediaUrl:'synthetic-only'}}),
   collection('jobQueue').doc(ownJob).set({private:true}),
   collection('jobResults').doc(ownJob).set({jobId:ownJob,status:'SUCCESS',result:{syntheticSecret:'synthetic'}}),
   collection('jobs').doc(foreignJob).set({ownerUid:outsider,status:'SUCCESS',payload:{private:true}}),
   collection('jobResults').doc(foreignJob).set({jobId:foreignJob,result:{syntheticSecret:'other-user'}}),
   collection('jobResults').doc(orphanJob).set({jobId:orphanJob,result:{unbound:true}}),
   collection('users').doc(owner).set({private:true})
  ]);
  await collection('jobs').doc(ownJob).collection('logs').doc('log1').set({private:'synthetic'});
  const result=await executeJobsScopedDelete(db,'r1618-test-delete-'+token,owner);
  assert.equal(result.jobsAnonymized,1);
  assert.equal(result.queueDeletes,1);
  assert.equal(result.jobResultDeletes,1);
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
  assert.equal((await collection('jobResults').doc(orphanJob).get()).exists,true);
  assert.ok(result.unresolvedDomains.includes('orphan-job-results-without-parent-job'));
  checks.push('unmatched orphan result remains explicitly unresolved not falsely certified');
  const u=(await collection('users').doc(owner).get()).data();
  assert.equal(u.dataRightsDeletionPendingCentralPrivacy,true);
  assert.notEqual(u.dataRightsDeletionRequestId,undefined);
  checks.push('central Privacy completion remains pending');
  console.log('R1618_JOBS_SCOPE_RESULT_DELETION_NATIVE_PASS '+JSON.stringify({checksPassed:checks.length,checks,scope:'jobs-only',globalDeletionCertified:false,privateMemoryWritesEnabled:false}));
 } finally {
  for(const [col,id] of [['jobs',ownJob],['jobs',foreignJob],['jobQueue',ownJob],['jobResults',ownJob],['jobResults',foreignJob],['jobResults',orphanJob],['users',owner]]){
   await collection(col).doc(id).delete();
  }
  await collection('jobs').doc(ownJob).collection('logs').doc('log1').delete();
 }
})().catch(e=>{console.error('R1618_NATIVE_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>deleteApp(app));
