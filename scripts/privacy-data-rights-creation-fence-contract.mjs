import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const requireFn=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFn('typescript');
const createSource=readFileSync(new URL('../functions/src/jobs/createJob.ts',import.meta.url),'utf8');
const deleteSource=readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts',import.meta.url),'utf8');
const helperStart=createSource.indexOf('function userRecord(user: unknown): Record<string, unknown> {');
const helperEnd=createSource.indexOf('\nfunction userOrgId(',helperStart);
assert.ok(helperStart>=0 && helperEnd>helperStart,'canonical guard helper found');
const helper=createSource.slice(helperStart,helperEnd);
const guardStart=createSource.indexOf('      const ownerSnap = await transaction.get(ownerRef);');
const guardEnd=createSource.indexOf('      if (bindingRef) {',guardStart);
assert.ok(guardStart>=0 && guardEnd>guardStart,'transaction-bound owner fence found');
const admissionSrc=helper+'\nasync function checkCurrentOwner(transaction,ownerRef) {\n'
 +createSource.slice(guardStart,guardEnd)+'\nreturn true;\n}\n'
 +'module.exports.assertOwnerJobsNotDeleting=assertOwnerJobsNotDeleting;\n'
 +'module.exports.checkCurrentOwner=checkCurrentOwner;';
const js=ts.transpileModule(admissionSrc,{
 fileName:'JobsOwnerCreationFence.ts',reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
});
assert.equal(js.diagnostics?.length??0,0);
const module={exports:{}};
runInNewContext(js.outputText,{module,exports:module.exports,
 httpsError:(code,message)=>Object.assign(new Error(message),{code})
},{filename:'JobsOwnerCreationFence.js',timeout:2000});
const {checkCurrentOwner,assertOwnerJobsNotDeleting}=module.exports;
const ref={kind:'user-owner'};
function getLatest(data,exists=true){
 return {get:async actual=>{
  assert.equal(actual,ref);
  return {exists,data:()=>data};
 }};
}
test('legacy owner and explicit false remain admissible',async()=>{
 assert.doesNotThrow(()=>assertOwnerJobsNotDeleting({role:'user'}));
 assert.doesNotThrow(()=>assertOwnerJobsNotDeleting({dataRightsDeletionPendingCentralPrivacy:false}));
 await checkCurrentOwner(getLatest({role:'user'}),ref);
 await checkCurrentOwner(getLatest({dataRightsDeletionPendingCentralPrivacy:false}),ref);
});
for(const [label,value] of [
 ['active deletion',true],['malformed string','false'],['malformed null',null],['malformed zero',0],['malformed object',{}],
]){
 test('canonical create rejects '+label+' before any writes',async()=>{
  const record={role:'user',dataRightsDeletionPendingCentralPrivacy:value};
  assert.throws(()=>assertOwnerJobsNotDeleting(record),/central Privacy|deletion/i);
  await assert.rejects(checkCurrentOwner(getLatest(record),ref),/central Privacy|deletion/i);
 });
}
test('stale pre-check cannot bypass newly activated transaction fence',async()=>{
 assertOwnerJobsNotDeleting({role:'user'});
 await assert.rejects(checkCurrentOwner(getLatest({
  role:'user',dataRightsDeletionPendingCentralPrivacy:true,
  dataRightsDeletionRequestId:'synthetic-deletion-request'
 }),ref),/reconciliation/i);
});
test('canonical create rejects vanished owner before creating job or queue',async()=>{
 await assert.rejects(checkCurrentOwner(getLatest(null,false),ref),/Owner record missing/i);
});
test('owner fence in approved deletion transaction is before audit or queue writes',()=>{
 const approved=deleteSource.indexOf("if (record.status !== 'APPROVED')");
 const start=deleteSource.indexOf("transaction.create(executionRef",approved);
 const block=deleteSource.slice(approved,start);
 assert.ok(approved>=0 && start>approved);
 assert.ok(block.includes("transaction.get(ownerRef)"));
 assert.ok(block.includes("transaction.set(ownerRef"));
 assert.ok(block.includes("dataRightsDeletionPendingCentralPrivacy: true"));
 assert.ok(createSource.includes("const ownerRef = db.collection('users').doc(uid);"));
 assert.ok(createSource.includes("assertOwnerJobsNotDeleting(user);"));
});
