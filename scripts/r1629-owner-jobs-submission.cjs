'use strict';
const assert=require('node:assert/strict');
const root='/workspace/r1629-jobs-owner-origin-review/functions';
const {getApps,getApp,initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[root]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[root]}));
const {submitDataRightsRequest}=require(root+'/lib/functions/privacy/dataRights.js');
const [uid,idempotencyKey]=process.argv.slice(2);
assert.ok(uid && idempotencyKey);
assert.equal(process.env.GCLOUD_PROJECT,'urai-jobs-r1624-disposable');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
const app=getApps().length?getApp():initializeApp({projectId:process.env.GCLOUD_PROJECT});
const db=getFirestore(app);
(async()=>{
 await db.collection('users').doc(uid).set({uid,role:'user',synthetic:true});
 const context={auth:{uid,token:{uid}}};
 const first=await submitDataRightsRequest.run({requestType:'DELETE',idempotencyKey},context);
 assert.equal(first.status,'PENDING');
 assert.equal(first.executionState,'PROTECTED_STAGING_EXECUTOR_SOURCE_READY_HARD_OFF');
 const same=await submitDataRightsRequest.run({requestType:'DELETE',idempotencyKey},context);
 assert.equal(same.requestId,first.requestId);
 const ref=db.collection('dataRightsRequests').doc(first.requestId);
 const row=(await ref.get()).data();
 const receipt=(await ref.collection('audit').doc('submitted').get()).data();
 assert.equal(row.ownerUid,uid);assert.equal(row.requestType,'DELETE');
 assert.equal(receipt.actorUid,uid);assert.equal(receipt.event,'DATA_RIGHTS_REQUEST_SUBMITTED');
 console.log('R1629_JOBS_OWNER_SUBMISSION_PASS',JSON.stringify({
  requestId:first.requestId,status:row.status,executionState:row.executionState,
  ownerSubmittedAudit:true,idempotent:true
 }));
})().catch(e=>{console.error('R1629_JOBS_OWNER_SUBMISSION_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>deleteApp(app));
