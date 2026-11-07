/**
 * Pure original TypeScript-source guard tests for the R880 rate-limit control.
 * No Firebase emulator, production calls, or cloud credentials involved.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { jobCreateRateLimitAllowsCount, jobCreateRateLimitLockId } from '../functions/src/core/jobsReliability.ts';

test('R880 accepts 0 through 9, denies 10+ under original limit', () => {
  for (let count = 0; count < 10; count++) {
    assert.equal(jobCreateRateLimitAllowsCount(count, 10), true);
  }
  for (const count of [10, 11, 999]) {
    assert.equal(jobCreateRateLimitAllowsCount(count, 10), false);
  }
});
test('R880 rejects invalid counts rather than passing quota unknowns', () => {
  for (const count of [-1, 1.5, NaN, Infinity, -Infinity, undefined, null, '0', {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(jobCreateRateLimitAllowsCount(count, 10), false);
  }
});
test('R880 rejects noncanonical limit settings', () => {
  for (const limit of [0, -1, 1.5, NaN, Infinity, undefined, null, '10', 10001]) {
    assert.equal(jobCreateRateLimitAllowsCount(0, limit), false);
  }
});
test('R880 permits valid custom limit (bounded) only below that limit', () => {
  for (const limit of [1, 5, 10, 500, 10000]) {
    assert.equal(jobCreateRateLimitAllowsCount(0, limit), true);
    assert.equal(jobCreateRateLimitAllowsCount(limit - 1, limit), true);
    assert.equal(jobCreateRateLimitAllowsCount(limit, limit), false);
  }
});
test('R880 lock IDs are deterministic pseudonyms and unique per user', () => {
  const a = jobCreateRateLimitLockId('synthetic-owner-a');
  const b = jobCreateRateLimitLockId('synthetic-owner-b');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.equal(a, jobCreateRateLimitLockId('synthetic-owner-a'));
  assert.equal(a.includes('synthetic-owner-a'), false);
});
test('R880 lock ID rejects absent, ambiguous or whitespace owner identifiers', () => {
  for (const uid of ['', ' ', ' padded', 'padded ', undefined, null, 8, [], {}]) {
    assert.throws(() => jobCreateRateLimitLockId(uid), /job_create_rate_limit_owner_uid_invalid/);
  }
});
