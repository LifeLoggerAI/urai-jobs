'use strict';
const { requireEmulatorContext } = require('./r1629-emulator-context.cjs');
const jobsDep = requireEmulatorContext('privacy');
const assert=require('node:assert/strict');
const {randomBytes,createHash,generateKeyPairSync}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,signInWithCustomToken}=require('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
const {initializeApp:adminInit,deleteApp:adminDelete,cert}=require(require.resolve('firebase-admin/app',{paths:[jobsDep]}));
const {getAuth:adminAuth}=require(require.resolve('firebase-admin/auth',{paths:[jobsDep]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[jobsDep]}));
const project='urai-privacy-r1512-disposable';
assert.equal(process.env.URAI_JOBS_PRIVACY_DELETION_SERVICE_UID,'r1622-jobs-service');
const sha=s=>createHash('sha256').update(s).digest('hex');
const hash=v=>sha(JSON.stringify(v));
const nonce=randomBytes(5).toString('hex'),uid='r1622-owner-'+nonce;
const idempotencyKey='r1629-owner-'+nonce;
const jobsRequestId=sha(JSON.stringify([uid,idempotencyKey]));
let centralRequestId='';
const conflictingId='r1627-conflict-'+nonce;
const executionId='execution-'+sha(JSON.stringify('r1625-idempotency-'+sha(jobsRequestId).slice(0,20))).slice(0,24);
const key=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const sdk=adminInit({projectId:project,credential:cert({projectId:project,clientEmail:'r1622-only@'+project+'.iam.gserviceaccount.com',privateKey:key.privateKey})});
const app=initializeApp({projectId:project,apiKey:'disposable-only',appId:'1:1622:web:emulator'},'r1622-client-'+nonce);
const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const fn=getFunctions(app,'us-central1');connectFunctionsEmulator(fn,'127.0.0.1',5001);
const db=getFirestore(sdk);
const jobsApp=adminInit({projectId:'urai-jobs-r1624-disposable'},'r1624-source-'+nonce);
const jobsDb=getFirestore(jobsApp);
const checks=[];
const check=(name)=>{checks.push(name);console.log('R1629_PASS',name)};
const bind=(payload)=>httpsCallable(fn,'authorizeJobsDeletionBinding',{timeout:30000})(payload);
const invoke=(payload)=>httpsCallable(fn,'recordJobsDeletionParticipantEvidence',{timeout:30000})(payload);
const reject=async(payload,code)=>assert.rejects(invoke(payload),e=>{assert.equal(e.code,'functions/'+code);return true;});
async function main(){
const ownerToken=await adminAuth(sdk).createCustomToken(uid,{role:'user'});
await signInWithCustomToken(auth,ownerToken);
const createdPrivacy=(await httpsCallable(fn,'createDeletionRequest',{timeout:30000})({
 reason:'Synthetic owner-requested account deletion for R1629 verification'
})).data;
centralRequestId=createdPrivacy.requestId;
assert.equal(createdPrivacy.status,'pending');
const canonicalOwner=(await db.collection('deletionRequests').doc(centralRequestId).get()).data();
assert.equal(canonicalOwner.uid,uid);
assert.equal(canonicalOwner.scope,'account');
assert.ok(canonicalOwner.createdAt);
check('actual_authenticated_owner_created_Privacy_account_deletion_request');
const submit=spawnSync(process.execPath,[
 require.resolve('./r1629-owner-jobs-submission.cjs'),uid,idempotencyKey
],{env:{...process.env,GCLOUD_PROJECT:'urai-jobs-r1624-disposable',
 GOOGLE_CLOUD_PROJECT:'urai-jobs-r1624-disposable',
 FIREBASE_CONFIG:JSON.stringify({projectId:'urai-jobs-r1624-disposable'})},
 encoding:'utf8',timeout:45000});
assert.equal(submit.status,0,'Owner Jobs submission failed: '+submit.stderr+' '+submit.stdout);
const lineSubmit=submit.stdout.split('\n').find(x=>x.startsWith('R1629_JOBS_OWNER_SUBMISSION_PASS '));
assert.ok(lineSubmit,'Owner Jobs handler receipt missing');
const ownerSubmitted=JSON.parse(lineSubmit.slice('R1629_JOBS_OWNER_SUBMISSION_PASS '.length));
assert.equal(ownerSubmitted.requestId,jobsRequestId);
assert.equal(ownerSubmitted.status,'PENDING');
check('actual_authenticated_owner_submitted_Jobs_DELETE_and_audit_created');
const seedJob=jobsDb.collection('dataRightsRequests').doc(jobsRequestId);
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/permission-denied');return true;
});
check('owner_cannot_issue_admin_binding');
const adminToken=await adminAuth(sdk).createCustomToken('r1627-admin-'+nonce,{admin:true,role:'admin'});
await signInWithCustomToken(auth,adminToken);
// Fixture-only isolated approval state; this is not a production signer.
await db.collection('deletionRequests').doc(centralRequestId).update({status:'processing'});
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('owner_Jobs_request_cannot_be_bound_before_approval');
await seedJob.update({status:'APPROVED',executionState:'PENDING'});
check('synthetic_admin_approval_fixture_is_not_verified_real_approval');

await seedJob.update({ownerUid:'r1627-foreign-'+nonce});
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('Privacy_binding_cross_owner_source_denied');
await seedJob.update({ownerUid:uid,status:'IN_REVIEW'});
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('Privacy_binding_nonapproved_Jobs_request_denied');
await seedJob.update({status:'APPROVED',executionState:'PROTECTED_STAGING_EXECUTION_IN_PROGRESS'});
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('Privacy_binding_started_execution_denied');
await seedJob.update({executionState:'PENDING'});
const submittedRef=seedJob.collection('audit').doc('submitted');
const genuineSubmission=(await submittedRef.get()).data();
assert.ok(genuineSubmission);
await submittedRef.delete();
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('missing_original_Jobs_owner_submission_audit_denied');
await submittedRef.set(genuineSubmission);
await db.collection('deletionRequests').doc(centralRequestId).update({scope:'other'});
await assert.rejects(bind({centralRequestId,jobsRequestId}),e=>{
 assert.equal(e.code,'functions/failed-precondition');return true;
});
check('non_account_Privacy_request_scope_denied');
await db.collection('deletionRequests').doc(centralRequestId).update({scope:'account'});
const created=(await bind({centralRequestId,jobsRequestId})).data;
assert.equal(created.authorized,true);assert.equal(created.idempotent,false);
assert.equal(created.globalDeletionComplete,false);
check('Privacy_admin_issued_immutable_canonical_Jobs_binding');
const repeated=(await bind({centralRequestId,jobsRequestId})).data;
assert.equal(repeated.idempotent,true);check('Privacy_binding_exact_replay_idempotent');

await jobsDb.collection('dataRightsRequests').doc(conflictingId).set({
 requestId:conflictingId,ownerUid:uid,requestType:'DELETE',status:'APPROVED',executionState:'PENDING',createdAt:new Date()
});
await jobsDb.collection('dataRightsRequests').doc(conflictingId).collection('audit').doc('submitted').set({
 event:'DATA_RIGHTS_REQUEST_SUBMITTED',actorUid:uid,status:'PENDING',createdAt:new Date()
});
await assert.rejects(bind({centralRequestId,jobsRequestId:conflictingId}),e=>{
 assert.equal(e.code,'functions/already-exists');return true;
});
check('Privacy_binding_conflicting_second_Jobs_request_denied');
const jobId='r1625-job-'+nonce;
const worker=spawnSync(process.execPath,[
 require.resolve('./r1629-jobs-handler-worker.cjs'),
 uid,jobsRequestId,jobId,centralRequestId
],{
 env:{...process.env,GCLOUD_PROJECT:'urai-jobs-r1624-disposable',
 GOOGLE_CLOUD_PROJECT:'urai-jobs-r1624-disposable',
 FIREBASE_CONFIG:JSON.stringify({projectId:'urai-jobs-r1624-disposable'}),
 URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE:'protected-staging',
 URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT:'urai-jobs-r1624-disposable',
 URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED:''},
 encoding:'utf8',timeout:45000
});
assert.equal(worker.status,0,'Actual Jobs handler failed: '+worker.stderr+' '+worker.stdout);
const line=worker.stdout.split('\n').find(x=>x.startsWith('R1625_REAL_JOBS_HANDLER_PASS '));
assert.ok(line,'Missing actual Jobs executor terminal result: '+worker.stdout);
const execution=JSON.parse(line.slice('R1625_REAL_JOBS_HANDLER_PASS '.length));
assert.equal(execution.resultSource,'compiled processDataRightsRequest.run');
assert.ok(execution.replayIdempotent);
assert.equal(execution.jobsAnonymized,1);
assert.equal(execution.jobResultDeletes,1);
check('protected_Jobs_handler_wrote_actual_terminal_audit_and_replayed_idempotently');
const sourcePath=execution.sourceReceiptPath;
const sourceDoc=(await jobsDb.doc(sourcePath).get());
assert.equal(sourceDoc.exists,true);
const stored=sourceDoc.data();
assert.equal(stored.event,'DATA_RIGHTS_EXECUTION_FINISHED');
assert.equal(stored.resultDigest,execution.resultDigest);
assert.equal(stored.ownerHash,sha(uid));
const receipt=Object.fromEntries(['schemaVersion','event','requestId','requestType','ownerHash','resultDigest','terminalState','result'].map(k=>[k,stored[k]]));
check('independent_jobs_firestore_audit_read_matches_real_handler_receipt');
const result=receipt.result;
const payload={centralRequestId,jobsRequestId,receipt};
await auth.signOut();
await reject(payload,'permission-denied');check('anonymous_cannot_submit_deletion_evidence');
await jobsDb.doc(sourcePath).delete();
const token=await adminAuth(sdk).createCustomToken('r1622-jobs-service',{system:true,role:'system',consumerId:'urai-jobs'});
await signInWithCustomToken(auth,token);
await reject(payload,'failed-precondition');check('missing_independent_jobs_origin_denied');
await jobsDb.doc(sourcePath).set(receipt);
const nativeDispatch=spawnSync(process.execPath,[
 require.resolve('./r1629-jobs-delivery-worker.cjs'),
 uid,jobsRequestId,centralRequestId
],{env:{...process.env,GCLOUD_PROJECT:'urai-jobs-r1624-disposable',
 GOOGLE_CLOUD_PROJECT:'urai-jobs-r1624-disposable',
 FIREBASE_CONFIG:JSON.stringify({projectId:'urai-jobs-r1624-disposable'}),
 URAI_JOBS_DELETION_PRIVACY_PROJECT:'urai-privacy-r1512-disposable',
 URAI_JOBS_DELETION_PRIVACY_CALLABLE_URL:'http://127.0.0.1:5001/urai-privacy-r1512-disposable/us-central1/recordJobsDeletionParticipantEvidence',
 URAI_JOBS_DELETION_TEST_ID_TOKEN:await auth.currentUser.getIdToken()},
 encoding:'utf8',timeout:40000});
assert.equal(nativeDispatch.status,0,'Actual Jobs dispatch failed: '+nativeDispatch.stderr+' '+nativeDispatch.stdout);
const lineDispatch=nativeDispatch.stdout.split('\n').find(line=>line.startsWith('R1626_JOBS_DELIVERY_PASS '));
assert.ok(lineDispatch,'No native Jobs delivery receipt');
const delivered=JSON.parse(lineDispatch.slice('R1626_JOBS_DELIVERY_PASS '.length));
const deniedLine=nativeDispatch.stdout.split('\n').find(line=>line.startsWith('R1626_DELIVERY_NEGATIVE_PASS '));
assert.ok(deniedLine,'Jobs dispatch strict destination and central-link negative checks missing');
const denied=JSON.parse(deniedLine.slice('R1626_DELIVERY_NEGATIVE_PASS '.length));
assert.equal(denied.checks,4);
for(const [label,passed] of [['unapproved_destination_denied',denied.hostDenied],
 ['cross_project_destination_denied',denied.crossProjectDenied],
 ['missing_canonical_central_link_denied',denied.missingCentralLinkDenied],
 ['foreign_jobs_request_denied',denied.foreignRequestDenied]]) {
 assert.equal(passed,true);check(label);
}

assert.equal(delivered.globalDeletionComplete,false);
check('actual_Jobs_backend_POST_to_authenticated_Privacy_callable');
const answer=(await invoke(payload)).data;
assert.equal(answer.accepted,true);assert.equal(answer.globalDeletionComplete,false);
assert.equal(answer.acknowledgmentState,'evidence-received-verification-pending');
check('Jobs_custom_service_identity_delivered_owner_bound_evidence');
const replay=(await invoke(payload)).data;
assert.equal(replay.idempotent,true);check('exact_replay_is_idempotent');
await reject({...payload,receipt:{...receipt,ownerHash:sha('other')}},'failed-precondition');
check('cross_owner_receipt_denied');
await reject({...payload,receipt:{...receipt,resultDigest:sha('forged')}},'failed-precondition');
check('forged_result_digest_denied');
await reject({...payload,jobsRequestId:'r1622-other-'+nonce},'failed-precondition');
check('mismatched_jobs_request_denied');
await reject({...payload,receipt:{...receipt,resultDigest:hash({...result,jobsAnonymized:999}),result:{...result,jobsAnonymized:999}}},'failed-precondition');
check('conflicting_valid_digest_replay_is_rejected_immutably');
await db.collection('deletionRequests').doc(centralRequestId).update({status:'completed',deletionCompletionVerified:true});
await reject(payload,'failed-precondition');
check('globally_completed_request_cannot_accept_new_jobs_evidence');
await db.collection('deletionRequests').doc(centralRequestId).update({status:'processing',deletionCompletionVerified:false});
await jobsDb.doc(sourcePath).update({resultDigest:sha('tampered-origin')});
await reject(payload,'failed-precondition');
check('mutated_independent_origin_denied');
await jobsDb.doc(sourcePath).set(receipt);
await jobsDb.collection('dataRightsRequests').doc(jobsRequestId).update({ownerUid:'other-'+nonce});
await reject(payload,'failed-precondition');check('source_request_cross_owner_denied');
await jobsDb.collection('dataRightsRequests').doc(jobsRequestId).update({ownerUid:uid,executionState:'PROTECTED_STAGING_EXECUTION_IN_PROGRESS'});
await reject(payload,'failed-precondition');check('unfinished_source_execution_denied');
await jobsDb.collection('dataRightsRequests').doc(jobsRequestId).update({
 executionState:receipt.terminalState, executionReceiptPath:'dataRightsRequests/'+jobsRequestId+'/audit/forged-path'
});
await reject(payload,'failed-precondition');check('source_audit_path_spoof_denied');
await jobsDb.collection('dataRightsRequests').doc(jobsRequestId).update({executionReceiptPath:sourcePath});
const strangerToken=await adminAuth(sdk).createCustomToken('r1622-untrusted-'+nonce,{system:true,role:'system',consumerId:'urai-jobs'});
await signInWithCustomToken(auth,strangerToken);
await reject(payload,'permission-denied');
check('wrong_pinned_system_uid_denied');
const evidence=(await db.collection('deletionRequests').doc(centralRequestId).collection('participantEvidence').doc('urai-jobs').get()).data();
assert.equal(evidence.globalDeletionComplete,false);
assert.equal(evidence.originVerificationState,'independent-source-readback-matched');
assert.equal(evidence.sourceProject,'urai-jobs-r1624-disposable');
assert.equal(evidence.acknowledgmentState,'evidence-received-verification-pending');
assert.equal((await db.collection('deletionRequests').doc(centralRequestId).get()).data().status,'processing');
check('actual_firestore_receipt_persists_without_global_completion');
console.log('R1629_OWNER_REQUEST_PROVENANCE_PASS',JSON.stringify({checks:checks.length,globalDeletionCertified:false,source:'compiled-protected-Jobs-handler-and-authenticated-Privacy-callable'}));
}
main().catch(e=>{console.error('R1629_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>{
for(const path of ['deletionRequests/'+centralRequestId+'/participantBindings/urai-jobs','deletionRequests/'+centralRequestId+'/participantEvidence/urai-jobs','deletionRequests/'+centralRequestId,'jobs/r1622-job-'+nonce,'jobResults/r1622-job-'+nonce,'users/'+uid])await db.doc(path).delete().catch(()=>{});
for(const path of ['dataRightsRequests/'+conflictingId+'/audit/submitted','dataRightsRequests/'+conflictingId,'dataRightsRequests/'+jobsRequestId+'/audit/submitted','dataRightsRequests/'+jobsRequestId+'/delivery/privacy-evidence','dataRightsRequests/'+jobsRequestId+'/audit/'+executionId,'dataRightsRequests/'+jobsRequestId,'jobs/r1622-job-'+nonce,'jobResults/r1622-job-'+nonce,'users/'+uid,'users/r1625-operator-'+sha(uid).slice(0,12)])await jobsDb.doc(path).delete().catch(()=>{});
await deleteApp(app);await adminDelete(jobsApp);await adminDelete(sdk);
});
