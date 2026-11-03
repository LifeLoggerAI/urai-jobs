import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const requireFn=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFn('typescript');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shared=read('functions/src/privacy/ownerDeletionFence.ts');
const source=ts.transpileModule(shared+'\nmodule.exports.ownerDeletionFenceState=ownerDeletionFenceState;\nmodule.exports.assertOwnerDeletionFenceClear=assertOwnerDeletionFenceClear;',{
  fileName:'OwnerDeletionFence.ts', reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
});
assert.equal(source.diagnostics?.length??0,0,'Shared owner-deletion guard transpiles');
const scope={exports:{}};
runInNewContext(source.outputText,{module:scope,exports:scope.exports},
  {filename:'OwnerDeletionFence.js',timeout:2000});
const {ownerDeletionFenceState,assertOwnerDeletionFenceClear}=scope.exports;
const snap=(data,exists=true)=>({exists,data:()=>data});
test('owner deletion fence permits legacy accounts and literal false',()=>{
  for(const record of [{role:'user'},{dataRightsDeletionPendingCentralPrivacy:false}]){
    assert.equal(ownerDeletionFenceState(snap(record)),'clear');
    assert.doesNotThrow(()=>assertOwnerDeletionFenceClear(snap(record)));
  }
});
test('owner deletion fence rejects pending deletion on any request',()=>{
  const record={dataRightsDeletionPendingCentralPrivacy:true,dataRightsDeletionRequestId:'deletion-request-01'};
  assert.equal(ownerDeletionFenceState(snap(record)),'pending');
  assert.throws(()=>assertOwnerDeletionFenceClear(snap(record)),/owner_data_rights_deletion_pending/);
});
for(const [label,record] of [
 ['string-false',{dataRightsDeletionPendingCentralPrivacy:'false'}],
 ['null',{dataRightsDeletionPendingCentralPrivacy:null}],
 ['zero',{dataRightsDeletionPendingCentralPrivacy:0}],
 ['array',[]],
 ['inherited',Object.create({dataRightsDeletionPendingCentralPrivacy:true})],
 ['getter',Object.defineProperty({},'dataRightsDeletionPendingCentralPrivacy',{get:()=>false})],
 ['missing-owner',null],
]) {
  test('owner deletion fence denies unverifiable '+label,()=>{
    const input=label==='inherited'?record:record;
    assert.equal(ownerDeletionFenceState(snap(input)),'unverified');
    assert.throws(()=>assertOwnerDeletionFenceClear(snap(input)),/owner_data_rights_authority_unavailable/);
  });
}
test('owner deletion fence refuses missing and unreadable Firestore docs',()=>{
  for(const value of [null,{exists:false,data:()=>({})},{exists:true,data:()=>{throw Error('read failed');}},{exists:true,data:()=>undefined}]){
    assert.equal(ownerDeletionFenceState(value),'unverified');
    assert.throws(()=>assertOwnerDeletionFenceClear(value),/owner_data_rights_authority_unavailable/);
  }
});
const short=read('functions/src/jobs/studioLifeMovieBridge.ts');
const long=read('functions/src/jobs/studioLifeMovieLongformBridge.ts');
const story=read('functions/src/jobs/storytimeNarratorBridge.ts');
function body(src,start,end){
  const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'source bound action '+start+' and '+end+' must exist');
  return src.slice(a,b);
}
function assertTxnOwnerFence(src,ownerExpr,label){
  assert.ok(src.includes('transaction.get('+ownerExpr+')'),label+' must read owner in write transaction');
  assert.ok(src.includes('assertOwnerDeletionFenceClear(ownerSnapshot);'),label+' must fail closed');
  assert.ok(src.indexOf('assertOwnerDeletionFenceClear(ownerSnapshot);')<
    Math.min(...['transaction.create(', 'transaction.update(', 'transaction.set(']
      .map(x=>{const i=src.indexOf(x);return i<0?Infinity:i;})),
    label+' must guard before writes');
}
test('Studio render creation and idempotent reuse both honor owner deletion fence',()=>{
  const segment=body(short,'return db.runTransaction(async (transaction) => {','async function loadBoundJob(');
  assertTxnOwnerFence(segment,'ownerRef','studio-render');
  assert.ok(segment.indexOf('assertOwnerDeletionFenceClear(ownerSnapshot);')<
    segment.indexOf('if (sceneTruthInside.exists)'));
});
test('Studio longform create, assemble, and resume each honor same owner fence',()=>{
  const create=body(long,'async function createPlan(','async function readPlanStatus(');
  const assemble=body(long,'async function assemblePlan(','async function readPlanPlayback(');
  const resume=body(long,'async function resumePlan(','async function deletePlanOutputs(');
  for(const [name,src,uid] of [['create',create,'input.userId'],['assemble',assemble,'userId'],['resume',resume,'userId']]){
    assertTxnOwnerFence(src,"db.collection('users').doc("+uid+")",'longform '+name);
  }
});
test('Storytime removes nontransactional idempotent short-circuit and checks fence',()=>{
  const segment=body(story,'async function createNarratorJob(','async function cancelJob(');
  assert.equal(segment.includes('await bindingRef.get()'),false);
  assertTxnOwnerFence(segment,'ownerRef','storytime-narrator');
  assert.ok(segment.indexOf('assertOwnerDeletionFenceClear(ownerSnapshot);')<
    segment.indexOf('if (inside.exists)'));
});
test('Dedicated bridges preserve deletion cleanup and use explicit HTTP errors',()=>{
  for(const [name,source] of [['studio-short',short],['studio-long',long],['storytime',story]]){
    assert.ok(source.includes('owner_data_rights_deletion_pending'),name+' must report pending');
    assert.ok(source.includes('owner_data_rights_authority_unavailable'),name+' must report unverifiable');
    assert.ok(source.includes('assertOwnerDeletionFenceClear'),name+' must use shared authority');
  }
  assert.ok(long.includes('async function cancelPlan('));
  assert.ok(story.includes('async function cancelJob('));
});
