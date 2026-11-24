import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewSession,markCancellationRequested,recordCancellationResult,
 verifyCleanup,publicReviewState} from './gcs-resumable-session-retirement-review.mjs';
const ref={ownerUid:'owner1',tenantId:'tenant1',epoch:1,uploadId:'upload1'};
const secret='https://storage.googleapis.com/upload/storage/v1/b/bucket/o?upload_id=SECRET-resume-token';
const create=()=>createReviewSession({...ref,sessionUri:secret});
const bad=(fn,code)=>assert.throws(fn,e=>e.message===code);
const approved=(s,more={})=>({authentic:true,issuer:'approved-provider-verifier',
 ownerUid:s.ownerUid,tenantId:s.tenantId,epoch:s.epoch,uploadId:s.uploadId,
 sessionDigest:s.sessionDigest,providerState:'session-cancelled',...more});
const accept=x=>x;
test('accepts https storage host but no bearer credential in public state',()=>{
 const s=create(),p=publicReviewState(s);
 assert.equal(s.sessionDigest.length,64);
 assert.ok(!JSON.stringify(p).includes('SECRET-resume-token'));
 assert.ok(!JSON.stringify(s).includes('SECRET-resume-token'));
});
test('rejects wrong provider host and insecure session uri',()=>{
 bad(()=>createReviewSession({...ref,sessionUri:'http://storage.googleapis.com/a'}),'insecure_session_url');
 bad(()=>createReviewSession({...ref,sessionUri:'https://storage.googleapis.com.evil.example/a'}),'untrusted_session_host');
 bad(()=>createReviewSession({...ref,sessionUri:'https://example.com/a'}),'untrusted_session_host');
});
test('rejects credentials and fragment in URI',()=>{
 bad(()=>createReviewSession({...ref,sessionUri:'https://x:y@storage.googleapis.com/a'}),'invalid_session_url_authority');
 bad(()=>createReviewSession({...ref,sessionUri:secret+'#fragment'}),'invalid_session_url_authority');
});
test('owner or tenant cannot request cancellation',()=>{
 const s=create();
 bad(()=>markCancellationRequested(s,{...ref,ownerUid:'other'}),'owner_tenant_mismatch');
 bad(()=>markCancellationRequested(s,{...ref,tenantId:'other'}),'owner_tenant_mismatch');
});
test('stale epoch cannot request cancellation',()=>{
 const s=create();
 bad(()=>markCancellationRequested(s,{...ref,epoch:2}),'stale_writer_epoch');
});
test('wrong upload ID cannot request cancellation',()=>{
 const s=create();
 bad(()=>markCancellationRequested(s,{...ref,uploadId:'other'}),'upload_identity_mismatch');
});
test('cannot accept result before cancellation request',()=>{
 const s=create();
 bad(()=>recordCancellationResult(s,ref,{evidence:{},verify:accept}),'cancellation_not_requested');
});
test('cannot accept arbitrary client booleans without verifier',()=>{

 const s=create();markCancellationRequested(s,ref);
 bad(()=>recordCancellationResult(s,ref,{evidence:{authentic:true}}),'provider_verifier_missing');
});
test('wrong provider issuer or forged authenticity denied',()=>{
 const s=create();markCancellationRequested(s,ref);
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,{issuer:'client'}),verify:accept}),'provider_evidence_untrusted');
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,{authentic:false}),verify:accept}),'provider_evidence_untrusted');
});
test('wrong tenant, epoch, uploadId and session digest denied',()=>{
 const s=create();markCancellationRequested(s,ref);
 for(const change of [{tenantId:'other'},{epoch:3},{uploadId:'other'},{sessionDigest:'f'.repeat(64)}])
  bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,change),verify:accept}),'provider_evidence_untrusted');
});
test('ambiguous response cannot advance to cancelled',()=>{
 const s=create();markCancellationRequested(s,ref);
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,{providerState:'timeout'}),verify:accept}),'provider_cancel_ambiguous');
 assert.equal(publicReviewState(s).status,'unknown');
 bad(()=>verifyCleanup(s,ref,{evidence:approved(s),verify:accept}),'session_not_cancelled');
});
test('retry after ambiguous status requires explicit new cancellation request',()=>{
 const s=create();markCancellationRequested(s,ref);
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,{providerState:'unknown'}),verify:accept}),'provider_cancel_ambiguous');
 assert.equal(markCancellationRequested(s,ref).status,'cancellation-requested');
});
test('cancelled session is not fully drained until readback verified',()=>{
 const s=create();markCancellationRequested(s,ref);
 recordCancellationResult(s,ref,{evidence:approved(s),verify:accept});
 assert.equal(publicReviewState(s).verifiedAbsence,false);
 bad(()=>verifyCleanup(s,ref,{evidence:approved(s,{objectAbsentVerified:true}),verify:accept}),'provider_session_not_terminated');
});
test('cancelled session requires provider termination, generation cleanup and absence',()=>{
 const s=create();markCancellationRequested(s,ref);
 recordCancellationResult(s,ref,{evidence:approved(s),verify:accept});
 for(const missing of ['providerSessionTerminated','objectAbsentVerified','generationDeletedOrNeverCreated']){
  const evidence=approved(s,{providerSessionTerminated:true,objectAbsentVerified:true,generationDeletedOrNeverCreated:true,[missing]:false});

  const expected={providerSessionTerminated:'provider_session_not_terminated',objectAbsentVerified:'object_absence_unverified',generationDeletedOrNeverCreated:'generation_cleanup_unverified'}[missing];
  bad(()=>verifyCleanup(s,ref,{evidence,verify:accept}),expected);
 }
});
test('successful session cancellation with verified absence drains',()=>{
 const s=create();markCancellationRequested(s,ref);
 recordCancellationResult(s,ref,{evidence:approved(s),verify:accept});
 assert.equal(verifyCleanup(s,ref,{evidence:approved(s,{providerSessionTerminated:true,
  objectAbsentVerified:true,generationDeletedOrNeverCreated:true}),verify:accept}).status,'drained');
 assert.equal(publicReviewState(s).verifiedAbsence,true);
});
test('finished session requires actual generation and generation matching',()=>{
 const s=create();markCancellationRequested(s,ref);
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s,{providerState:'session-completed'}),verify:accept}),'generation_required');
 recordCancellationResult(s,ref,{evidence:approved(s,{providerState:'session-completed',generation:567}),verify:accept});
 const evidence=approved(s,{providerSessionTerminated:true,objectAbsentVerified:true,
  generationDeletedOrNeverCreated:true,verifiedGeneration:568});
 bad(()=>verifyCleanup(s,ref,{evidence,verify:accept}),'generation_mismatch');
 assert.equal(verifyCleanup(s,ref,{evidence:{...evidence,verifiedGeneration:567},verify:accept}).status,'drained');
});
test('completion cannot be recorded twice',()=>{
 const s=create();markCancellationRequested(s,ref);
 recordCancellationResult(s,ref,{evidence:approved(s),verify:accept});
 bad(()=>recordCancellationResult(s,ref,{evidence:approved(s),verify:accept}),'cancellation_not_requested');
});
test('no production GCS client or HTTP request in review module',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('./gcs-resumable-session-retirement-review.mjs',import.meta.url),'utf8');
 assert.ok(!code.includes('fetch(')&&!code.includes('createWriteStream'));
 assert.ok(!code.includes('@google-cloud/storage'));
});


