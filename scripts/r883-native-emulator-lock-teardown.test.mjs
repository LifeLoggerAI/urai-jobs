/**
 * R883: keep native demo teardown aligned with the engine's owner-scoped
 * quota-lock identity. Static/code-level proof, NOT Firebase emulator proof.
 * Requires Node 22 with --experimental-strip-types for the original TS import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { jobCreateRateLimitLockId } from '../functions/src/core/jobsReliability.ts';

const nativeSource = readFileSync(
  new URL('./r879-jobs-current-authority.firebase-emulator.test.mjs', import.meta.url), 'utf8',
);
const ownerId = 'r883-synthetic-owner-only';
const expected = jobCreateRateLimitLockId(ownerId);
test('R883 teardown derives the canonical SHA-256 quota lock exactly', () => {
  const actual = createHash('sha256')
    .update('urai-jobs:create-rate-limit-lock:v1' + String.fromCharCode(10) + ownerId)
    .digest('hex');
  assert.equal(actual, expected);
  assert.match(expected, /^[a-f0-9]{64}$/);
});
test('R883 native source deletes every owner quota lock before user deletion', () => {
  const start = nativeSource.indexOf('after(async () => {');
  const end = nativeSource.indexOf("test('R879 original native", start);
  assert.ok(start >= 0 && end > start, 'R879 teardown must exist');
  const body = nativeSource.slice(start, end);
  const binding = body.indexOf('for (const binding of bindings.docs) await binding.ref.delete()');
  const lock = body.indexOf("db.collection('jobCreateRateLimitLocks').doc(quotaLockId).delete()");
  const owner = body.indexOf("db.collection('users').doc(uid).delete()");
  assert.ok(binding >= 0 && binding < lock && lock < owner);
  assert.ok(body.includes("String.fromCharCode(10) + uid)"),
    'Teardown must hash the newline byte, not the literal characters backslash+n');
  assert.match(body, /for \(const uid of Object\.values\(ids\)\)/);
});
test('R883 teardown remains fail-closed on cleanup failures', () => {
  assert.match(nativeSource, /failures\.push\(uid \+ ': ' \+ String\(error\)\)/);
  assert.match(nativeSource, /assert\.deepEqual\(failures, \[\]/);
  assert.match(nativeSource, /await db\.recursiveDelete\(job\.ref\)/);
});
