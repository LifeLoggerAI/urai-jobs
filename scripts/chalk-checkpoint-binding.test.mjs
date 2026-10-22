import test from 'node:test';
import assert from 'node:assert/strict';
import { engineeringCheckpointBridge } from './chalk-firestore-checkpoint.mjs';

const jobId='engineering-identity-123';
const ownerUid='founder-owner-1234';
const leaseToken='safe-active-worker-lease-token';
const repository='LifeLoggerAI/urai-spatial';
const baseSha='a'.repeat(40);
const requestDigest='b'.repeat(64);
const outputDigest='c'.repeat(64);
function fixture() {
  const job={jobId,ownerUid,type:'engineering.verify',status:'RUNNING',
    payload:{repository,baseSha,requestDigest},
    lease:{leaseToken,expiresAt:new Date(150000)},
    execution:{leaseToken,attemptCount:1}};
  const queue={jobId,status:'RUNNING',lease:{leaseToken,expiresAt:new Date(150000)},ownerUid};
  const refs={['jobs/'+jobId]:job,['jobQueue/'+jobId]:queue};
  const toSnapshot=r=>({exists:!!refs[r.id],data:()=>structuredClone(refs[r.id])});
  const ref=id=>({id, get:async()=>toSnapshot({id})});
  let writes=0;
  const db={runTransaction:async handler=>{
    const patches=[];
    const result=await handler({get:async r=>toSnapshot(r),update:(r,patch)=>patches.push([r,patch])});
    for(const [r,patch] of patches){
      assert.equal(r.id,'jobs/'+jobId);
      assert.deepEqual(Object.keys(patch),['execution.engineeringCheckpoint']);
      job.execution.engineeringCheckpoint=patch['execution.engineeringCheckpoint'];
      writes++;
    }
    return result;
  }};
  const bridge=engineeringCheckpointBridge(db,{jobRef:id=>ref('jobs/'+id),queueRef:id=>ref('jobQueue/'+id),now:()=>120000});
  const args={jobId,actorUid:ownerUid,leaseToken,attempt:1,expectedRevision:0,phase:'SOURCE_PINNED',outputDigest};
  return {job,queue,bridge,args,writes:()=>writes};
}
test('saved checkpoint binds to owner, repository, pinned SHA and request',async()=>{
  const {bridge,args}=fixture();
  const p=await bridge.persist(args);
  assert.equal(p.ownerUid,ownerUid);
  assert.equal(p.repository,repository);
  assert.equal(p.sourceSha,baseSha);
  assert.equal(p.requestDigest,requestDigest);
  assert.deepEqual(await bridge.read({jobId,actorUid:ownerUid}),p);
});
test('repository substitution cannot reuse an otherwise valid checkpoint',async()=>{
  const f=fixture();await f.bridge.persist(f.args);
  f.job.payload.repository='LifeLoggerAI/urai-jobs';
  await assert.rejects(f.bridge.read({jobId,actorUid:ownerUid}),/CHALK_CHECKPOINT_CORRUPT/);
});
test('owner replacement cannot inherit an old checkpoint',async()=>{
  const f=fixture();await f.bridge.persist(f.args);
  f.job.ownerUid='attacker-owner-123';
  await assert.rejects(f.bridge.read({jobId,actorUid:'attacker-owner-123'}),/CHALK_CHECKPOINT_CORRUPT/);
});
test('queue owner mismatch denies write before any state change',async()=>{
  const f=fixture();f.queue.ownerUid='another-owner-123';
  await assert.rejects(f.bridge.persist(f.args),/CHALK_CHECKPOINT_LEASE_STALE/);
  assert.equal(f.writes(),0);
});
test('queue tenant and org alias mismatch are denied',async()=>{
  const f=fixture();f.job.tenantId='tenant-canonical';f.queue.tenantId='tenant-other';
  await assert.rejects(f.bridge.persist(f.args),/CHALK_CHECKPOINT_LEASE_STALE/);
  f.queue.tenantId=f.job.tenantId;f.queue.orgId='org-foreign';
  await assert.rejects(f.bridge.persist(f.args),/CHALK_CHECKPOINT_LEASE_STALE/);
});
test('invalid or missing canonical repository denies new checkpoint',async()=>{
  const f=fixture();delete f.job.payload.repository;
  await assert.rejects(f.bridge.persist(f.args),/CHALK_CHECKPOINT_SOURCE_BINDING/);
  f.job.payload.repository='../../tmp';
  await assert.rejects(f.bridge.persist(f.args),/CHALK_CHECKPOINT_SOURCE_BINDING/);
});
