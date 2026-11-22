'use strict';
const { requireEmulatorContext } = require('./r1629-emulator-context.cjs');
const jobsRoot = requireEmulatorContext('jobs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {initializeApp,getApp,getApps,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[jobsRoot]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[jobsRoot]}));
const {processDataRightsRequest}=require(jobsRoot+'/lib/functions/privacy/dataRightsExecution.js');
const sha=v=>createHash('sha256').update(v).digest('hex');
assert.equal(process.env.URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE,'protected-staging');
assert.equal(process.env.URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT,process.env.GCLOUD_PROJECT);
assert.notEqual(process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED,'true');
const uid=process.argv[2],requestId=process.argv[3],jobId=process.argv[4],centralRequestId=process.argv[5];
assert.ok(uid&&requestId&&jobId&&centralRequestId);
const jobsApp=getApps().length ? getApp() : initializeApp();
const db=getFirestore();
(async()=>{
 const operatorUid='r1625-operator-'+sha(uid).slice(0,12);
 const idempotencyKey='r1625-idempotency-'+sha(requestId).slice(0,20);
 const receiptId='r1625-retention-'+sha(uid).slice(0,14);
 await db.collection('users').doc(operatorUid).set({role:'admin',uid:operatorUid});
 await db.collection('dataRightsRequests').doc(requestId).update({status:'APPROVED',executionState:'PENDING',retentionDecisionReceiptId:receiptId});
 await db.collection('jobs').doc(jobId).set({
   ownerUid:uid,status:'SUCCESS',payload:{synthetic:true},output:{private:'synthetic'},
 });
 await db.collection('jobResults').doc(jobId).set({
   ownerUid:uid,jobId,status:'SUCCESS',result:{private:'synthetic'},
 });
 const data={requestId,retentionDecisionReceiptId:receiptId,idempotencyKey};
 const context={auth:{uid:operatorUid,token:{uid:operatorUid,role:'admin'}}};
 const first=await processDataRightsRequest.run(data,context);
 assert.equal(first.replay,false);
 assert.equal(first.receipt.event,'DATA_RIGHTS_EXECUTION_FINISHED');
 assert.equal(first.receipt.requestType,'DELETE');
 const doc=(await db.collection('dataRightsRequests').doc(requestId).get()).data();
 assert.equal(doc.executionState,'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED');
 assert.equal(doc.status,'IN_REVIEW');
 assert.equal((await db.collection('jobResults').doc(jobId).get()).exists,false);
 const stored=(await db.doc(doc.executionReceiptPath).get()).data();
 assert.equal(stored.requestId,requestId);
 assert.equal(stored.resultDigest,first.receipt.resultDigest);
 assert.equal(stored.event,'DATA_RIGHTS_EXECUTION_FINISHED');
 const policy=require(jobsRoot+'/lib/functions/privacy/dataRightsReplayPolicy.js');
 const bind={requestId,ownerUid:uid,requestType:'DELETE'};
 console.log('R1625_AUDIT_DIAG',JSON.stringify({
  policyPass:policy.isCompletedDataRightsReplayReceipt(stored,bind),
  auditKeys:Object.keys(stored),
  rowState:doc.executionState,rowStatus:doc.status,
  auditState:stored.terminalState,auditEvent:stored.event,
  auditRequestId:stored.requestId,
  ownerMatches:stored.ownerHash===sha(uid),
  digestMatches:stored.resultDigest===sha(JSON.stringify(stored.result)),
  digest:stored.resultDigest,
  actualResultDigest:sha(JSON.stringify(stored.result)),
  firstReceiptDigest:first.receipt.resultDigest,
  firstReceiptResultKeys:Object.keys(first.receipt.result||{})
 }));
 assert.equal(policy.isCompletedDataRightsReplayReceipt(stored,bind),true,'Persisted terminal receipt must be canonical and replay-eligible');
 const replay=await processDataRightsRequest.run(data,context);
 assert.equal(replay.replay,true);
 assert.equal(replay.receipt.resultDigest,stored.resultDigest);
 console.log('R1625_REAL_JOBS_HANDLER_PASS',JSON.stringify({
  ownerHash:stored.ownerHash,requestId,sourceReceiptPath:doc.executionReceiptPath,
  resultDigest:stored.resultDigest,terminalState:doc.executionState,
  jobsAnonymized:stored.result.jobsAnonymized,jobResultDeletes:stored.result.jobResultDeletes,
  resultSource:'compiled processDataRightsRequest.run',replayIdempotent:true
 }));
})().catch(e=>{console.error('R1625_REAL_JOBS_HANDLER_FAIL',e.stack||e);process.exitCode=1})
.finally(async()=>{await deleteApp(jobsApp)});
