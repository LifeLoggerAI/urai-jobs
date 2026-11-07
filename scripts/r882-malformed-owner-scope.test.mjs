/** R882: malformed scope identity must deny; legitimate unscoped legacy remains compatible. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedCurrentJobCaller, sameCurrentJobOwnerScope, boundJobMatchesCurrentOwnerScope } from '../functions/src/jobs/currentJobCallerAuthority.ts';

const identity = {uid:'owner',role:'user',disabled:false,tenantId:'tenant-a',orgId:'org-a'};
const record = {ownerUid:'owner',tenantId:'tenant-a',orgId:'org-a'};
const auth = {uid:'owner',token:{role:'operator'}};
const malformed = [42, true, false, [], {}, {id:'tenant-a'}];

test('R882 valid canonical scope still matches', () => {
  assert.equal(sameCurrentJobOwnerScope(identity,{...identity}),true);
  assert.equal(boundJobMatchesCurrentOwnerScope(record,identity,'owner'),true);
});
test('R882 normal tenant and organization transfers still deny', () => {
  assert.equal(sameCurrentJobOwnerScope(identity,{...identity,tenantId:'tenant-b'}),false);
  assert.equal(sameCurrentJobOwnerScope(identity,{...identity,orgId:'org-b'}),false);
  assert.equal(boundJobMatchesCurrentOwnerScope({...record,tenantId:'tenant-b'},identity,'owner'),false);
  assert.equal(boundJobMatchesCurrentOwnerScope({...record,orgId:'org-b'},identity,'owner'),false);
});
test('R882 absent/null/empty legacy scope stays compatible', () => {
  const legacy = {uid:'owner',role:'user'};
  const emptyJob = {ownerUid:'owner'};
  assert.equal(sameCurrentJobOwnerScope(legacy,{...legacy,tenantId:null,orgId:''}),true);
  assert.equal(boundJobMatchesCurrentOwnerScope(emptyJob,{...legacy,tenantId:null,orgId:''},'owner'),true);
  assert.equal(boundJobMatchesCurrentOwnerScope({...emptyJob,tenantId:null,orgId:' '},legacy,'owner'),true);
});
test('R882 canonical string trim behavior stays compatible', () => {
  assert.equal(sameCurrentJobOwnerScope(identity,{...identity,tenantId:' tenant-a ',orgId:'org-a  '}),true);
  assert.equal(boundJobMatchesCurrentOwnerScope({...record,tenantId:'tenant-a '},identity,'owner'),true);
});
for(const [key,other] of [['tenantId','orgId'],['orgId','tenantId']]){
  for(const [index,bad] of malformed.entries()){
    test(`R882 ${key} invalid type #${index} denies current caller, transition, bound job and both malformed`, () => {
      const badUser = {...identity,[key]:bad};
      const badJob = {...record,[key]:bad};
      assert.equal(checkedCurrentJobCaller(auth,badUser),null);
      assert.equal(sameCurrentJobOwnerScope(identity,badUser),false);
      assert.equal(sameCurrentJobOwnerScope(badUser,identity),false);
      assert.equal(sameCurrentJobOwnerScope(badUser,badUser),false);
      assert.equal(boundJobMatchesCurrentOwnerScope(record,badUser,'owner'),false);
      assert.equal(boundJobMatchesCurrentOwnerScope(badJob,identity,'owner'),false);
      assert.equal(boundJobMatchesCurrentOwnerScope(badJob,badUser,'owner'),false);
      // Invalid scope cannot be interpreted as legacy-missing even if the other field matches.
      assert.equal(boundJobMatchesCurrentOwnerScope({ownerUid:'owner',[other]:'x',[key]:bad},{...identity,[other]:'x',[key]:null},'owner'),false);
    });
  }
}
test('R882 malformed old and new scope values cannot hide a scope transfer', () => {
  assert.equal(sameCurrentJobOwnerScope({...identity,tenantId:123},{...identity,tenantId:{changed:true}}),false);
  assert.equal(sameCurrentJobOwnerScope({...identity,orgId:false},{...identity,orgId:{changed:true}}),false);
  assert.equal(boundJobMatchesCurrentOwnerScope({...record,tenantId:123},{...identity,tenantId:false},'owner'),false);
});
