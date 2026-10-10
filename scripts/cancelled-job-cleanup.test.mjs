import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCancelledJobCleanup } from './cancelled-job-cleanup.mjs';

function fixture({ queues = ['CANCELLED', null], jobs = ['CANCELLED'], timeoutMs = 1000, overshoot = 0 } = {}) {
  let tick = 0, clock = 0;
  const snapshot = value => ({ exists: value !== null, data: () => value === undefined ? {} : { status: value } });
  const db = { collection: name => ({ doc: () => ({ get: async () => snapshot(
    (name === 'jobs' ? jobs : queues)[Math.min(tick, (name === 'jobs' ? jobs : queues).length - 1)]
  ) }) }) };
  const options = { timeoutMs, now: () => clock, pause: async milliseconds => { clock += milliseconds + overshoot; tick++; } };
  return { db, options, polls: () => tick + 1 };
}

test('cleanup that wins the first read is accepted only with the durable cancelled master', async () => {
  const f = fixture({ queues: [null] });
  await assertCancelledJobCleanup(f.db, 'synthetic-job', f.options);
  assert.equal(f.polls(), 1);
});
test('a transient cancelled queue must actually disappear before acceptance', async () => {
  const f = fixture();
  await assertCancelledJobCleanup(f.db, 'synthetic-job', f.options);
  assert.equal(f.polls(), 2);
});
for (const status of ['PENDING', 'RUNNING', undefined]) test(`remaining queue ${status} is rejected`, async () => {
  const f = fixture({ queues: [status] });
  await assert.rejects(assertCancelledJobCleanup(f.db, 'synthetic-job', f.options), /queue entry is not CANCELLED/);
});
for (const status of [null, 'PENDING']) test(`missing or noncancelled master ${status} cannot be masked by queue cleanup`, async () => {
  const f = fixture({ queues: [null], jobs: [status] });
  await assert.rejects(assertCancelledJobCleanup(f.db, 'synthetic-job', f.options), /master is missing or no longer CANCELLED/);
});
test('master regression during cleanup is rejected', async () => {
  const f = fixture({ jobs: ['CANCELLED', 'PENDING'] });
  await assert.rejects(assertCancelledJobCleanup(f.db, 'synthetic-job', f.options), /master is missing or no longer CANCELLED/);
});
test('stalled terminal cleanup fails at its bounded deadline', async () => {
  const f = fixture({ queues: ['CANCELLED'], timeoutMs: 500 });
  await assert.rejects(assertCancelledJobCleanup(f.db, 'synthetic-job', f.options), /before the deadline/);
  assert.equal(f.polls(), 3);
});

test('cleanup observed after the deadline cannot turn a timed-out poll into success', async () => {
  const f = fixture({ timeoutMs: 100, overshoot: 1 });
  await assert.rejects(assertCancelledJobCleanup(f.db, 'synthetic-job', f.options), /before the deadline/);
});
