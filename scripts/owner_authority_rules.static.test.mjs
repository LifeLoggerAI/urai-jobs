import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve('firestore.rules');
const trustedFields = [
  'role', 'orgId', 'permissions', 'disabled', 'uid',
  'tenantId', 'accountStatus', 'deleted', 'markedForDeletion',
  'dataRightsDeletionPendingCentralPrivacy',
];

function getUserAuthority(source) {
  const start = source.indexOf('function userProfileFieldsUnchanged() {');
  const end = source.indexOf('\n    match /users/{uid}', start);
  assert.ok(start >= 0 && end > start, 'canonical user-profile guard must exist');
  const guard = source.slice(start, end);
  const match = /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\[([\s\S]*?)\]\)/.exec(guard);
  assert.ok(match, 'must use affectedKeys for add, remove, and change');
  const fields = [...match[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.equal(new Set(fields).size, fields.length, 'trusted fields cannot be duplicated in allowlist');
  assert.deepEqual([...fields].sort(), [...trustedFields].sort(), 'protect exactly the privileged server-owned field set');
  assert.match(guard, /return\s*!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(/);
  const boundary = /match\s+\/users\/\{uid\}\s*\{([\s\S]*?)\n\s*match\s+\//.exec(source);
  assert.ok(boundary, 'canonical users document match block must exist');
  assert.match(boundary[1], /allow create:\s*if false\s*;/);
  assert.match(boundary[1], /allow update:\s*if signedIn\(\)\s*&&\s*request\.auth\.uid\s*==\s*uid\s*&&\s*userProfileFieldsUnchanged\(\)\s*;/);
  assert.match(boundary[1], /allow delete:\s*if false\s*;/);
  return guard;
}

const source = fs.readFileSync(rulesPath, 'utf8');

test('canonical Jobs owner rule protects tenant, role, status, and deletion fields', () => {
  getUserAuthority(source);
});
for (const field of trustedFields) {
  test('trusted owner authority field is immutable to direct clients: ' + field, () => {
    const mut = source.replace(new RegExp(`'${field}'`), `'removed_${field}'`);
    assert.throws(() => getUserAuthority(mut), /protect exactly/);
  });
}
test('removing affectedKeys or reverting to changedKeys is rejected', () => {
  assert.throws(() => getUserAuthority(source.replace('affectedKeys()', 'changedKeys()')), /affectedKeys/);
});
test('allowing client create or deleting self-ownership requirement is rejected', () => {
  assert.throws(() => getUserAuthority(source.replace('allow create: if false;', 'allow create: if isSelf(uid);')), /allow create/);
  assert.throws(() => getUserAuthority(source.replace('&& request.auth.uid == uid\n        && userProfileFieldsUnchanged();', '&& userProfileFieldsUnchanged();')), /allow update/);
});
