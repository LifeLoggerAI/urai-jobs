import test from 'node:test';
import assert from 'node:assert/strict';
import {persistChalkHeldIntake} from '../functions/src/jobs/chalkHeldIntakeTransaction.ts';
import {buildChalkDiagnosticIntake} from '../functions/src/jobs/chalkDiagnosticIntakeAuthority.ts';
const sha='a'.repeat(40),owner='founder_1234';
const input=(id='diagnostic_123456')=>buildChalkDiagnosticIntake({requestId:id,problem:'The Focus transition stutters badly.',
 diagnostic:{kind:'chalk-spatial-diagnostic-v1',repository:'LifeLoggerAI/urai-spatial',
 sourceSha:sha,component:'focus',route:'/focus',selectedStar:null,
 frameSamples:4,p95Ms:40,status:'LOCAL_UNSUBMITTED',
 authority:'client-observation-not-server-verified'}},{ownerUid:owner,pinnedSourceSha:sha});
function db(){const store=new Map(),writes=[];return {store,writes,run(record=input(),nowMs=100000){
 const ref=(id)=>({id}),tx={get:async r=>({exists:store.has(r.id),data:()=>store.get(r.id)}),
 create:(r,v)=>{store.set(r.id,v);writes.push(r.id)},set:(r,v)=>{store.set(r.id,v);writes.push(r.id)}};
 return persistChalkHeldIntake({transaction:tx,masterRef:ref('jobs/'+record.jobId),
 queueRef:ref('jobQueue/'+record.jobId),logRef:ref('jobs/'+record.jobId+'/logs/created'),
 quotaRef:ref('chalkIntakeQuota/'+owner),record,nowMs,timestamp:{serverTimestamp:true}});
 }}}
test('new held job persists master and audit but never queue',async()=>{
 const x=db(),r=await x.run();assert.equal(r.queued,false);
 assert.equal(x.store.get('jobs/'+r.jobId).admission.state,'HELD_UNQUEUED');
 assert.equal(x.store.has('jobQueue/'+r.jobId),false);
 assert.equal(x.writes.length,3);
});
test('retry after restart is idempotent',async()=>{const x=db();await x.run();const writes=x.writes.length;
 assert.equal((await x.run()).deduplicated,true);assert.equal(x.writes.length,writes)});
test('changed payload with same identity refuses',async()=>{const x=db();await x.run();
 const record=input();record.payload.problem='changed';record.payload.requestDigest='f'.repeat(64);
 await assert.rejects(x.run(record),/REQUEST_CONFLICT/)});
test('preexisting queue blocks intake',async()=>{const x=db(),r=input();
 x.store.set('jobQueue/'+r.jobId,{status:'PENDING'});
 await assert.rejects(x.run(r),/QUEUE_PRESENT/)});
test('hourly quota is eight new jobs',async()=>{const x=db();for(let n=0;n<8;n++)await x.run(input('diagnostic_'+String(n).padStart(12,'0')));
 await assert.rejects(x.run(input('diagnostic_999999999999')),/RATE_LIMIT/)});
test('invalid quota fails closed',async()=>{const x=db();
 x.store.set('chalkIntakeQuota/'+owner,{windowStartMs:100000,count:-1});
 await assert.rejects(x.run(),/QUOTA_CORRUPT/)});
