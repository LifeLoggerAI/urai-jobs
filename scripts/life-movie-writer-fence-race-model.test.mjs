import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newReviewSnapshot,advanceReviewSnapshot, DENIED} from './review-only/life-movie-writer-fence-model.mjs';
const scope={ownerUid:'owner-1',tenantId:'tenant-1',projectId:'project-1',purpose:'life-movie.render'};
const evt=(kind,expectedEpoch,rest={})=>({kind,expectedEpoch,scope,...rest});
const initial=()=>newReviewSnapshot(scope);
const reserve=(s,id='attempt-1')=>advanceReviewSnapshot(s,evt('reserve',s.epoch,{attemptId:id}));
const begin=(s,id='attempt-1')=>advanceReviewSnapshot(s,evt('begin-upload',s.epoch,{attemptId:id}));
const uploaded=(s,id='attempt-1')=>advanceReviewSnapshot(s,evt('bytes-committed',s.epoch,{attemptId:id,generation:'123'}));
const withdraw=(s,eventId='event-1')=>advanceReviewSnapshot(s,evt('withdraw',s.epoch,{eventId}));
const settle=(s,id='attempt-1')=>advanceReviewSnapshot(s,evt('settle-attempt',s.epoch,{attemptId:id,reviewOnlyProof:{attemptId:id,epoch:s.epoch,writerStopped:true,storageGenerationAbsent:true,noPendingNetworkFinalize:true}}));
const ackProof=(s)=>({scope,epoch:s.epoch,storageAllApprovedBucketsEmpty:true,oldWriterIamDenied:true,brokerOldEpochDenied:true,noOutstandingUploadTokens:true,independentlyVerified:true});
const ack=(s,proof=ackProof(s))=>advanceReviewSnapshot(s,evt('acknowledge',s.epoch,{reviewOnlyProof:proof}));
const denied=(fn)=>assert.throws(fn,{message:DENIED});
test('initial model never grants cloud authority',()=>{let s=initial();assert.equal(s.phase,'OPEN');assert.equal(s.epoch,1);assert.equal(s.attempts.length,0);assert.ok(!('token' in s) && !('storageWriteAllowed' in s));});
test('reservation is scoped to exact owner, project and epoch',()=>{let s=reserve(initial());assert.equal(s.attempts[0].phase,'RESERVED');denied(()=>advanceReviewSnapshot(s,evt('reserve',s.epoch,{attemptId:'attempt-1'})));denied(()=>advanceReviewSnapshot(s,{...evt('reserve',s.epoch,{attemptId:'another'}),scope:{...scope,ownerUid:'other'}}));denied(()=>advanceReviewSnapshot(s,evt('reserve',0,{attemptId:'another'})));});
test('revocation is a monotonic epoch and refuses new reservations or uploads',()=>{let s=withdraw(reserve(initial()));assert.equal(s.epoch,2);assert.equal(s.phase,'FENCING');denied(()=>reserve(s,'attempt-2'));denied(()=>begin(s));});
test('same event retry never increments revocation epoch',()=>{let s=withdraw(initial());let t=withdraw(s);assert.equal(t.epoch,s.epoch);assert.equal(t.phase,'FENCING');denied(()=>withdraw(s,'different-event'));});
test('post-revocation bytes arriving create reconciliation debt, not authority',()=>{let s=withdraw(begin(reserve(initial())));s=uploaded(s);assert.equal(s.attempts[0].phase,'RECONCILE_REQUIRED');assert.equal(s.attempts[0].generation,'123');denied(()=>ack(s));});
test('uploaded but not finalized cannot be finalized after withdrawal',()=>{let s=uploaded(begin(reserve(initial())));s=withdraw(s);denied(()=>advanceReviewSnapshot(s,evt('finalize',s.epoch,{attemptId:'attempt-1'})));});
test('recorded existing media is still cleanup debt on withdrawal',()=>{let s=uploaded(begin(reserve(initial())));s=advanceReviewSnapshot(s,evt('finalize',s.epoch,{attemptId:'attempt-1'}));s=withdraw(s);assert.equal(s.attempts[0].phase,'RECONCILE_REQUIRED');denied(()=>ack(s));});
test('timeout never settles an in-flight attempt',()=>{let s=withdraw(begin(reserve(initial())));denied(()=>advanceReviewSnapshot(s,evt('settle-attempt',s.epoch,{attemptId:'attempt-1',reviewOnlyProof:{attemptId:'attempt-1',epoch:s.epoch,writerStopped:false,storageGenerationAbsent:true,noPendingNetworkFinalize:true,timeoutOnly:true}})));});
test('storage absence alone cannot claim upload attempt settled',()=>{let s=withdraw(begin(reserve(initial())));denied(()=>advanceReviewSnapshot(s,evt('settle-attempt',s.epoch,{attemptId:'attempt-1',reviewOnlyProof:{attemptId:'attempt-1',epoch:s.epoch,writerStopped:true,storageGenerationAbsent:true,noPendingNetworkFinalize:false}})));});
test('old writer IAM denial required even after all attempts settle',()=>{let s=settle(withdraw(begin(reserve(initial()))));denied(()=>ack(s,{...ackProof(s),oldWriterIamDenied:false}));denied(()=>ack(s,{...ackProof(s),brokerOldEpochDenied:false}));});
test('all approved Storage bucket scopes must be empty for ACK',()=>{let s=settle(withdraw(begin(reserve(initial()))));denied(()=>ack(s,{...ackProof(s),storageAllApprovedBucketsEmpty:false}));});
test('outstanding upload tokens veto ACK after all known objects deleted',()=>{let s=settle(withdraw(begin(reserve(initial()))));denied(()=>ack(s,{...ackProof(s),noOutstandingUploadTokens:false}));});
test('unsigned or mismatched review-only proof cannot acknowledge',()=>{let s=withdraw(initial());denied(()=>ack(s,{...ackProof(s),independentlyVerified:false}));denied(()=>ack(s,{...ackProof(s),scope:{...scope,projectId:'elsewhere'}}));denied(()=>ack(s,{...ackProof(s),epoch:1}));});
test('synthetic all-green flags never authorize completed deletion ACK',()=>{let s=settle(withdraw(begin(reserve(initial()))));assert.equal(s.attempts[0].phase,'REVIEW_ONLY_SETTLED');denied(()=>ack(s));assert.equal(s.phase,'FENCING');assert.equal(s.acknowledged,false);denied(()=>reserve(s,'attempt-2'));});
test('failed cross-project identity cannot settle a different attempt',()=>{let s=withdraw(reserve(initial()));denied(()=>advanceReviewSnapshot(s,{...evt('settle-attempt',s.epoch,{attemptId:'attempt-1',reviewOnlyProof:{attemptId:'attempt-1',epoch:s.epoch,writerStopped:true,storageGenerationAbsent:true,noPendingNetworkFinalize:true}}),scope:{...scope,tenantId:'tenant-2'}}));});
test('multiple simulated reconciliations cannot turn FENCING into completed deletion',()=>{let s=reserve(reserve(initial(),'one'),'two');s=withdraw(s);s=settle(s,'one');denied(()=>ack(s));s=settle(s,'two');denied(()=>ack(s));assert.equal(s.phase,'FENCING');assert.equal(s.acknowledged,false);});
test('no timeout or stale epoch can re-open a fenced scope without deletion ACK',()=>{let s=withdraw(initial());denied(()=>ack(s));denied(()=>reserve(s));denied(()=>advanceReviewSnapshot(s,evt('begin-upload',1,{attemptId:'a'})));assert.equal(withdraw(s).phase,'FENCING');assert.equal(s.acknowledged,false);});

test('forged REVOKED state and acknowledged=true snapshots fail closed',()=>{
  let s=withdraw(initial());
  denied(()=>advanceReviewSnapshot({...s,phase:'REVOKED',acknowledged:true},evt('withdraw',s.epoch,{eventId:'event-1'})));
  denied(()=>advanceReviewSnapshot({...s,acknowledged:true},evt('withdraw',s.epoch,{eventId:'event-1'})));
  denied(()=>advanceReviewSnapshot({...s,schemaVersion:'urai-review-only-output-writer-fence-r521-v1'},evt('withdraw',s.epoch,{eventId:'event-1'})));
});
test('zero attempts plus forged all-green independent-review booleans still cannot ACK',()=>{
  const s=withdraw(initial());
  denied(()=>ack(s,ackProof(s)));
  denied(()=>ack(s,{...ackProof(s),independentlyVerified:true,cloudApiGcs403:true,certificate:'forged'}));
  assert.equal(s.phase,'FENCING'); assert.equal(s.acknowledged,false);
});
test('forced OPEN state at old epoch and FENCING without event are rejected',()=>{
  const s=withdraw(initial());
  denied(()=>advanceReviewSnapshot({...s,phase:'OPEN'},evt('reserve',s.epoch,{attemptId:'new'})));
  denied(()=>advanceReviewSnapshot({...s,revokedBy:null},evt('withdraw',s.epoch,{eventId:'event-1'})));
});
test('pure model admits no REVOKED transition even after every simulated attempt settles',()=>{
  let s=settle(withdraw(begin(reserve(initial()))));
  for(const proof of [undefined,ackProof(s),{...ackProof(s),storageAllApprovedBucketsEmpty:true}]) {
    denied(()=>ack(s,proof));
  }
  assert.equal(s.attempts[0].phase,'REVIEW_ONLY_SETTLED');
  assert.equal(s.phase,'FENCING');
});


test('R646: forged attempt identities and duplicate reservations are rejected before any transition',()=>{
  const valid=reserve(initial());
  for(const attempts of [
    [null], [{}], [{...valid.attempts[0],id:'bad path'}],
    [valid.attempts[0],{...valid.attempts[0]}],
    [{...valid.attempts[0],epoch:0}],
    [{...valid.attempts[0],epoch:2}],
    [{...valid.attempts[0],phase:'RECORDED',generation:null}],
    [{...valid.attempts[0],phase:'REVOKED'}],
    [{...valid.attempts[0],phase:'RESERVED',generation:'999'}],
    [{...valid.attempts[0],phase:'UPLOADED_NOT_FINAL',generation:'0'}],
    [{...valid.attempts[0],phase:'UPLOADED_NOT_FINAL',generation:'1e3'}],
    [{...valid.attempts[0],phase:'UPLOADED_NOT_FINAL',generation:'9007199254740992'}]
  ]) {
    denied(()=>advanceReviewSnapshot({...valid,attempts},evt('reserve',valid.epoch,{attemptId:'fresh'})));
  }
});

test('R646: forged post-withdrawal attempt phases or epochs cannot become synthetic settlement',()=>{
  const fenced=withdraw(begin(reserve(initial())));
  for(const attempt of [
    {...fenced.attempts[0],phase:'RECORDED',generation:'123'},
    {...fenced.attempts[0],phase:'REVIEW_ONLY_SETTLED',generation:'0'},
    {...fenced.attempts[0],phase:'UPLOADING'},
    {...fenced.attempts[0],epoch:fenced.epoch},
    {...fenced.attempts[0],epoch:-1},
    {...fenced.attempts[0],id:'invalid/path'},
  ]) {
    denied(()=>advanceReviewSnapshot({...fenced,attempts:[attempt]},evt('settle-attempt',fenced.epoch,{
      attemptId:'attempt-1',reviewOnlyProof:{attemptId:'attempt-1',epoch:fenced.epoch,
        writerStopped:true,storageGenerationAbsent:true,noPendingNetworkFinalize:true}
    })));
  }
});

console.log('R573_REVIEW_ONLY_REVOCATION_ACK_HARD_DENY modelOnly=true storageAuthority=false deletionAck=false');
