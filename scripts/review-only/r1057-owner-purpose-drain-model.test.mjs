import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnerPurposeDrainReview, REVIEW_DENIED } from './r1057-owner-purpose-drain-model.mjs';
const a = {ownerUid:'owner-a',purpose:'life-movie.render',tenantId:'tenant-a',projectId:'movie-a'};
const b = {...a,tenantId:'tenant-b',projectId:'movie-b'};
const c = {...a,tenantId:'tenant-c',projectId:'movie-c'};
const create = () => new OwnerPurposeDrainReview(a.ownerUid);
const DENIED = new RegExp(REVIEW_DENIED);
const reserve = (m,s,attemptId='attempt-a') => m.transition(s,'reserve',{attemptId});
const begin = (m,s,attemptId='attempt-a') => m.transition(s,'begin-upload',{attemptId});
test('initial aggregate never creates production or deletion authority',()=>{
  const m=create();assert.equal(m.summary().phase,'OPEN');assert.equal(m.summary().deletionAcknowledgementPermitted,false);
  assert.equal(m.summary().productionAuthorized,false);assert.throws(()=>m.acknowledge(),DENIED);
});
test('owner-wide withdrawal before any scope permanently fences future scope',()=>{
  const m=create();m.withdraw('event-a');assert.equal(m.register(a).phase,'FENCING');
  assert.throws(()=>reserve(m,a),DENIED);assert.equal(m.summary().scopeCount,1);
});
test('withdrawal before any project fences second and third later project',()=>{
  const m=create();m.withdraw('event-a');for(const s of [a,b,c]){
    assert.equal(m.register(s).phase,'FENCING');assert.throws(()=>reserve(m,s),DENIED);
  }assert.equal(m.summary().scopeCount,3);
});
test('owner-wide withdrawal fences pre-existing projects in distinct tenants',()=>{
  const m=create();m.register(a);m.register(b);reserve(m,a,'one');reserve(m,b,'two');m.withdraw('event-a');
  assert.equal(m.register(a).phase,'FENCING');assert.equal(m.register(b).phase,'FENCING');
  assert.throws(()=>begin(m,b,'two'),DENIED);assert.equal(m.summary().unsettledAttemptCount,2);
});
test('an in-flight upload finishing after withdrawal remains unsettled everywhere',()=>{
  const m=create();m.register(a);m.register(b);reserve(m,a,'a1');reserve(m,b,'b1');begin(m,b,'b1');
  m.withdraw('event-a');m.transition(b,'bytes-committed',{attemptId:'b1',generation:'123'});
  assert.equal(m.summary().unsettledAttemptCount,2);assert.equal(m.summary().deletionAcknowledgementPermitted,false);
});
test('even synthetic settlement of all known projects never grants deletion ACK',()=>{
  const m=create();m.register(a);m.register(b);reserve(m,a,'a1');reserve(m,b,'b1');m.withdraw('event-a');
  for(const [s,attemptId] of [[a,'a1'],[b,'b1']]){
    const epoch=m.register(s).epoch;m.transition(s,'settle-attempt',{attemptId,reviewOnlyProof:{attemptId,epoch,
      writerStopped:true,storageGenerationAbsent:true,noPendingNetworkFinalize:true}});
  }
  assert.equal(m.summary().unsettledAttemptCount,0);assert.equal(m.summary().allReviewAttemptsSettled,true);
  assert.equal(m.summary().storageInventoryVerified,false);assert.throws(()=>m.acknowledge(),DENIED);
});
test('same-event withdrawal retry does not increment epoch',()=>{
  const m=create();m.register(a);m.withdraw('event-a');const epoch=m.register(a).epoch;
  m.withdraw('event-a');assert.equal(m.register(a).epoch,epoch);
});
test('conflicting withdrawal event cannot reopen or swap canonical event',()=>{
  const m=create();m.register(a);m.withdraw('event-a');assert.throws(()=>m.withdraw('event-b'),DENIED);
  assert.equal(m.register(a).phase,'FENCING');
});
test('out-of-scope owner and invalid purposes are denied',()=>{
  const m=create();assert.throws(()=>m.register({...a,ownerUid:'owner-b'}),DENIED);
  assert.throws(()=>m.register({...a,purpose:'other'}),DENIED);
  assert.throws(()=>new OwnerPurposeDrainReview('owner-a','other'),DENIED);
});
test('malformed tenant/project IDs are denied rather than aliased',()=>{
  const m=create();for(const s of [{...a,projectId:'../evil'},{...a,tenantId:''},{...a,projectId:'x/y'}])
    assert.throws(()=>m.register(s),DENIED);
});
test('duplicate attempt IDs across tenants and projects cannot alias',()=>{
  const m=create();m.register(a);m.register(b);reserve(m,a,'same');assert.throws(()=>reserve(m,b,'same'),DENIED);
});
test('cannot reserve, start or finalize after owner-wide withdrawal',()=>{
  const m=create();m.register(a);reserve(m,a,'one');m.withdraw('event-a');
  for(const kind of ['reserve','begin-upload','finalize'])assert.throws(()=>m.transition(a,kind,{attemptId:'one'}),DENIED);
});
test('unknown project cannot mutate ledger without prior registration',()=>{
  const m=create();assert.throws(()=>reserve(m,a),DENIED);assert.equal(m.summary().scopeCount,0);
});
test('late-byte record for unknown attempt is denied by underlying model',()=>{
  const m=create();m.register(a);m.withdraw('event-a');
  assert.throws(()=>m.transition(a,'bytes-committed',{attemptId:'missing',generation:'123'}));
});
test('caller mutation of returned snapshot does not change ledger',()=>{
  const m=create();let copy=m.register(a);copy.phase='REVOKED';copy.attempts.push({id:'forged'});
  assert.equal(m.register(a).phase,'OPEN');assert.equal(m.summary().attemptCount,0);
});
test('separate owner ledger is unaffected by someone else withdrawing',()=>{
  const m=create(),n=new OwnerPurposeDrainReview('owner-b');m.withdraw('event-a');
  assert.equal(n.register({...a,ownerUid:'owner-b'}).phase,'OPEN');assert.equal(n.summary().phase,'OPEN');
});
test('inventory unknown even with no attempts or scopes can never be ACKed',()=>{
  const m=create();m.withdraw('event-a');assert.equal(m.summary().allReviewAttemptsSettled,true);
  assert.equal(m.summary().deletionAcknowledgementPermitted,false);assert.throws(()=>m.acknowledge(),DENIED);
});
