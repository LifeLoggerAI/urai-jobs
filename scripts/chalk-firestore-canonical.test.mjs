import test from 'node:test';
import assert from 'node:assert/strict';
import { engineeringCheckpointBridge } from './chalk-firestore-checkpoint.mjs';

function fixture() {
  const jobId='engineering-checkpoint-123';
  const actorUid='founder-owner-123';
  const leaseToken='held-by-worker-token-12345';
  const nowMs=1700000000000;
  const master={jobId,ownerUid:actorUid,type:'engineering.verify',status:'RUNNING',
    payload:{repository:'LifeLoggerAI/urai-jobs',baseSha:'a'.repeat(40),requestDigest:'b'.repeat(64)},
    lease:{leaseToken,expiresAt:new Date(nowMs+90000)},execution:{leaseToken,attemptCount:1}};
  const queue={jobId,ownerUid:actorUid,status:'RUNNING',lease:{leaseToken,expiresAt:new Date(nowMs+90000)}};
  const refs={master,queue};
  const db={runTransaction:async callback=>callback({
    get:async ref=>({exists:true,data:()=>structuredClone(refs[ref.kind])}),
    update:(ref,patch)=>{
      assert.equal(ref.kind,'master');
      assert.deepEqual(Object.keys(patch),['execution.engineeringCheckpoint']);
      master.execution.engineeringCheckpoint=patch['execution.engineeringCheckpoint'];
    },
  })};
  const bridge=engineeringCheckpointBridge(db,{
    jobRef:()=>({kind:'master',get:async()=>({exists:true,data:()=>structuredClone(master)})}),
    queueRef:()=>({kind:'queue'}),now:()=>nowMs,
  });
  const args={jobId,actorUid,leaseToken,attempt:1,expectedRevision:0,
    phase:'SOURCE_PINNED',outputDigest:'c'.repeat(64)};
  return {bridge,master,args};
}

test('canonical digest accepts Firestore map field reorder without losing tamper protection',async()=>{
  const {bridge,master,args}=fixture();
  const written=await bridge.persist(args);
  const reordered=Object.fromEntries(Object.entries(written).reverse());
  master.execution.engineeringCheckpoint=reordered;
  assert.deepEqual(await bridge.read({jobId:args.jobId,actorUid:args.actorUid}),reordered);
  reordered.outputDigest='d'.repeat(64);
  await assert.rejects(bridge.read({jobId:args.jobId,actorUid:args.actorUid}),/CHALK_CHECKPOINT_CORRUPT/);
});

test('canonical digest rejects unrecognized fields',async()=>{
  const {bridge,master,args}=fixture();
  await bridge.persist(args);
  master.execution.engineeringCheckpoint.unexpected='hidden-data';
  await assert.rejects(bridge.read({jobId:args.jobId,actorUid:args.actorUid}),/CHALK_CHECKPOINT_CORRUPT/);
});
