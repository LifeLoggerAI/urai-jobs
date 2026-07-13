import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const createJob = await readFile(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const tick = await readFile(new URL('../functions/src/jobs/processQueueTick.ts', import.meta.url), 'utf8');
const retry = await readFile(new URL('../functions/src/jobs/retryExpiredLeases.ts', import.meta.url), 'utf8');
const guards = await readFile(new URL('../functions/src/jobs/executionGuards.ts', import.meta.url), 'utf8');
const reconcile = await readFile(new URL('../functions/src/jobs/systemReconcile.ts', import.meta.url), 'utf8');
const assetWorker = await readFile(new URL('../workers/asset-worker/index.js', import.meta.url), 'utf8');

for (const marker of [
  'db.runTransaction',
  'transaction.create(jobRef, jobRecord)',
  'transaction.create(queueRef, queueEntry)',
]) {
  assert.ok(createJob.includes(marker), `createJob missing transactional persistence marker ${marker}`);
}
assert.equal(
  createJob.includes('publishMessage'),
  false,
  'job creation must commit job and queue state without coupling persistence to Pub/Sub publication',
);

for (const marker of [
  'compensatePublishFailure',
  'canRequeueUnstartedLease',
  'publishMessage',
  'MAX_DISPATCH_RETRIES',
  "return 'dead-retries-exhausted'",
  "status: 'DEAD'",
  "if (current.status === 'running')",
  'current.lease?.leaseToken !== leaseToken',
  'queueEntry.leaseToken !== leaseToken',
]) {
  assert.ok(tick.includes(marker), `processQueueTick missing ${marker}`);
}
assert.equal(tick.includes("where('lease.expiresAt'"), false, 'queue tick must not reclaim expired leases');
assert.match(tick, /normalizedRetryCount >= MAX_DISPATCH_RETRIES/);
assert.match(tick, /transaction\.update\(jobRef, \{[\s\S]*status: 'DEAD'/);
assert.match(tick, /transaction\.update\(queueRef, \{[\s\S]*status: 'DEAD'/);
assert.match(
  tick,
  /if \(current\.status === 'running'\) \{\s*return;\s*\}/,
  'post-publish bookkeeping must preserve a job already claimed by another dispatcher',
);
assert.match(
  tick,
  /if \(current\.lease\?\.leaseToken !== leaseToken \|\| queueEntry\.leaseToken !== leaseToken\) \{\s*return;\s*\}/,
  'post-publish bookkeeping must not overwrite a superseding lease',
);

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

console.log('[PASS] transactional job creation precedes dispatch publication');
console.log('[PASS] post-publish bookkeeping preserves running and superseding leases');
console.log('[PASS] single safe queue recovery and exact async-callback authority contract');
