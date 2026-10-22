import test from 'node:test';
import assert from 'node:assert/strict';
import { assertChalkLocalEmulatorGate, buildChalkDiagnosticIntake, existingChalkIntakeMatches } from '../functions/src/jobs/chalkDiagnosticIntakeAuthority.ts';
const sha='a'.repeat(40);
const ownerUid='founder_1234';
const approvedEnv=()=>({FUNCTIONS_EMULATOR:'true', GCLOUD_PROJECT:'demo-urai-jobs',
 GOOGLE_CLOUD_PROJECT:'demo-urai-jobs', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', CHALK_NONPRODUCTION_INTAKE:'true'});
const input=()=>({requestId:'request_20261022_abc123',problem:'Chalk, the Life Map transition stutters.',
 diagnostic:{kind:'chalk-spatial-diagnostic-v1', repository:'LifeLoggerAI/urai-spatial',sourceSha:sha,
 component:'life-map',route:'/life-map',selectedStar:null,frameSamples:24,p95Ms:66.1,
 status:'LOCAL_UNSUBMITTED',authority:'client-observation-not-server-verified'}});
const build=(x=input(),trusted={ownerUid,pinnedSourceSha:sha})=>buildChalkDiagnosticIntake(x,trusted);
test('valid intake yields canonical master job HELD, no queue, no tools or spend',()=>{
 const r=build();assert.equal(r.jobId.length,38);assert.equal(r.status,'PENDING');
 assert.equal(r.admission.state,'HELD_UNQUEUED');assert.equal(r.admission.workerAdmitted,false);
 assert.equal(r.admission.providerSpendUsd,0);assert.equal('jobQueue' in r,false);
 assert.equal('allowedTools' in r,false);assert.equal('selectedStar' in r.payload.diagnostic,true);
 assert.equal(r.payload.diagnostic.selectedStar,null);
});
test('same request id/payload stays identical; changed request fails equality',()=>{
 const r=build();assert.deepEqual(build(),r);assert.equal(existingChalkIntakeMatches(structuredClone(r),r),true);
 const changed=input();changed.problem='Chalk, the Life Map has a different issue.';
 assert.equal(existingChalkIntakeMatches(r,build(changed)),false);
});
const bad = [
 ['untrusted repository',x=>x.diagnostic.repository='other/repo'],
 ['untrusted source',x=>x.diagnostic.sourceSha='f'.repeat(40)],
 ['unverified source',x=>x.diagnostic.sourceSha='unverified'],
 ['foreign scene',x=>x.diagnostic.route='/privacy'],
 ['component/route mismatch',x=>x.diagnostic.component='home'],
 ['personal memory reference',x=>x.diagnostic.selectedStar={id:'private-star'}],
 ['untrusted AI instruction',x=>x.diagnostic.tool='github.merge'],
 ['untrusted raw trace',x=>x.diagnostic.rawMedia='memory.jpg'],
 ['oversized samples',x=>x.diagnostic.frameSamples=1000],
 ['invented frame rate',x=>x.diagnostic.p95Ms=Infinity],
 ['missing telemetry',x=>x.diagnostic.p95Ms=null],
 ['invalid zero frame metric',x=>{x.diagnostic.frameSamples=0;x.diagnostic.p95Ms=10}],
 ['unknown state',x=>x.diagnostic.status='SUCCESS'],
 ['unknown authority',x=>x.diagnostic.authority='server-verified'],
 ['malicious request ID',x=>x.requestId='../overwrite'],
 ['too-short problem',x=>x.problem='bad'],
 ['control sequence',x=>x.problem='This is\u0000 a bad context'],
 ['extra instruction',x=>x.action='deploy'],
 ];
for(const [name,mutation] of bad)test('intake denies '+name,()=>{
 const x=input();mutation(x);assert.throws(()=>build(x),/CHALK_INTAKE_/);
});
for(const [name,mutation] of [
 ['production env',e=>e.FUNCTIONS_EMULATOR='false'],
 ['real cloud project',e=>e.GCLOUD_PROJECT='urai-jobs'],
 ['project mismatch',e=>e.GOOGLE_CLOUD_PROJECT='urai-4dc1d'],
 ['no explicit admission',e=>delete e.CHALK_NONPRODUCTION_INTAKE],
 ['nonlocal Firestore',e=>e.FIRESTORE_EMULATOR_HOST='evil.test:8080'],
 ['nonlocal Auth',e=>e.FIREBASE_AUTH_EMULATOR_HOST='evil.test:9099'],
 ])test('emulator guard denies '+name,()=>{
 const e=approvedEnv();mutation(e);assert.throws(()=>assertChalkLocalEmulatorGate(e),/CHALK_INTAKE_EMULATOR_ONLY/);
});
test('emulator guard explicitly accepts isolated local project',()=>assert.doesNotThrow(()=>assertChalkLocalEmulatorGate(approvedEnv())));
test('cannot reuse different owner or mutable terminal admission',()=>{
 const r=build();for(const patch of [{ownerUid:'other'}, {status:'SUCCESS'}, {admission:{state:'RUNNING',workerAdmitted:true}}])
  assert.equal(existingChalkIntakeMatches({...r,...patch},r),false);
});
