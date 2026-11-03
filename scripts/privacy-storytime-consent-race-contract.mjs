import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const requireFn=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFn('typescript');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bridge=read('functions/src/jobs/storytimeNarratorBridge.ts');
const consent=read('functions/src/privacy/consentBlocks.ts');
const ownerFence=read('functions/src/privacy/ownerDeletionFence.ts');
const sourceStart=bridge.indexOf('  return db.runTransaction(async (transaction) => {',bridge.indexOf('async function createNarratorJob('));
const guardStart=bridge.indexOf('    const [inside, ownerSnapshot, liveConsentBlock] = await Promise.all([',sourceStart);
const guardStop=bridge.indexOf('    if (inside.exists)',guardStart);
assert.ok(sourceStart>=0&&guardStart>sourceStart&&guardStop>guardStart,'Original transaction-bound Storytime consent guard found');
const checkedStart=consent.indexOf('export function checkedJobConsentBlockState(');
const checkedStop=consent.indexOf('\n}\n\n/** Shared preflight',checkedStart)+2;
assert.ok(checkedStart>=0&&checkedStop>checkedStart,'Original checkedJobConsentBlockState found');
const moduleText=consent.slice(checkedStart,checkedStop)+'\n'+ownerFence+
 '\nasync function runOriginalConsentGuard(transaction,bindingRef,ownerRef,consentRef) {\n'
 +bridge.slice(guardStart,guardStop)+'\nreturn true;\n}\n'
 +'module.exports.runOriginalConsentGuard=runOriginalConsentGuard;';
const js=ts.transpileModule(moduleText,{
 fileName:'StorytimeOriginalConsentGuard.ts',reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
});
assert.equal(js.diagnostics?.length??0,0,'Original Storytime consent guard transpiles');
const module={exports:{}};
runInNewContext(js.outputText,{module,exports:module.exports,Promise},
 {filename:'StorytimeOriginalConsentGuard.js',timeout:2000});
const run=module.exports.runOriginalConsentGuard;
const bindingRef={type:'binding'},ownerRef={type:'owner'},consentRef={type:'consent'};
function harness(block,exists=true,ownerData={dataRightsDeletionPendingCentralPrivacy:false}){
 const reads=[],writes=[];
 const transaction={
  async get(ref){
   reads.push(ref.type);
   if(ref===bindingRef)return {exists:false,data:()=>null};
   if(ref===ownerRef)return {exists:true,data:()=>ownerData};
   if(ref===consentRef)return {exists,data:()=>block};
   throw Error('unexpected Firestore reference');
  },create(...args){writes.push(args)},
 };
 return {reads,writes,invoke:()=>run(transaction,bindingRef,ownerRef,consentRef)};
}
for(const [label,block,exists,shouldAllow] of [
 ['absent legacy consent block',null,false,true],
 ['explicit consent clear',{active:false},true,true],
 ['revoked consent',{active:true},true,false],
 ['malformed consent block',{},true,false],
 ['nonboolean block',{active:'false'},true,false],
 ['accessor-backed consent',Object.defineProperty({},'active',{get:()=>false}),true,false],
]){
 test('Storytime transaction owner/consent fence '+label,async()=>{
  const h=harness(block,exists);
  if(shouldAllow)await h.invoke();
  else await assert.rejects(h.invoke(),/storytime_voiceover_consent_revoked|storytime_voiceover_consent_block_unverified/);
  assert.deepEqual(h.reads.sort(),['binding','consent','owner'].sort());
  assert.equal(h.writes.length,0);
 });
}
test('Storytime consent and owner veto run before any idempotent return or writes',()=>{
 const section=bridge.slice(sourceStart,bridge.indexOf('async function cancelJob(',sourceStart));
 const consentCheck=section.indexOf("checkedJobConsentBlockState(liveConsentBlock)");
 const ownerCheck=section.indexOf("assertOwnerDeletionFenceClear(ownerSnapshot);");
 const firstReturn=section.indexOf("if (inside.exists)");
 const firstWrite=section.indexOf("transaction.create(");
 assert.ok(consentCheck>=0&&ownerCheck>=0&&firstReturn>=0&&firstWrite>=0);
 assert.ok(consentCheck<firstReturn&&ownerCheck<firstReturn);
 assert.ok(consentCheck<firstWrite&&ownerCheck<firstWrite);
 assert.equal(section.includes('await bindingRef.get()'),false);
 assert.ok(bridge.includes("checkedJobConsentBlockState(await consentRef.get())"));
 assert.ok(bridge.includes("storytime_voiceover_consent_block_unverified' ? 503"));
});
test('Storytime clear consent does not override pending owner deletion',async()=>{
 const h=harness({active:false},true,{dataRightsDeletionPendingCentralPrivacy:true});
 await assert.rejects(h.invoke(),/owner_data_rights_deletion_pending/);
 assert.equal(h.writes.length,0);
});
