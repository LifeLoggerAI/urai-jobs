import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reserveCreateJobRateLimit, JobCreateRateLimitError } from '../functions/src/jobs/jobCreateRateLimit.ts';

const reserve = reserveCreateJobRateLimit;
function denies(fn, reason) {
  assert.throws(fn, error => error instanceof JobCreateRateLimitError && error.reason === reason);
}

test('first admission creates server-owned quota ledger', () => {
  assert.deepEqual(reserve(undefined, 1_000_000, 10),
    { admissionsMs: [1_000_000], latestAdmissionMs: 1_000_000 });
});
test('the eleventh in-window admission is denied', () => {
  let ledger;
  for (let i = 0; i < 10; i++) ledger = reserve(ledger, 1_000_000 + i * 10, 10);
  assert.equal(ledger.admissionsMs.length, 10);
  denies(() => reserve(ledger, 1_000_100, 10), 'exhausted');
});
test('sliding window expires an admission only after more than 60 seconds', () => {
  let ledger;
  for (let i = 0; i < 10; i++) ledger = reserve(ledger, 1_000_000 + 10 * i, 10);
  denies(() => reserve(ledger, 1_060_000, 10), 'exhausted');
  const next = reserve(ledger, 1_060_001, 10);
  assert.equal(next.admissionsMs.length, 10);
  assert.equal(next.admissionsMs[0], 1_000_010);
});
test('migration imports pre-ledger admissions and refuses full historic window', () => {
  const prior = Array.from({ length: 10 }, (_, i) => 1_000_000 + i * 20);
  denies(() => reserve(undefined, 1_000_500, 10, prior), 'exhausted');
  assert.equal(reserve(undefined, 1_000_500, 10, prior.slice(1)).admissionsMs.length, 10);
});
test('out-of-order migration timestamps are sorted', () => {
  assert.deepEqual(reserve(undefined, 1_000_100, 10, [1_000_050, 1_000_010]).admissionsMs,
    [1_000_010, 1_000_050, 1_000_100]);
});
test('old legacy entries expire and do not consume new quota', () => {
  assert.deepEqual(reserve(undefined, 1_100_000, 10, [1_000_000, 1_049_000, 1_050_000]).admissionsMs,
    [1_049_000, 1_050_000, 1_100_000]);
});
test('clock rollback is a denial, never a quota reset', () => {
  const ledger = reserve(undefined, 1_000_000, 10);
  denies(() => reserve(ledger, 999_999, 10), 'clock-regression');
  denies(() => reserve(undefined, 1_000_000, 10, [1_000_001]), 'clock-regression');
});
test('invalid or tampered ledger fails closed', () => {
  for (const value of [null, 0, {}, { admissionsMs: [], latestAdmissionMs: 0 },
    { admissionsMs: [100, 90], latestAdmissionMs: 90 },
    { admissionsMs: [100], latestAdmissionMs: 101 },
    { admissionsMs: ['100'], latestAdmissionMs: 100 },
    { admissionsMs: [100.2], latestAdmissionMs: 100.2 }]) {
    denies(() => reserve(value, 110, 10), 'invalid-ledger');
  }
  denies(() => reserve(undefined, 1_000, 0), 'invalid-ledger');
  denies(() => reserve(undefined, 1_000, 10, [Number.NaN]), 'invalid-ledger');
});
test('a reduced configured limit does not reset history', () => {
  const prior = reserve(reserve(undefined, 1_000, 10), 1_001, 10);
  denies(() => reserve(prior, 1_002, 1), 'exhausted');
});
test('owner quota is independent of tenant and expires normally', () => {
  let ledger = reserve(undefined, 1_000_000, 1);
  denies(() => reserve(ledger, 1_000_001, 1), 'exhausted');
  ledger = reserve(ledger, 1_060_001, 1);
  assert.equal(ledger.admissionsMs.length, 1);
});
test('source enforces quota in same Firestore transaction as create + queue + logs', () => {
  const source = readFileSync('functions/src/jobs/createJob.ts', 'utf8');
  const start = source.indexOf('return await db.runTransaction(async (transaction) => {');
  assert.ok(start > 0, 'write transaction exists');
  const tail = source.slice(start);
  assert.match(tail, /const ownerSnap = await transaction\.get\(ownerRef\)/);
  assert.match(tail, /reserveCreateJobRateLimit\(/);
  assert.match(tail, /transaction\.update\(ownerRef, \{ jobsCreateRateLimit: nextRateLimit \}\)/);
  for (const path of ['jobRef', 'queueRef', 'logRef']) {
    assert.ok(tail.includes('transaction.create(' + path), 'atomic create required for ' + path);
  }
  assert.ok(!source.includes('await assertCreateRateLimit(uid)'), 'stale admission gate is forbidden');
  assert.match(source, /if \(bindingRef\) \{/);
});
test('direct Firestore client cannot modify server-owned quota state', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const start = rules.indexOf('function userProfileFieldsUnchanged()');
  const end = rules.indexOf('match /users/{uid}', start);
  assert.ok(start > 0 && end > start);
  assert.match(rules.slice(start, end), /'jobsCreateRateLimit'/);
});
