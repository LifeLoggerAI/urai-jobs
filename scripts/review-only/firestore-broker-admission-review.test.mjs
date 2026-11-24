/**
 * R1734 Firestore EMULATOR ONLY. No cloud creds, live IAM, GCS or private data.
 * Run with localhost 18180; intentionally refuse any other host.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createFirestoreBrokerReview} from './firestore-broker-admission-review.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18180','EMULATOR_ONLY');
const app=initializeApp({projectId:'urai-r1734-disposable'},'r1734-'+randomUUID());
const db=getFirestore(app);
test.after(async()=>{await db.terminate();await deleteApp(app)});
const ownerUid='synthetic-owner', otherUid='synthetic-other';
function fixture() {
 const tenantId='t-'+randomUUID(),broker=createFirestoreBrokerReview(db);
 const args={ownerUid,tenantId,epoch:1};
 return {broker,args,initialize:()=>broker.initializeReview({ownerUid,tenantId})};
}
const denied=async(p,code)=>assert.rejects(p,e=>e.message===code);
const reserve=(broker,args,id='uploadA')=>broker.reserveReview({...args,uploadId:id});
const revoke=(broker,args)=>broker.beginReviewRevocation(args);
const ack=(broker,args)=>broker.acknowledgeReviewRevocation(args);
const proof=(args,id)=>({receiptId:'mock-review-receipt',authentic:true,...args,uploadId:id,
 providerSessionTerminated:true,generationDeletedOrNeverCreated:true,objectAbsentVerified:true});
const drain=(broker,args,id='uploadA',verifier=async()=>proof(args,id))=>
 broker.recordReviewDrain({...args,uploadId:id},{receipt:{fixtureId:'synthetic-receipt'},verifyProviderEvidence:verifier});
test('initialize persists one owner and rejects overwrite',async()=>{
 const f=fixture();assert.deepEqual(await f.initialize(),{epoch:1});
 await denied(f.initialize(),'review_state_already_initialized');
 assert.equal((await f.broker.inspectReview(f.args.tenantId)).ownerUid,ownerUid);
});
test('owner and tenant scope mismatch are denied',async()=>{
 const f=fixture();await f.initialize();
 await denied(reserve(f.broker,{...f.args,ownerUid:otherUid}),'owner_tenant_mismatch');
 await denied(revoke(f.broker,{...f.args,ownerUid:otherUid}),'owner_tenant_mismatch');
});
test('reserving same upload ID twice is rejected',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);
 await denied(reserve(f.broker,f.args),'reservation_replay_denied');
});
test('reservation is persistent across independent broker instance',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);
 const second=createFirestoreBrokerReview(db);
 await denied(reserve(second,f.args),'reservation_replay_denied');
});
test('a committed generation still blocks revocation ACK',async()=>{
 const f=fixture();await f.initialize();const t=await reserve(f.broker,f.args);
 await f.broker.commitReview(t);await revoke(f.broker,f.args);
 await denied(ack(f.broker,f.args),'pending_upload_drain');
});
test('revocation fences late reservations and commits',async()=>{
 const f=fixture();await f.initialize();const t=await reserve(f.broker,f.args);
 await revoke(f.broker,f.args);
 await denied(reserve(f.broker,f.args,'uploadB'),'write_fenced');
 await denied(f.broker.commitReview(t),'write_fenced');
});
test('raw fixture booleans cannot bypass missing independent verifier',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);await revoke(f.broker,f.args);
 await denied(f.broker.recordReviewDrain({...f.args,uploadId:'uploadA'},{
  receipt:{providerSessionTerminated:true,generationDeletedOrNeverCreated:true,objectAbsentVerified:true}
 }), 'trusted_provider_verifier_missing');
});

test('negative external verifier result cannot close reservation',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);await revoke(f.broker,f.args);
 await denied(drain(f.broker,f.args,'uploadA',async()=>({...proof(f.args,'uploadA'),authentic:false})),
  'trusted_provider_evidence_missing');
 await denied(ack(f.broker,f.args),'pending_upload_drain');
});
test('missing session termination, generation delete, or absence prevents drain',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);await revoke(f.broker,f.args);
 for(const flag of ['providerSessionTerminated','generationDeletedOrNeverCreated','objectAbsentVerified']){
  await denied(drain(f.broker,f.args,'uploadA',async()=>({...proof(f.args,'uploadA'),[flag]:false})),
   'trusted_provider_evidence_missing');
 }
 await denied(ack(f.broker,f.args),'pending_upload_drain');
});
test('wrong owner, tenant, epoch or uploadId in verified mock are denied',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);await revoke(f.broker,f.args);
 for(const bad of [{ownerUid:otherUid},{tenantId:'t-other'},{epoch:2},{uploadId:'wrong'}]){
  await denied(drain(f.broker,f.args,'uploadA',async()=>({...proof(f.args,'uploadA'),...bad})),
   'trusted_provider_evidence_missing');
 }
});
test('drain one of two reservations does not allow ACK',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args,'uploadA');
 await reserve(f.broker,f.args,'uploadB');await revoke(f.broker,f.args);
 await drain(f.broker,f.args,'uploadA');await denied(ack(f.broker,f.args),'pending_upload_drain');
 await drain(f.broker,f.args,'uploadB');assert.equal((await ack(f.broker,f.args)).status,'applied');
});
test('duplicate drain receipt cannot close an already drained upload',async()=>{
 const f=fixture();await f.initialize();await reserve(f.broker,f.args);await revoke(f.broker,f.args);
 await drain(f.broker,f.args);await denied(drain(f.broker,f.args),'drain_reservation_unknown');
});
test('post-ACK same-epoch write is refused until explicit regrant',async()=>{
 const f=fixture();await f.initialize();await revoke(f.broker,f.args);
 await ack(f.broker,f.args);
 await denied(reserve(f.broker,f.args,'uploadA'),'write_fenced');
 const next=await f.broker.explicitReviewRegrant(f.args);assert.equal(next.epoch,2);
 await denied(reserve(f.broker,f.args,'uploadB'),'stale_writer_epoch');
 assert.equal((await reserve(f.broker,{...f.args,epoch:2},'uploadB')).epoch,2);
});

test('old writer cannot commit or reuse retired reservation after regrant',async()=>{
 const f=fixture();await f.initialize();const token=await reserve(f.broker,f.args);
 await revoke(f.broker,f.args);await drain(f.broker,f.args);await ack(f.broker,f.args);
 await f.broker.explicitReviewRegrant(f.args);
 await denied(f.broker.commitReview(token),'stale_writer_epoch');
 await denied(reserve(f.broker,{...f.args,epoch:2},'uploadA'),'reservation_replay_denied');
});
test('concurrent duplicate reserves serialize to exactly one admission',async()=>{
 const f=fixture();await f.initialize();
 const all=await Promise.allSettled(Array.from({length:6},()=>reserve(f.broker,f.args)));
 assert.equal(all.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(all.filter(x=>x.status==='rejected').length,5);
});
test('revocation and reservation interleave without ACK of unsettled upload',async()=>{
 const f=fixture();await f.initialize();
 const all=await Promise.allSettled([reserve(f.broker,f.args),revoke(f.broker,f.args)]);
 const state=await f.broker.inspectReview(f.args.tenantId);
 assert.equal(state.phase,'revoking');
 if(all[0].status==='fulfilled') await denied(ack(f.broker,f.args),'pending_upload_drain');
 else assert.equal((await ack(f.broker,f.args)).status,'applied');
});
test('no production runtime, GCS provider or credential APIs in protocol source',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('./firestore-broker-admission-review.mjs',import.meta.url),'utf8');
 assert.ok(!src.includes("from 'firebase-admin")&&!src.includes('createWriteStream'));
});

test('Firestore deny-all rules reject unauthenticated direct REST reads and writes',async()=>{
 const ref=db.collection('r1734UnprivilegedRulesCheck').doc('visible-document');
 await ref.set({secret:'synthetic-only'});
 const uri='http://127.0.0.1:18180/v1/projects/urai-r1734-disposable/databases/(default)/documents/r1734UnprivilegedRulesCheck/visible-document';
 const get=await fetch(uri,{redirect:'error'});
 assert.equal(get.status,403,'unprivileged REST read must be denied by emulator rules');
 const patch=await fetch(uri,{method:'PATCH',redirect:'error',headers:{'content-type':'application/json'},
  body:JSON.stringify({fields:{secret:{stringValue:'untrusted'}}})});
 assert.equal(patch.status,403,'unprivileged REST write must be denied by emulator rules');
});
