import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const ts=createRequire(new URL('../functions/package.json',import.meta.url))('typescript');
const read=p=>readFileSync(new URL('../functions/src/'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const block={exports:{}},blockCode=read('privacy/consentBlocks.ts');
vm.runInNewContext(compile(blockCode.slice(blockCode.indexOf('export type JobConsentBlockState ='))),{module:block,exports:block.exports});
const ownerModule={exports:{}};
vm.runInNewContext(compile(read('privacy/ownerDeletionFence.ts')),{module:ownerModule,exports:ownerModule.exports,Object,Array,Error});
const ownerFence=ownerModule.exports.assertOwnerDeletionFenceClear;
assert.equal(typeof ownerFence,'function');
const ownerTenantFence=ownerModule.exports.assertLifeMovieOwnerTenantAuthorityClear;
assert.equal(typeof ownerTenantFence,'function');
// Use the production owner-org helper introduced by the longform authority repair.
const ownerOrgModule={exports:{}};
vm.runInNewContext(compile(read('jobs/lifeMovieLongformOwnerOrg.ts')),{module:ownerOrgModule,exports:ownerOrgModule.exports,Object,Array,Error});
const serverLifeMovieOwnerOrgId=ownerOrgModule.exports.serverLifeMovieOwnerOrgId;
assert.equal(typeof serverLifeMovieOwnerOrgId,'function');
const clear={exists:false},present=x=>({exists:true,data:()=>({active:x})}),hash='a'.repeat(64);
const input={userId:'owner-1',tenantId:'tenant-1',idempotencyKey:'key',consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:hash},payload:{projectId:'p1',renderPlanDigest:hash,sceneTruthDigest:hash,sceneTruthReceiptRef:'receipt-1'}};
function harness(mode,phase){
 const source=read(mode==='short'?'jobs/studioLifeMovieBridge.ts':'jobs/studioLifeMovieLongformBridge.ts');
 const name=mode==='short'?'createLifeMovieJob':'createPlan',start=source.indexOf('async function '+name+'('),end=source.indexOf(mode==='short'?'\nasync function loadBoundJob(':'\nasync function loadPlan(',start);
 assert.ok(start>=0&&end>start);
 const writes=[],reads=[],ref=path=>({path,async get(){return clear},collection:x=>ref(path+'/'+x),doc:x=>ref(path+'/'+x)});
 const db={collection:x=>ref(x),async runTransaction(fn){return fn({async get(r){reads.push(r.path);
  if(r.path.startsWith('users/')){
    if(phase==='owner-missing')return {exists:false};
    return {exists:true,data:()=>({uid:'owner-1',tenantId:'tenant-1',accountStatus:'active',deleted:false,markedForDeletion:false,disabled:false,dataRightsDeletionPendingCentralPrivacy:phase==='owner-pending'?true:phase==='owner-malformed'?'false':false})};
  }
  if(r.path.startsWith('jobConsentBlocks/')){if(phase==='error')throw Error('synthetic_firestore_unavailable');return phase==='revoked'?present(true):phase==='malformed'?present('false'):clear;}return clear;},create(r,data){writes.push({path:r.path,data})}})}};
 const env={module:{exports:{}},Error,Date,Promise,serverLifeMovieOwnerOrgId,createHash:()=>({update:()=>({digest:()=>hash})}),assertJobConsentBlockClear:block.exports.assertJobConsentBlockClear,assertOwnerDeletionFenceClear:ownerFence,assertLifeMovieOwnerTenantAuthorityClear:ownerTenantFence,
 getFirestore:()=>db,consentBlockRef:()=>ref('jobConsentBlocks/owner-1'),requireLifeMovieCreationAdmission:async()=>{},
 assertStudioLifeMovieRenderPlanDigest:x=>x,assertLifeMovieTenantPaths:x=>x,assertStudioLifeMovieLongformPlanDigest:x=>x,assertLifeMovieLongformTenantPaths:x=>x,
 verifySceneTruthReceipt:()=>({expiresAt:'2030-01-01T00:00:00.000Z'}),assertSceneTruthReceiptValue:()=>({receiptId:'receipt',expiresAt:'2030-01-01T00:00:00.000Z'}),
 configuredSceneTruthSecret:()=> 'fake',longformEnabled:()=>true,planLifeMovieLongformSegments:()=>[{index:0,startMs:0,endMs:1,childDigest:hash,payload:{}}],
 makeChildId:(id,i)=>id+'-'+i,buildRequestFingerprint:()=>hash,buildIdempotencyBindingId:()=> 'binding',bindingMatches:()=>false,
 FieldValue:{serverTimestamp:()=>0},ulid:()=> '01AAAAAAAAAAAAAAAAAAAAAAAA',jobDoc:id=>ref('jobs/'+id),jobQueueEntryDoc:id=>ref('queue/'+id),
 planRef:id=>ref('plans/'+id),IDEMPOTENCY_COLLECTION:'bindings',BINDING_COLLECTION:'bindings',SCENE_TRUTH_RECEIPT_BINDING_COLLECTION:'receipts'};
 vm.runInNewContext(compile(source.slice(start,end)+'\nmodule.exports='+name+';'),env);
 return {invoke:()=>env.module.exports(input),writes,reads};
}
for(const mode of ['short','longform'])for(const phase of ['revoked','malformed','error','clear','owner-pending','owner-malformed','owner-missing'])test(mode+' transactional '+phase,async()=>{
 const h=harness(mode,phase);
 if(phase==='clear'){const result=await h.invoke();assert.equal(result.deduplicated,false);assert.ok(h.writes.some(x=>x.path.startsWith(mode==='short'?'jobs/':'plans/')));}
 else{const reason=phase==='revoked'?(mode==='short'?'life_movie_consent_revoked':'life_movie_longform_consent_revoked'):phase==='malformed'?'life_movie_consent_block_unverified':
   phase==='owner-pending'?'owner_data_rights_deletion_pending':
   phase==='owner-malformed'||phase==='owner-missing'?'owner_data_rights_authority_unavailable':'synthetic_firestore_unavailable';await assert.rejects(h.invoke(),new RegExp(reason));assert.equal(h.writes.length,0);}
 assert.ok(h.reads.some(x=>x.startsWith('jobConsentBlocks/')));
 assert.ok(h.reads.includes('users/owner-1'),'owner document must be checked in the creating transaction');
});
