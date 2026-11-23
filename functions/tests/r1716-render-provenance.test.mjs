import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProtectedMemoryRenderProvenance as check} from '../src/jobs/studioMemoryProvenanceRead.ts';
const digest='a'.repeat(64),receipt='b'.repeat(64);
const fixture=()=>({
 verifiedOwnerUid:'ownerA',verifiedTenantId:'tenantA',
 selectedMemoryId:'memoryA',selectedManifestId:'manifestA',selectedManifestVersion:1,
 ownerDeletionFenced:false,
 protectedBinding:{source:'jobs-protected-record',ownerUid:'ownerA',tenantId:'tenantA',
 jobId:'job_12345678901',memoryId:'memoryA',replayManifestId:'manifestA',manifestVersion:1,
 renderPlanDigest:digest,decisionReceiptId:receipt,revoked:false},
 currentJobsReadback:{sourceSystem:'urai-studio',ownerUid:'ownerA',tenantId:'tenantA',
 jobId:'job_12345678901',jobType:'studio.render.video',status:'SUCCESS',
 consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:receipt},
 output:{renderPlanDigest:digest},outputDeletedAt:null}
});
test('synthetic consistent fixture returns no media, identifiers, or authority',()=>{
 const v=fixture(),before=JSON.stringify(v);
 assert.deepEqual(check(v),{status:'consistent'});
 assert.equal(JSON.stringify(v),before);
});
const cases=[
 ['absent binding',v=>v.protectedBinding=null],['reduced Jobs projection',v=>v.currentJobsReadback={status:'SUCCESS'}],
 ['wrong owner',v=>v.verifiedOwnerUid='other'],['wrong tenant',v=>v.verifiedTenantId='other'],
 ['wrong selected memory',v=>v.selectedMemoryId='other'],['wrong selected manifest',v=>v.selectedManifestId='other'],
 ['wrong manifest version',v=>v.selectedManifestVersion=2],['deletion fenced',v=>v.ownerDeletionFenced=true],
 ['missing deletion proof',v=>v.ownerDeletionFenced=null],['wrong binding issuer',v=>v.protectedBinding.source='public'],
 ['revoked binding',v=>v.protectedBinding.revoked=true],['bound wrong owner',v=>v.protectedBinding.ownerUid='other'],
 ['bound wrong tenant',v=>v.protectedBinding.tenantId='other'],['bound wrong memory',v=>v.protectedBinding.memoryId='other'],
 ['bound wrong manifest',v=>v.protectedBinding.replayManifestId='other'],
 ['bad bound job',v=>v.protectedBinding.jobId='../bad'],['changed render digest',v=>v.protectedBinding.renderPlanDigest='c'.repeat(64)],
 ['bad consent receipt',v=>v.protectedBinding.decisionReceiptId='invalid'],
 ['job wrong owner',v=>v.currentJobsReadback.ownerUid='other'],['job wrong tenant',v=>v.currentJobsReadback.tenantId='other'],
 ['job wrong identifier',v=>v.currentJobsReadback.jobId='other_12345678901'],['job pending',v=>v.currentJobsReadback.status='PENDING'],
 ['job failed',v=>v.currentJobsReadback.status='FAILED'],['output deleted',v=>v.currentJobsReadback.outputDeletedAt='now'],
 ['job wrong type',v=>v.currentJobsReadback.jobType='other'],['job wrong source',v=>v.currentJobsReadback.sourceSystem='other'],
 ['job missing consent',v=>v.currentJobsReadback.consent=null],
 ['consent mismatched',v=>v.currentJobsReadback.consent.decisionReceiptId='c'.repeat(64)],
 ['consent wrong purpose',v=>v.currentJobsReadback.consent.purpose='other'],
 ['consent old version',v=>v.currentJobsReadback.consent.policyVersion='0'],
 ['missing output',v=>v.currentJobsReadback.output=null],
 ['output digest changed',v=>v.currentJobsReadback.output.renderPlanDigest='c'.repeat(64)],
];
for(const [label,mutate] of cases)test('deny '+label,()=>{
 const v=fixture();mutate(v);assert.deepEqual(check(v),{status:'unavailable'});
});
