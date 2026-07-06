import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tick = await readFile(new URL('../functions/src/jobs/processQueueTick.ts', import.meta.url), 'utf8');
const retry = await readFile(new URL('../functions/src/jobs/retryExpiredLeases.ts', import.meta.url), 'utf8');
const guards = await readFile(new URL('../functions/src/jobs/executionGuards.ts', import.meta.url), 'utf8');

for (const marker of ['compensatePublishFailure', 'canRequeueUnstartedLease', 'publishMessage']) {
  assert.ok(tick.includes(marker), `processQueueTick missing ${marker}`);
}
assert.equal(tick.includes("where('lease.expiresAt'"), false, 'queue tick must not reclaim expired leases');

for (const marker of [
  "where('status', '==', 'LEASED')",
  "where('lease.expiresAt', '<=', observedAt)",
  "orderBy('lease.expiresAt')",
  'transaction.get(queueRef)',
  'transaction.get(jobRef)',
  'canRequeueUnstartedLease(job, queueEntry, leaseToken)',
  "status: 'DEAD'",
  'retryCount: nextRetryCount',
  'RETRY_BACKOFF_MS * nextRetryCount',
]) {
  assert.ok(retry.includes(marker), `retryExpiredLeases missing ${marker}`);
}

for (const marker of [
  "job.status === 'LEASED'",
  "queueEntry.status === 'LEASED'",
  'job.execution?.leaseToken !== leaseToken',
]) {
  assert.ok(guards.includes(marker), `execution guard missing ${marker}`);
}

console.log('[PASS] single safe queue recovery authority contract');
