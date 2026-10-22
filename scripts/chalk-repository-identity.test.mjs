import test from 'node:test';
import assert from 'node:assert/strict';
import { isChalkRepositoryIdentity } from './chalk-repository-identity.mjs';
import { engineeringCheckpointBridge } from './chalk-firestore-checkpoint.mjs';
import { EngineeringContinuityStore } from './chalk-engineering-continuity.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const invalid = ['LifeLoggerAI/..','LifeLoggerAI/.git','LifeLoggerAI/urai-spatial.git','LifeLoggerAI/urai-spatial.',
  'LifeLoggerAI/.hidden','LifeLoggerAI/../urai-jobs','LifeLoggerAI/urai-jobs/../urai-spatial',
  'OtherOrg/urai-spatial','LifeLoggerAI\\urai-jobs','LifeLoggerAI/%2e%2e',
  'LifeLoggerAI/urai jobs','LifeLoggerAI/-branch'];

test('canonical repository identifiers allow existing UrAi components',()=>{
  for(const id of ['LifeLoggerAI/UrAi','LifeLoggerAI/urai-jobs','LifeLoggerAI/urai-spatial',
    'LifeLoggerAI/asset-factory','LifeLoggerAI/B2Bportal','LifeLoggerAI/urai-studio']){
    assert.equal(isChalkRepositoryIdentity(id),true,id);
  }
});
test('path aliases and unsafe repository strings rejected',()=>{
  for(const id of invalid){assert.equal(isChalkRepositoryIdentity(id),false,id);}
});
test('Firestore bridge refuses parent directory alias without writing',async()=>{
  let writes=0;
  const jobId='engineering-test-123',actorUid='owner-identity-123',leaseToken='active-worker-secret-12345';
  const master={jobId,ownerUid:actorUid,type:'engineering.verify',status:'RUNNING',
    payload:{repository:'LifeLoggerAI/..',baseSha:'a'.repeat(40),requestDigest:'b'.repeat(64)},
    lease:{leaseToken,expiresAt:new Date(200000)},execution:{leaseToken,attemptCount:1}};
  const queue={jobId,status:'RUNNING',lease:{leaseToken,expiresAt:new Date(200000)}};
  const db={runTransaction:async fn=>fn({get:async r=>({exists:true,data:()=>r.which==='master'?master:queue}),update:()=>{writes++}})};
  const bridge=engineeringCheckpointBridge(db,{jobRef:()=>({which:'master'}),queueRef:()=>({which:'queue'}),now:()=>100000});
  await assert.rejects(bridge.persist({jobId,actorUid,leaseToken,attempt:1,expectedRevision:0,
    phase:'SOURCE_PINNED',outputDigest:'c'.repeat(64)}),/SOURCE_BINDING/);
  assert.equal(writes,0);
});
test('local restart prototype refuses parent-directory alias',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'urai-chalk-identity-'));
  try{
    const store=new EngineeringContinuityStore({directory});
    await assert.rejects(store.create({jobId:'engineering-test-123',ownerUid:'owner-identity-123',
      repository:'LifeLoggerAI/..',baseSha:'a'.repeat(40),requestDigest:'b'.repeat(64)}),/ENGINEERING_INPUT/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
