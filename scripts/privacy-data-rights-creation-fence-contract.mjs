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
// R929: extract the actual authoritative helpers from the current original AST.
// The old fixture loaded only the deletion helper but newer admission also
// requires current server-role/owner-scope checks in the same transaction.
const createAst=ts.createSourceFile('createJob.ts',createSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const sourceFunction=name=>{
 const declaration=createAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert.ok(declaration?.body,'canonical create helper missing: '+name);
 return declaration.getText(createAst);
};
const helper=['userRecord','assertOwnerJobsNotDeleting','hasJobCreatePermission']
 .map(sourceFunction).join('\n');
const currentSource=readFileSync(new URL('../functions/src/jobs/currentJobCallerAuthority.ts',import.meta.url),'utf8');
const currentJs=ts.transpileModule(currentSource,{
 fileName:'currentJobCallerAuthority.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const authorityModule={exports:{}};
runInNewContext(currentJs,{module:authorityModule,exports:authorityModule.exports,Object,Array,Error,Symbol},
 {filename:'currentJobCallerAuthority.js',timeout:2000});
const {checkedCurrentJobCaller,sameCurrentJobOwnerScope}=authorityModule.exports;
assert.equal(typeof checkedCurrentJobCaller,'function');
assert.equal(typeof sameCurrentJobOwnerScope,'function');
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
 checkedCurrentJobCaller,sameCurrentJobOwnerScope,
 context:{auth:{uid:'synthetic-owner'}},
 user:{uid:'synthetic-owner',role:'user',permissions:['jobs:create']},
 httpsError:(code,message)=>Object.assign(new Error(message),{code})
},{filename:'JobsOwnerCreationFence.js',timeout:2000});
const {checkCurrentOwner,assertOwnerJobsNotDeleting}=module.exports;
const ref={kind:'user-owner'};
function getLatest(data,exists=true){
 return {get:async actual=>{
  assert.equal(actual,ref);
  return {exists,data:()=>data===null?null:{uid:'synthetic-owner',permissions:['jobs:create'],...data}};
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
  // Current-role admission may deny before reaching the explicit deletion guard.
  await assert.rejects(checkCurrentOwner(getLatest(record),ref),/central Privacy|deletion|Current user is not allowed/i);
 });
}
test('stale pre-check cannot bypass newly activated transaction fence',async()=>{
 assertOwnerJobsNotDeleting({role:'user'});
 await assert.rejects(checkCurrentOwner(getLatest({
  role:'user',dataRightsDeletionPendingCentralPrivacy:true,
  dataRightsDeletionRequestId:'synthetic-deletion-request'
 }),ref),/reconciliation|Current user is not allowed/i);
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
