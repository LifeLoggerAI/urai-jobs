import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tick = await readFile(new URL('../functions/src/jobs/processQueueTick.ts', import.meta.url), 'utf8');
const retry = await readFile(new URL('../functions/src/jobs/retryExpiredLeases.ts', import.meta.url), 'utf8');
const guards = await readFile(new URL('../functions/src/jobs/executionGuards.ts', import.meta.url), 'utf8');
const reconcile = await readFile(new URL('../functions/src/jobs/systemReconcile.ts', import.meta.url), 'utf8');
const assetWorker = await readFile(new URL('../workers/asset-worker/index.js', import.meta.url), 'utf8');

for (const marker of [
  'compensatePublishFailure',
  'canRequeueUnstartedLease',
  'publishMessage',
  'MAX_DISPATCH_RETRIES',
  "return 'dead-retries-exhausted'",
  "status: 'DEAD'",
]) {
  assert.ok(tick.includes(marker), `processQueueTick missing ${marker}`);
}
assert.equal(tick.includes("where('lease.expiresAt'"), false, 'queue tick must not reclaim expired leases');
assert.match(tick, /normalizedRetryCount >= MAX_DISPATCH_RETRIES/);
assert.match(tick, /transaction\.update\(jobRef, \{[\s\S]*status: 'DEAD'/);
assert.match(tick, /transaction\.update\(queueRef, \{[\s\S]*status: 'DEAD'/);

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

for (const marker of [
  'protectedAsyncCallbackPending',
  'execution.asyncCallbackPending',
  'execution.callbackDeadlineAt',
  'unexpired asynchronous callback lease is pending',
]) {
  assert.ok(reconcile.includes(marker), `systemReconcile missing ${marker}`);
}

for (const marker of [
  'crypto.randomBytes(32)',
  'callbackTokenHash',
  'callbackLeaseToken',
  'callbackDeadlineAt',
  'callbackLeaseToken !== activeLeaseToken',
  "job.status !== 'RUNNING'",
  "status: 'DONE'",
  'db.runTransaction',
]) {
  assert.ok(assetWorker.includes(marker), `asset worker callback boundary missing ${marker}`);
}
assert.match(assetWorker, /callbackToken=\$\{encodeURIComponent\(callbackToken\)\}/);
assert.match(assetWorker, /timingSafeEqual\(sha256\(callbackToken\), expectedTokenHash\)/);
assert.match(assetWorker, /execution\.asyncCallbackPending !== true/);
assert.match(assetWorker, /callbackDeadlineMillis <= Date\.now\(\)/);
assert.doesNotMatch(assetWorker, /await jobRef\.update\(update\)/);

console.log('[PASS] single safe queue recovery and exact async-callback authority contract');
