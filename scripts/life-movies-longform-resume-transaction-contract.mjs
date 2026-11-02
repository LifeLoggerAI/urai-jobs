import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
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
  section('function assertPlanOwner(', 'function boundPlanJob(');
const gm = {exports:{}};
vm.runInNewContext(ts.transpileModule(guards + '\nmodule.exports={makeChildId,makeAssemblyJobId,assertPlanStructure,assertPlanOwner};', {
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
  segments: [{ jobId: childId, index: 0, startMs:0, endMs:1000 }], projectId: 'project1',
  renderPlanDigest: 'a'.repeat(64),sceneTruthDigest:'b'.repeat(64),
  consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)}};
function make(phase){
 const calls={reads:[],writes:[],started:false};
 const snapshot = (d) => ({exists: d!==undefined, data:()=>d});
 const ref = p => ({path:p});
 const changed = structuredClone(base);
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
   if(r.path.startsWith('jobs/'))return snapshot({status:'FAILED'});
   return {exists:false};
  },
  async getAll(...refs){refs.forEach(r=>calls.reads.push(r.path));return refs.map(()=>snapshot({status:'FAILED'}))},
  update(r,obj){calls.writes.push({verb:'update',path:r.path,obj})},
  set(r,obj){calls.writes.push({verb:'set',path:r.path,obj})}
 };
 const db={async runTransaction(cb){calls.started=true;return cb(transaction)}};
 const module={exports:{}};
 const env = {module,Error,Promise,Date,Set,String,Array, Number,
  getFirestore:()=>db,
  loadPlan:async()=>structuredClone(base),
  assertPlanConsentActive:async()=>true,
  assertJobConsentBlockClear:actualConsent,
  assertPlanOwner:shape.assertPlanOwner,
  assertPlanStructure:shape.assertPlanStructure,
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
