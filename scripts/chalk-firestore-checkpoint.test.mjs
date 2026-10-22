import test from 'node:test';
import assert from 'node:assert/strict';
import { engineeringCheckpointBridge } from './chalk-firestore-checkpoint.mjs';

const jobId='engineering-task-123',actorUid='founder-identity-123';
const leaseToken='test-lease-token-abcdefgh';
const expiresAt=new Date(153456);
const sha='a'.repeat(40),requestDigest='b'.repeat(64),outputDigest='c'.repeat(64);
function fixture(){
  const data=new Map([
    ['jobs/'+jobId,{jobId,type:'engineering.verify',ownerUid:actorUid,payload:{repository:'LifeLoggerAI/urai-spatial',baseSha:sha,requestDigest},status:'RUNNING',lease:{leaseToken,expiresAt},execution:{leaseToken,attemptCount:1}}],
    ['jobQueue/'+jobId,{jobId,status:'RUNNING',lease:{leaseToken,expiresAt}}]
  ]);
  const snap=k=>({exists:data.has(k),data:()=>structuredClone(data.get(k))});
  const ref=key=>({key,get:async()=>snap(key)});
  const db={async runTransaction(fn){const writes=[];const result=await fn({get:async r=>snap(r.key),update:(r,p)=>writes.push([r.key,p])});for(const [key,patch] of writes){const old=data.get(key);for(const [field,value] of Object.entries(patch)){if(field==='execution.engineeringCheckpoint')old.execution.engineeringCheckpoint=value;else throw Error('unexpected field')}}return result;}};
  const bridge=engineeringCheckpointBridge(db,{jobRef:id=>ref('jobs/'+id),queueRef:id=>ref('jobQueue/'+id),now:()=>123456});
  const args={jobId,actorUid,leaseToken,attempt:1,expectedRevision:0,phase:'SOURCE_PINNED',outputDigest};
  return {data,bridge,args};
}
test('checkpoint writes existing master and reads back',async()=>{const {data,bridge,args}=fixture();assert.equal(await bridge.read({jobId,actorUid}),null);const saved=await bridge.persist(args);assert.equal(saved.revision,1);assert.deepEqual(await bridge.read({jobId,actorUid}),saved);assert.equal(data.size,2)});
test('duplicate revision cannot be replayed',async()=>{const {bridge,args}=fixture();await bridge.persist(args);await assert.rejects(bridge.persist(args),/REVISION_STALE/)});
test('both job and queue must retain current lease',async()=>{const {bridge,data,args}=fixture();data.get('jobQueue/'+jobId).lease.leaseToken='other';await assert.rejects(bridge.persist(args),/LEASE_STALE/);data.get('jobQueue/'+jobId).lease.leaseToken=leaseToken;data.get('jobs/'+jobId).execution.leaseToken='other';await assert.rejects(bridge.persist(args),/LEASE_STALE/)});
test('cancellation blocks writes',async()=>{const {bridge,data,args}=fixture();data.get('jobs/'+jobId).status='CANCELLED';await assert.rejects(bridge.persist(args),/LEASE_STALE/);data.get('jobs/'+jobId).status='RUNNING';data.get('jobQueue/'+jobId).status='CANCELLED';await assert.rejects(bridge.persist(args),/LEASE_STALE/)});
test('wrong owner and unadmitted job type denied',async()=>{const {bridge,data,args}=fixture();await assert.rejects(bridge.persist({...args,actorUid:'other-user-12345'}),/OWNER_OR_JOB/);await assert.rejects(bridge.read({jobId,actorUid:'other-user-12345'}),/OWNER_OR_JOB/);data.get('jobs/'+jobId).type='narrator.tts';await assert.rejects(bridge.persist(args),/TYPE/)});
test('tampered checksum and changed source fail closed',async()=>{const {bridge,data,args}=fixture();await bridge.persist(args);const check=data.get('jobs/'+jobId).execution.engineeringCheckpoint;check.outputDigest='d'.repeat(64);await assert.rejects(bridge.read({jobId,actorUid}),/CORRUPT/);check.outputDigest=outputDigest;data.get('jobs/'+jobId).payload.baseSha='f'.repeat(40);await assert.rejects(bridge.read({jobId,actorUid}),/CORRUPT/)});
test('new lease attempt resumes prior checkpoint',async()=>{const {bridge,data,args}=fixture();await bridge.persist(args);const token2='second-worker-lease-token';data.get('jobs/'+jobId).execution.attemptCount=2;data.get('jobs/'+jobId).lease.leaseToken=token2;data.get('jobs/'+jobId).execution.leaseToken=token2;data.get('jobQueue/'+jobId).lease.leaseToken=token2;await assert.rejects(bridge.persist({...args,expectedRevision:1}),/LEASE_STALE/);const next=await bridge.persist({...args,leaseToken:token2,attempt:2,expectedRevision:1,phase:'TESTS_VERIFIED'});assert.equal(next.revision,2);assert.equal((await bridge.read({jobId,actorUid})).phase,'TESTS_VERIFIED')});
test('invalid IDs and missing job reject',async()=>{const {bridge,data,args}=fixture();await assert.rejects(bridge.persist({...args,jobId:'../escape'}),/JOB_ID/);data.delete('jobs/'+jobId);await assert.rejects(bridge.persist(args),/MISSING/)});

test('expired master or queue lease cannot persist a checkpoint', async () => {
 const {bridge,data,args}=fixture();
 data.get('jobs/'+jobId).lease.expiresAt=new Date(123456);
 await assert.rejects(bridge.persist(args),/LEASE_STALE/);
 data.get('jobs/'+jobId).lease.expiresAt=expiresAt;
 data.get('jobQueue/'+jobId).lease.expiresAt=new Date(123455);
 await assert.rejects(bridge.persist(args),/LEASE_STALE/);
});
test('unknown or malformed expiry fails closed', async () => {
 const {bridge,data,args}=fixture();
 delete data.get('jobQueue/'+jobId).lease.expiresAt;
 await assert.rejects(bridge.persist(args),/LEASE_STALE/);
 data.get('jobQueue/'+jobId).lease.expiresAt='bad-timestamp';
 await assert.rejects(bridge.persist(args),/LEASE_STALE/);
});
test('checkpoint stages cannot be skipped or regressed', async () => {
 const {bridge,args}=fixture();
 await assert.rejects(bridge.persist({...args,phase:'TESTS_VERIFIED'}),/PHASE_ORDER/);
 const first=await bridge.persist(args);
 const second=await bridge.persist({...args,expectedRevision:first.revision,phase:'TESTS_VERIFIED'});
 await assert.rejects(bridge.persist({...args,expectedRevision:second.revision,phase:'SOURCE_PINNED'}),/PHASE_ORDER/);
});
test('same-stage same-result retry is idempotent', async () => {
 const {bridge,args}=fixture();
 const first=await bridge.persist(args);
 assert.deepEqual(await bridge.persist({...args,expectedRevision:first.revision}),first);
 await assert.rejects(bridge.persist({...args,expectedRevision:first.revision,outputDigest:'d'.repeat(64)}),/PHASE_ORDER/);
});
test('conflicting type/jobType is denied', async () => {
 const {bridge,data,args}=fixture();
 data.get('jobs/'+jobId).jobType='narrator.tts';
 await assert.rejects(bridge.persist(args),/TYPE/);
});
