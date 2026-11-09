import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkedCurrentJobCaller } from '../functions/src/jobs/currentJobCallerAuthority.ts';

/** R898 SOURCE-LEVEL review. Does NOT exercise real Firebase Authentication,
 * Firestore snapshots, external GCS or the full data-rights lifecycle. */
const auth = { uid: 'operator-r898', token: { role: 'operator', uraiJobsAdmin: true } };
const active = { uid: 'operator-r898', role: 'operator', disabled: false, accountStatus: 'active' };
const eligible = user => checkedCurrentJobCaller(auth, user)?.operator === true;
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('R898 policy: live operator and admin are allowed', () => {
  assert.equal(eligible(active), true);
  assert.equal(eligible({ ...active, role: 'admin' }), true);
});
test('R898 policy: stale operator claim cannot elevate current user role', () => {
  assert.equal(eligible({ ...active, role: 'user' }), false);
});
for (const [label, user] of [
  ['disabled', { ...active, disabled: true }],
  ['deleted', { ...active, deleted: true }],
  ['marked for deletion', { ...active, markedForDeletion: true }],
  ['central privacy deletion', { ...active, dataRightsDeletionPendingCentralPrivacy: true }],
  ['suspended', { ...active, accountStatus: 'suspended' }],
  ['deleted status', { ...active, accountStatus: 'deleted' }],
  ['malformed disabled', { ...active, disabled: 'false' }],
  ['malformed deletion', { ...active, deleted: null }],
  ['malformed tenant', { ...active, tenantId: 21 }],
  ['malformed organization', { ...active, orgId: { id: 'one' } }],
  ['missing current user', null],
  ['foreign user document', { ...active, uid: 'somebody-else' }],
  ['unknown role', { ...active, role: 'superoperator' }],
]) {
  test('R898 policy: deny '+label, () => assert.equal(eligible(user), false));
}
test('R898 policy: historically absent optional scope flags do not elevate ordinary users', () => {
  assert.equal(eligible({ uid: 'operator-r898', role: 'user' }), false);
  assert.equal(eligible({ uid: 'operator-r898', role: 'operator' }), true);
});
test('R898 policy: disabled admin has no special bypass', () => {
  assert.equal(eligible({ ...active, role: 'admin', deleted: true }), false);
});
test('R898 source: privileged list reads current operator and private query in one transaction', () => {
  const code = source('../functions/src/privacy/dataRights.ts');
  const begin = code.indexOf('const listHandler = async (data: unknown, context: CallableContext)');
  const end = code.indexOf('export const submitDataRightsRequest', begin);
  assert.ok(begin >= 0 && end > begin);
  const body = code.slice(begin, end);
  const tx = body.indexOf('return db.runTransaction(async transaction =>');
  const currentRead = body.indexOf("transaction.get(db.collection('users').doc(uid))");
  const gate = body.indexOf('checkedCurrentJobCaller(');
  const requireOperator = body.indexOf('if (!current?.operator)');
  const privateQuery = body.indexOf("transaction.get(query.orderBy('createdAt', 'desc').limit(parsed.data.limit))");
  assert.ok(tx >= 0 && tx < currentRead && currentRead < gate &&
    gate < requireOperator && requireOperator < privateQuery);
  assert.doesNotMatch(body, /await query\.orderBy\(/);
});
test('R898 source: protected executor rechecks operator inside approval transaction', () => {
  const code = source('../functions/src/privacy/dataRightsExecution.ts');
  const start = code.indexOf('const handler = async (data: unknown, context: CallableContext)');
  const tx = code.indexOf('const request = await db.runTransaction(async (transaction) =>', start);
  const currentRead = code.indexOf("transaction.get(db.collection('users').doc(operatorUid))", tx);
  const gate = code.indexOf('checkedCurrentJobCaller(', currentRead);
  const requireOperator = code.indexOf('if (!current?.operator)', gate);
  const protectedRead = code.indexOf('transaction.get(requestRef)', requireOperator);
  const startedAudit = code.indexOf('transaction.create(executionRef, {', protectedRead);
  assert.ok(start >= 0 && tx > start && currentRead > tx && gate > currentRead &&
    requireOperator > gate && protectedRead > requireOperator && startedAudit > protectedRead);
  assert.match(code, /post-admission async GCS\/Jobs operations still need a/);
});
test('R898 source: legitimate self-service data-rights routes are still exported', () => {
  const code = source('../functions/src/privacy/dataRights.ts');
  assert.match(code, /export const submitDataRightsRequest = withAuthenticatedRole\(\['user', 'admin', 'operator'\], submitHandler\)/);
  assert.match(code, /export const getDataRightsRequest = withAuthenticatedRole\(\['user', 'admin', 'operator'\], getHandler\)/);
  assert.match(code, /export const listDataRightsRequests = withAuthenticatedRole\(\['admin', 'operator'\], listHandler\)/);
});
