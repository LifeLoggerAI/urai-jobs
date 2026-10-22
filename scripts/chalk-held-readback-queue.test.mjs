import test from 'node:test';
import assert from 'node:assert/strict';
import {projectChalkHeldReadback} from '../functions/lib/functions/jobs/chalkReadbackAuthority.js';

const held = () => ({state:'HELD_UNQUEUED',environment:'firestore-emulator-only',
  workerAdmitted:false,providerSpendUsd:0,humanApprovalRequired:true});

test('HELD_UNQUEUED means the queue was actually observed absent',()=>{
  assert.deepEqual(projectChalkHeldReadback('PENDING',held(),false),
    {admission:'HELD_UNQUEUED',queued:false});
});
test('an existing queue must not be shown as held or queued:false',()=>{
  assert.deepEqual(projectChalkHeldReadback('PENDING',held(),true),
    {admission:'UNVERIFIED',queued:null});
});
for(const presence of [undefined,null,'false',0]){
  test('unknown queue observation fails closed: '+String(presence),()=>{
    assert.throws(()=>projectChalkHeldReadback('PENDING',held(),presence),/CHALK_READBACK_QUEUE_NOT_OBSERVED/);
  });
}
test('a running job cannot be portrayed as held',()=>{
  assert.deepEqual(projectChalkHeldReadback('RUNNING',held(),false),{admission:'UNVERIFIED',queued:null});
});
for(const [name,changes] of [
 ['worker admission',{workerAdmitted:true}],
 ['provider spend',{providerSpendUsd:1}],
 ['missing spend',{providerSpendUsd:undefined}],
 ['missing human approval',{humanApprovalRequired:undefined}],
 ['non-emulator origin',{environment:'production'}],
 ['missing admission state',{state:undefined}],
]){
 test('refuses '+name,()=>assert.deepEqual(projectChalkHeldReadback('PENDING',{...held(),...changes},false),
  {admission:'UNVERIFIED',queued:null}));
}
test('malformed admission fails closed',()=>{
 for(const value of [null,undefined,[],12,'HELD_UNQUEUED'])
  assert.deepEqual(projectChalkHeldReadback('PENDING',value,false),{admission:'UNVERIFIED',queued:null});
});
test('safe projection contains only nonprivate state',()=>{
 const result=projectChalkHeldReadback('PENDING',{...held(),secret:'private media'},false);
 assert.deepEqual(Object.keys(result),['admission','queued']);
 assert.equal(JSON.stringify(result).includes('private'),false);
 assert.equal(Object.isFrozen(result),true);
});
