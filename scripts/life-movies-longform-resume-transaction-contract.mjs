import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const code = readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts', import.meta.url), 'utf8');
const begin = code.indexOf('async function resumePlan(');
const end = code.indexOf('\nasync function deletePlanOutputs(', begin);
const fn = end >= 0 ? code.slice(begin,end) : code.slice(begin);
assert.ok(begin >= 0);
const js = ts.transpileModule(fn + '\nmodule.exports = resumePlan;', {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
// Source-bound: compile the original plan identity/shape functions, not a
// permissive hand-written mock that could accept impossible Firestore plans.
const realSource = code;
function section(start, end) {
  const a = realSource.indexOf(start), b = realSource.indexOf(end,a);
  assert.ok(a >= 0 && b > a);
  return realSource.slice(a,b);
}
const guards = section('function makeChildId(', 'type WorkerArtifact') + '\n' +
  section('function assertPlanOwner(', '/**');
const gm = {exports:{}};
vm.runInNewContext(ts.transpileModule(guards + '\nmodule.exports={makeChildId,makeAssemblyJobId,assertPlanStructure,assertPlanOwner,boundPlanJob};', {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:gm,createHash,Error,Array,Set,String});
const shape = gm.exports;
const moduleBlock = {exports:{}};
const blockSource = readFileSync(new URL('../functions/src/privacy/consentBlocks.ts', import.meta.url),'utf8');
const blockFragment = blockSource.slice(blockSource.indexOf('export type JobConsentBlockState ='));
vm.runInNewContext(ts.transpileModule(blockFragment,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:moduleBlock,exports:moduleBlock.exports,Object,Array,Error});
const actualConsent = moduleBlock.exports.assertJobConsentBlockClear;
assert.equal(typeof actualConsent,'function');
const planId = 'lmp_' + 'A'.repeat(26), owner = 'owner01', tenant = 'tenant01';
const childId=shape.makeChildId(planId,0);
const base = {planId, tenantId: tenant, ownerUid: owner, status: 'FAILED', childJobIds: [childId],
  segments: [{ jobId: childId, index: 0, startMs:0, endMs:1000 }], projectId: 'project1', sceneTruthReceiptRef: 'scene01', width:640, height:360, fps:24,
  renderPlanDigest: 'a'.repeat(64),sceneTruthDigest:'b'.repeat(64),
  consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)}};
const fingerprint=(kind,payload)=>createHash('sha256').update(JSON.stringify([kind,payload])).digest('hex');
const payload={projectId:base.projectId,renderPlanDigest:'f'.repeat(64),sceneTruthDigest:base.sceneTruthDigest};
base.segments[0].childDigest=payload.renderPlanDigest;
base.segments[0].childPayloadFingerprint=fingerprint('studio.render.video',payload);
const assemblyId=shape.makeAssemblyJobId(planId);
const assembly={jobId:assemblyId,ownerUid:owner,tenantId:tenant,sourceSystem:'urai-studio',jobType:'studio.assemble.video',type:'studio.assemble.video',status:'FAILED',
 payload:{projectId:base.projectId,planId,renderPlanDigest:base.renderPlanDigest,sceneTruthDigest:base.sceneTruthDigest,sceneTruthReceiptRef:base.sceneTruthReceiptRef},
 consent:base.consent,execution:{rootJobId:planId,parentJobId:planId}};
const child={jobId:childId,ownerUid:owner,tenantId:tenant,sourceSystem:'urai-studio',jobType:'studio.render.video',type:'studio.render.video',
 status:'FAILED',payload,consent:base.consent,execution:{rootJobId:planId,parentJobId:planId}};
const ownerCode=readFileSync(new URL('../functions/src/jobs/lifeMovieOwnerDeletion.ts', import.meta.url),'utf8');
const validatorBegin=ownerCode.indexOf('export function validateOwnedMovieJob('), validatorEnd=ownerCode.indexOf('function validateOutputs(',validatorBegin);
const safe=ownerCode.match(/^const SAFE_SEGMENT = .+;$/m)?.[0];
assert.ok(safe && validatorBegin>=0 && validatorEnd>validatorBegin);
const owners={exports:{}};
vm.runInNewContext(ts.transpileModule(safe+'\n'+ownerCode.slice(validatorBegin,validatorEnd)+'\nmodule.exports=validateOwnedMovieJob;',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:owners,exports:owners.exports,Error,Array,Object});
function make(phase){
 const calls={reads:[],writes:[],started:false};
 const snapshot = (d) => ({exists: d!==undefined, data:()=>d});
 const ref = p => ({path:p});
 const before=structuredClone(base),changed=structuredClone(base);
 const liveChild=structuredClone(child),liveAssembly=structuredClone(assembly);
 const isAssembly=phase.startsWith('assembly-') || phase==='clear-assembly';
 if(isAssembly){before.assemblyJobId=assemblyId;changed.assemblyJobId=assemblyId;}
 const childChanges={
  'child-owner':()=>{liveChild.ownerUid='other'},'child-tenant':()=>{liveChild.tenantId='other'},
  'child-id':()=>{liveChild.jobId='other'},'child-parent':()=>{liveChild.execution.rootJobId='other'},
  'child-project':()=>{liveChild.payload.projectId='other'},'child-source':()=>{liveChild.sourceSystem='other'},
  'child-type':()=>{liveChild.jobType='studio.assemble.video'},
  'child-consent':()=>{liveChild.consent.decisionReceiptId='other'},
  'child-digest':()=>{liveChild.payload.renderPlanDigest='a'.repeat(64)},
  'child-scene':()=>{liveChild.payload.sceneTruthDigest='a'.repeat(64)},
  'assembly-owner':()=>{liveAssembly.ownerUid='other'},
  'assembly-parent':()=>{liveAssembly.execution.rootJobId='other'},
  'assembly-consent':()=>{liveAssembly.consent.decisionReceiptId='other'},
  'assembly-digest':()=>{liveAssembly.payload.renderPlanDigest='d'.repeat(64)},
  'assembly-receipt':()=>{liveAssembly.payload.sceneTruthReceiptRef='other'},
 };
 childChanges[phase]?.();
 if(phase==='plan-width')changed.width=1000;
 if(phase==='plan-receipt')changed.sceneTruthReceiptRef='other';
 if(phase==='plan-fps')changed.fps=99;
 if (phase === 'cancel') changed.status = 'CANCELLED';
 if (phase === 'changed-sources') changed.renderPlanDigest='e'.repeat(64);
 if (phase === 'changed-segments') changed.segments[0].endMs=2000;
 if (phase === 'changed-consent') changed.consent.decisionReceiptId='d'.repeat(64);
 const transaction = {
  async get(r){calls.reads.push(r.path);
   if(r.path==='plans/'+planId)return snapshot(changed);
   if(r.path.startsWith('jobConsentBlocks/')){
    if(phase==='read-error')throw new Error('synthetic_firestore_failure');
    if(phase==='revoke')return snapshot({active:true});
    if(phase==='malformed')return snapshot({active:'false'});
    return {exists:false};
   }
   if(r.path==='jobs/'+assemblyId)return phase==='assembly-missing'?{exists:false}:snapshot(liveAssembly);
   if(r.path.startsWith('jobs/'))return snapshot(liveChild);
   return {exists:false};
  },
  async getAll(...refs){refs.forEach(r=>calls.reads.push(r.path));
   if(phase==='child-short')return [];
   return refs.map(()=>phase==='child-missing'?{exists:false}:snapshot(liveChild));},
  update(r,obj){calls.writes.push({verb:'update',path:r.path,obj})},
  set(r,obj){calls.writes.push({verb:'set',path:r.path,obj})}
 };
 const db={async runTransaction(cb){calls.started=true;return cb(transaction)}};
 const module={exports:{}};
 const env = {module,Error,Promise,Date,Set,String,Array, Number,
  getFirestore:()=>db,
  loadPlan:async()=>before,
  assertPlanConsentActive:async()=>true,
  assertJobConsentBlockClear:actualConsent,
  assertPlanOwner:shape.assertPlanOwner,
  assertPlanStructure:shape.assertPlanStructure,
  boundPlanJob:shape.boundPlanJob,validateOwnedMovieJob:owners.exports,buildRequestFingerprint:fingerprint,
  isDeepStrictEqual,consentBlockRef:()=>ref('jobConsentBlocks/'+owner),
  jobDoc:id=>ref('jobs/'+id),jobQueueEntryDoc:id=>ref('queue/'+id),planRef:id=>ref('plans/'+id),
  FieldValue:{serverTimestamp:()=>({now:true}),delete:()=>({del:true})}
 };
 vm.runInNewContext(js,env);
 return {invoke:()=>module.exports(planId,tenant,owner),calls};
}
for(const phase of ['cancel','revoke','malformed','read-error','changed-sources','changed-segments','changed-consent','clear']){
 test('resumePlan transaction '+phase,async()=>{
  const h=make(phase);
  if(phase==='clear'){
   const result=await h.invoke();
   assert.equal(result.resumedChildren,1);
   assert.equal(h.calls.writes.filter(x=>x.path==='jobs/'+childId).length,1);
   assert.equal(h.calls.writes.filter(x=>x.path==='queue/'+childId).length,1);
   assert.ok(h.calls.writes.some(x=>x.path==='plans/'+planId));
  }else{
   const err = phase==='cancel'?'longform_plan_cancelled':phase==='revoke'?'life_movie_longform_consent_revoked':
    phase==='malformed'?'life_movie_consent_block_unverified':phase==='read-error'?'synthetic_firestore_failure':'longform_plan_changed';
   await assert.rejects(h.invoke(),new RegExp(err));
   assert.equal(h.calls.writes.length,0,'failed recheck may not enqueue/update');
  }
  assert.ok(h.calls.reads.includes('plans/'+planId), 'plan must be read inside transaction');
  assert.ok(h.calls.reads.some(x=>x.startsWith('jobConsentBlocks/')),'consent must be read inside transaction');
 });
}

// Recovery must not re-queue malformed child/assembly records even if the
// earlier preflight saw active consent and a non-cancelled plan.
for(const phase of ['child-owner','child-tenant','child-id','child-parent','child-project','child-source','child-type',
 'child-consent','child-digest','child-scene','child-missing','child-short',
 'assembly-owner','assembly-parent','assembly-consent','assembly-digest','assembly-receipt','assembly-missing',
 'plan-width','plan-receipt','plan-fps','clear-assembly']) {
 test('resumePlan ownership and source binding '+phase,async()=>{
  const h=make(phase);
  if(phase==='clear-assembly'){
    const result=await h.invoke();
    assert.equal(result.resumedChildren,1);
    assert.equal(result.assemblyResumed,true);
    return;
  }
  const expected=phase.startsWith('child-')?(
    phase==='child-missing'||phase==='child-short'?'longform_child_not_found':
    ['child-owner','child-tenant','child-id','child-parent','child-project','child-source','child-type'].includes(phase)
      ?'life_movie_owner_job_boundary_mismatch':'longform_segment_binding_mismatch'):
    phase.startsWith('assembly-')?(
    phase==='assembly-missing'?'longform_child_not_found':
    ['assembly-owner','assembly-parent'].includes(phase)?'life_movie_owner_job_boundary_mismatch':'longform_assembly_binding_mismatch')
    :'longform_plan_changed';
  await assert.rejects(h.invoke(),new RegExp(expected));
  assert.equal(h.calls.writes.length,0,'no job requeue after changed ownership or source');
 });
}
