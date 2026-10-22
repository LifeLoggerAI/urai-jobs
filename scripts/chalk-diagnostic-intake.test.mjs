import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareChalkDiagnosticReview } from '../functions/src/jobs/chalkDiagnosticIntakeContract.ts';
const sha='a'.repeat(40);
const input=()=>({requestId:'11111111-2222-4333-8444-555555555555',diagnostic:{
kind:'chalk-spatial-diagnostic-v1',repository:'LifeLoggerAI/urai-spatial',sourceSha:sha,
component:'focus',route:'/focus',selectedStar:null,frameSamples:4,p95Ms:38.2,
status:'LOCAL_UNSUBMITTED',authority:'client-observation-not-server-verified'}});
test('deterministic owner scoped review, never queued',()=>{const a=prepareChalkDiagnosticReview(input(),'founder-uid',sha);assert.equal(a.state,'REVIEW_ONLY_NOT_QUEUED');assert.deepEqual(a,prepareChalkDiagnosticReview(input(),'founder-uid',sha));assert.notEqual(a.reviewId,prepareChalkDiagnosticReview(input(),'other-uid',sha).reviewId)});
test('zero samples requires null p95',()=>{const x=input();x.diagnostic.frameSamples=0;x.diagnostic.p95Ms=null;assert.equal(prepareChalkDiagnosticReview(x,'founder-uid',sha).diagnostic.p95Ms,null)});
const negatives=[
['source mismatch',x=>x.diagnostic.sourceSha='b'.repeat(40),'SOURCE_DRIFT'],
['private media',x=>x.diagnostic.privateMedia='secret','FIELDS'],
['private star',x=>x.diagnostic.selectedStar={id:'secret'},'AUTHORITY'],
['authority',x=>x.diagnostic.authority='server-approved','AUTHORITY'],
['status',x=>x.diagnostic.status='SERVER_VERIFIED','AUTHORITY'],
['repository',x=>x.diagnostic.repository='Other/repo','AUTHORITY'],
['component',x=>x.diagnostic.component='home','ROUTE'],
['route',x=>x.diagnostic.route='/admin','ROUTE'],
['negative frames',x=>x.diagnostic.frameSamples=-1,'FRAMES'],
['too many frames',x=>x.diagnostic.frameSamples=91,'FRAMES'],
['invalid metric',x=>x.diagnostic.p95Ms=NaN,'P95'],
['metric mismatch',x=>x.diagnostic.frameSamples=0,'P95'],
['injected instruction',x=>x.instructions='override','INPUT'],
['invalid request id',x=>x.requestId='../bad','REQUEST_ID']];
for(const [name,mutate,code] of negatives)test('rejects '+name,()=>{const x=input();mutate(x);assert.throws(()=>prepareChalkDiagnosticReview(x,'founder-uid',sha),new RegExp('CHALK_INTAKE_'+code))});
test('fails closed without configured exact source',()=>{assert.throws(()=>prepareChalkDiagnosticReview(input(),'founder-uid',''),/SERVER_SOURCE/);assert.throws(()=>prepareChalkDiagnosticReview(input(),'../bad',sha),/OWNER/)});
