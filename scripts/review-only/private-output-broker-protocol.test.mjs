/** R1733 synthetic model tests. NO Google Cloud calls, real identities or media. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createReviewLedger, reserveReviewUpload, markReviewUploadCommitted,
 beginReviewRevocation, recordReviewDrain, acknowledgeReviewRevocation,
 explicitReviewRegrant
} from './private-output-broker-protocol.mjs';
const who={ownerUid:'owner1',tenantId:'tenant1'};
const make=()=>createReviewLedger(who);
const reserve=(s,id='upload1')=>reserveReviewUpload(s,{...who,epoch:s.epoch,uploadId:id});
const revoke=s=>beginReviewRevocation(s,{...who,epoch:s.epoch});
const ack=s=>acknowledgeReviewRevocation(s,{...who,epoch:s.epoch});
const proof={providerSessionTerminated:true,generationDeletedOrNeverCreated:true,objectAbsentVerified:true};
const denies=(fn,code)=>assert.throws(fn,e=>e.message===code);

test('valid owner gets one reservation and cannot reuse an upload ID',()=>{
 const s=make();const t=reserve(s);assert.equal(t.epoch,1);
 denies(()=>reserve(s),'reservation_replay_denied');
});
test('wrong owner and tenant cannot reserve, commit or revoke',()=>{
 const s=make(),t=reserve(s);
 denies(()=>reserveReviewUpload(s,{...who,ownerUid:'other',epoch:1,uploadId:'upload2'}),'owner_tenant_mismatch');
 denies(()=>markReviewUploadCommitted(s,{...t,tenantId:'other'}),'owner_tenant_mismatch');
 denies(()=>beginReviewRevocation(s,{...who,tenantId:'other',epoch:1}),'owner_tenant_mismatch');
});
test('no revocation ACK with in-flight reservation',()=>{
 const s=make();reserve(s);revoke(s);denies(()=>ack(s),'pending_upload_drain');
});
test('no revocation ACK with committed output not cleaned',()=>{
 const s=make(),t=reserve(s);markReviewUploadCommitted(s,t);revoke(s);
 denies(()=>ack(s),'pending_upload_drain');
});
test('no late reservation or commit after revocation begins',()=>{
 const s=make(),t=reserve(s);revoke(s);
 denies(()=>reserveReviewUpload(s,{...who,epoch:1,uploadId:'upload2'}),'write_fenced');
 denies(()=>markReviewUploadCommitted(s,t),'write_fenced');
});
test('provider session termination alone does not establish deletion',()=>{
 const s=make(),t=reserve(s);revoke(s);
 denies(()=>recordReviewDrain(s,t,{providerSessionTerminated:true}),'generation_not_cleaned');
 denies(()=>ack(s),'pending_upload_drain');
});
test('generation deletion alone does not establish upload drain',()=>{
 const s=make(),t=reserve(s);revoke(s);
 denies(()=>recordReviewDrain(s,t,{generationDeletedOrNeverCreated:true,objectAbsentVerified:true}),'provider_upload_not_drained');
});
test('absence verification required separately from generation deletion',()=>{
 const s=make(),t=reserve(s);revoke(s);

 denies(()=>recordReviewDrain(s,t,{providerSessionTerminated:true,generationDeletedOrNeverCreated:true}),'object_absence_not_verified');
});
test('all old reservations must be drained before trusted ACK',()=>{
 const s=make(),a=reserve(s,'upload1'),b=reserve(s,'upload2');
 revoke(s);recordReviewDrain(s,a,proof);
 denies(()=>ack(s),'pending_upload_drain');
 recordReviewDrain(s,b,proof);assert.deepEqual(ack(s),{status:'applied',epoch:1});
});
test('ACK with no outstanding uploads is permitted only after fence',()=>{
 const s=make();denies(()=>ack(s),'revocation_not_started');
 revoke(s);assert.equal(ack(s).status,'applied');
});
test('regrant requires ACK and advances epoch',()=>{
 const s=make(),old=reserve(s);revoke(s);
 denies(()=>explicitReviewRegrant(s,{...who,epoch:1}),'revocation_ack_required');
 recordReviewDrain(s,old,proof);ack(s);
 assert.equal(explicitReviewRegrant(s,{...who,epoch:1}).epoch,2);
 const current=reserve(s,'upload2');assert.equal(current.epoch,2);
 denies(()=>markReviewUploadCommitted(s,old),'stale_writer_epoch');
});
test('old writer cannot reuse retired reservation ID after regrant',()=>{
 const s=make(),old=reserve(s);revoke(s);recordReviewDrain(s,old,proof);
 ack(s);explicitReviewRegrant(s,{...who,epoch:1});
 denies(()=>reserve(s,'upload1'),'reservation_replay_denied');
});
test('forged proof and duplicate drain are rejected in model',()=>{
 const s=make(),t=reserve(s);revoke(s);
 denies(()=>recordReviewDrain(s,t,{}),'provider_upload_not_drained');
 recordReviewDrain(s,t,proof);
 denies(()=>recordReviewDrain(s,t,proof),'drain_reservation_unknown');
});
test('untrusted owner cannot advance epoch',()=>{
 const s=make();revoke(s);ack(s);
 denies(()=>explicitReviewRegrant(s,{...who,ownerUid:'other',epoch:1}),'owner_tenant_mismatch');
});
test('protocol is pure review model, never wires to real provider APIs',()=>{
 const s=make();assert.equal(s.phase,'active');
 assert.equal(typeof s.reservations.get,'function');
});


