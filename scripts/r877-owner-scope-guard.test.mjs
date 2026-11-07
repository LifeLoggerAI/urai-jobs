import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameCurrentJobOwnerScope as same, boundJobMatchesCurrentOwnerScope as bound } from '../functions/src/jobs/currentJobCallerAuthority.ts';
const user = (tenantId = 'tenant-a', orgId = 'org-a') => ({ uid: 'owner-a', role: 'user', disabled: false, tenantId, orgId });
const job = (tenantId = 'tenant-a', orgId = 'org-a') => ({ ownerUid: 'owner-a', tenantId, orgId, jobId: 'job-a' });
test('R877 unchanged tenant and organization accepted', () => {
  assert.equal(same(user(), user()), true);
  assert.equal(bound(job(), user(), 'owner-a'), true);
});
test('R877 changed tenant denied at admission', () => {
  assert.equal(same(user(), user('tenant-b')), false);
});
test('R877 changed organization denied at admission', () => {
  assert.equal(same(user(), user('tenant-a', 'org-b')), false);
});
test('R877 preexisting job from an old tenant denied on idempotent replay', () => {
  assert.equal(bound(job(), user('tenant-b'), 'owner-a'), false);
});
test('R877 preexisting job from an old organization denied on idempotent replay', () => {
  assert.equal(bound(job(), user('tenant-a', 'org-b'), 'owner-a'), false);
});
test('R877 foreign owner job cannot match a valid binding', () => {
  assert.equal(bound({ ...job(), ownerUid: 'other' }, user(), 'owner-a'), false);
});
test('R877 legacy absent scope remains compatible while crossed scope denies', () => {
  const legacy = { uid: 'owner-a', role: 'user' };
  assert.equal(same(legacy, legacy), true);
  assert.equal(bound({ ownerUid: 'owner-a' }, legacy, 'owner-a'), true);
  assert.equal(same(legacy, user()), false);
  assert.equal(bound({ ownerUid: 'owner-a' }, user(), 'owner-a'), false);
});
test('R877 malformed or untrusted job and account scope rejected', () => {
  for (const value of [null, undefined, '', [], {}, 4]) {
    assert.equal(same(value, user()), false);
    assert.equal(bound(value, user(), 'owner-a'), false);
  }
  assert.equal(bound(job(), user(), ''), false);
});
