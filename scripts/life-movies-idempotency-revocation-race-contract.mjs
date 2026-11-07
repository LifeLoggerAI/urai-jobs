import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const ts=createRequire(new URL('../functions/package.json',import.meta.url))('typescript');
const read=p=>readFileSync(new URL('../functions/src/'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const raw=read('privacy/consentBlocks.ts');
const block={exports:{}};
vm.runInNewContext(compile(raw.slice(raw.indexOf('export type JobConsentBlockState ='))),{module:block,exports:block.exports});
assert.equal(typeof block.exports.assertJobConsentBlockClear,'function');
// Use the original owner-deletion guard; never substitute an allow-all stub.
const ownerModule={exports:{}};
vm.runInNewContext(compile(read('privacy/ownerDeletionFence.ts')),
  {module:ownerModule,exports:ownerModule.exports,Object,Array,Error});
const ownerFence=ownerModule.exports.assertOwnerDeletionFenceClear;
assert.equal(typeof ownerFence,'function');
const ownerTenantFence=ownerModule.exports.assertLifeMovieOwnerTenantAuthorityClear;
assert.equal(typeof ownerTenantFence,'function');
const absent={exists:false};
const stored=active=>({exists:true,data:()=>({active})});
const existing={exists:true,data:()=>({jobId:'prior-accepted-job'})};
const hash='a'.repeat(64);
const request={userId:'owner-1',tenantId:'tenant-1',idempotencyKey:'replayed-key',consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:hash},payload:{projectId:'p1',renderPlanDigest:hash,sceneTruthDigest:hash,sceneTruthReceiptRef:'receipt-1'}};
function harness(mode,phase){
  const src=read(mode==='short'?'jobs/studioLifeMovieBridge.ts':'jobs/studioLifeMovieLongformBridge.ts');
  const fn=mode==='short'?'createLifeMovieJob':'createPlan';
  const start=src.indexOf('async function '+fn+'(');
  const end=src.indexOf(mode==='short'?'\nasync function loadBoundJob(':'\nasync function loadPlan(',start);
  assert.ok(start>=0&&end>start);
  const reads=[],writes=[],preflight=[];
  const ref=path=>({path,async get(){preflight.push(path);return path.startsWith('bindings/')?existing:absent},collection:x=>ref(path+'/'+x),doc:x=>ref(path+'/'+x)});
  const db={collection:x=>ref(x),async runTransaction(fn){return fn({
    async get(r){reads.push(r.path);
      if(r.path.startsWith('users/')){
        if(phase==='owner-missing')return {exists:false};
        return {exists:true,data:()=>({uid:'owner-1',tenantId:'tenant-1',accountStatus:'active',deleted:false,markedForDeletion:false,disabled:false,dataRightsDeletionPendingCentralPrivacy:phase==='owner-pending'?true:phase==='owner-malformed'?'false':false})};
      }
      if(r.path.startsWith('jobConsentBlocks/')){
        if(phase==='error')throw Error('synthetic_firestore_unavailable');
        return phase==='revoked'?stored(true):phase==='malformed'?stored('false'):absent;
      }
      return r.path.startsWith('bindings/')?existing:absent;
    },
    create(r,body){writes.push({path:r.path,body})}
  })}};
  const env={module:{exports:{}},Error,Date,Promise,createHash,assertJobConsentBlockClear:block.exports.assertJobConsentBlockClear,
    assertOwnerDeletionFenceClear:ownerFence,
    assertLifeMovieOwnerTenantAuthorityClear:ownerTenantFence,
    getFirestore:()=>db,consentBlockRef:()=>ref('jobConsentBlocks/owner-1'),requireLifeMovieCreationAdmission:async()=>{},
    assertStudioLifeMovieRenderPlanDigest:x=>x,assertLifeMovieTenantPaths:x=>x,assertStudioLifeMovieLongformPlanDigest:x=>x,assertLifeMovieLongformTenantPaths:x=>x,
    verifySceneTruthReceipt:()=>({expiresAt:'2030-01-01T00:00:00.000Z'}),assertSceneTruthReceiptValue:()=>({receiptId:'receipt',expiresAt:'2030-01-01T00:00:00.000Z'}),
    configuredSceneTruthSecret:()=> 'fake',longformEnabled:()=>true,planLifeMovieLongformSegments:()=>[{index:0,startMs:0,endMs:1,childDigest:hash,payload:{}}],
    makeChildId:(id,i)=>id+'-'+i,buildRequestFingerprint:()=>hash,buildIdempotencyBindingId:()=> 'binding',bindingMatches:()=>true,
    FieldValue:{serverTimestamp:()=>0},ulid:()=> '01AAAAAAAAAAAAAAAAAAAAAAAA',jobDoc:id=>ref('jobs/'+id),jobQueueEntryDoc:id=>ref('queue/'+id),planRef:id=>ref('plans/'+id),
    IDEMPOTENCY_COLLECTION:'bindings',BINDING_COLLECTION:'bindings',SCENE_TRUTH_RECEIPT_BINDING_COLLECTION:'receipts'};
  vm.runInNewContext(compile(src.slice(start,end)+'\nmodule.exports='+fn+';'),env);
  return {invoke:()=>env.module.exports(request),reads,writes,preflight};
}
for(const mode of ['short','longform'])for(const phase of ['revoked','malformed','error','clear','owner-pending','owner-malformed','owner-missing']){
  test(mode+' existing idempotency binding '+phase+' must use transactional revocation',async()=>{
    const h=harness(mode,phase);
    if(phase==='clear'){
      const result=await h.invoke();
      assert.equal(result.deduplicated,true);
      assert.equal(mode==='short'?result.jobId:result.planId,'prior-accepted-job');
    }else{
      const error=phase==='revoked'?(mode==='short'?'life_movie_consent_revoked':'life_movie_longform_consent_revoked'):
        phase==='malformed'?'life_movie_consent_block_unverified':
        phase==='owner-pending'?'owner_data_rights_deletion_pending':
        phase==='owner-malformed'||phase==='owner-missing'?'owner_data_rights_authority_unavailable':'synthetic_firestore_unavailable';
      await assert.rejects(h.invoke(),new RegExp(error));
      assert.equal(h.writes.length,0,'revoked or unverified consent must not write');
    }
    assert.ok(h.preflight.some(x=>x.startsWith('jobConsentBlocks/')),'initial consent preflight required');
    assert.ok(h.reads.some(x=>x.startsWith('jobConsentBlocks/')),'existing idempotency replay must check consent within transaction');
    assert.ok(h.reads.includes('users/owner-1'),'existing replay must check original owner-deletion fence inside transaction');
  });
}
