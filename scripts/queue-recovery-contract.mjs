import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const createJob = await readFile(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const tick = await readFile(new URL('../functions/src/jobs/processQueueTick.ts', import.meta.url), 'utf8');
const manual = await readFile(new URL('../functions/src/jobs/processQueueNow.ts', import.meta.url), 'utf8');
const retry = await readFile(new URL('../functions/src/jobs/retryExpiredLeases.ts', import.meta.url), 'utf8');
const guards = await readFile(new URL('../functions/src/jobs/executionGuards.ts', import.meta.url), 'utf8');
const reconcile = await readFile(new URL('../functions/src/jobs/systemReconcile.ts', import.meta.url), 'utf8');
const assetWorker = await readFile(new URL('../workers/asset-worker/index.js', import.meta.url), 'utf8');

assert.ok(createJob.includes('db.runTransaction'), 'createJob must use a Firestore transaction');
assert.match(
  createJob,
  /transaction\.create\(jobRef, \{[\s\S]*?\.\.\.newJob,[\s\S]*?createdAt: now,[\s\S]*?updatedAt: now,[\s\S]*?\}\);/,
  'createJob must atomically create the canonical job record with server timestamps',
);
assert.match(
  createJob,
  /transaction\.create\(queueRef, \{[\s\S]*?\.\.\.newQueueEntry,[\s\S]*?availableAt: now,[\s\S]*?createdAt: now,[\s\S]*?\}\);/,
  'createJob must atomically create the canonical queue entry with availability and creation timestamps',
);
assert.equal(
  createJob.includes('publishMessage'),
  false,
  'job creation must commit job and queue state without coupling persistence to Pub/Sub publication',
);

for (const marker of [
  'compensatePublishFailure',
  'recordDispatchPublished',
  'canRequeueUnstartedLease',
  'publishMessage',
  'MAX_DISPATCH_RETRIES',
  "return 'dead-retries-exhausted'",
  "status: 'DEAD'",
  "if (current.status === 'RUNNING')",
  'current.lease?.leaseToken !== leaseToken',
  'queueEntry.lease?.leaseToken !== leaseToken',
  "'dispatch.publishedAt': now",
]) {
  assert.ok(tick.includes(marker), `processQueueTick missing ${marker}`);
}
assert.equal(tick.includes("where('lease.expiresAt'"), false, 'queue tick must not reclaim expired leases');
assert.match(tick, /normalizedRetryCount >= MAX_DISPATCH_RETRIES/);
assert.match(tick, /transaction\.update\(jobRef, \{[\s\S]*status: 'DEAD'/);
assert.match(tick, /transaction\.update\(queueRef, \{[\s\S]*status: 'DEAD'/);
assert.match(
  tick,
  /if \(current\.status === 'RUNNING'\) \{\s*return 'already-running';\s*\}/,
  'post-publish bookkeeping must preserve a job already claimed by the execution subscriber',
);
assert.match(
  tick,
  /if \(\s*current\.lease\?\.leaseToken !== leaseToken \|\|\s*queueEntry\.lease\?\.leaseToken !== leaseToken\s*\) \{\s*return 'superseded-lease';\s*\}/,
  'post-publish bookkeeping must not overwrite a superseding lease',
);
assert.match(
  tick,
  /if \(current\.status !== 'LEASED' \|\| queueEntry\.status !== 'LEASED'\) \{\s*return 'state-changed';\s*\}/,
  'dispatch publication receipts must be written only while both records remain lease-owned',
);
assert.match(tick, /transaction\.update\(jobRef, receipt\);\s*transaction\.update\(queueRef, receipt\);/);

for (const marker of [
  'transaction.get(queueRef)',
  'transaction.get(masterJobRef)',
  'isTerminalJobStatus(job.status)',
  "job.status !== 'PENDING'",
  "outcome: 'missing-job'",
  "outcome: 'terminal-job'",
  "outcome: 'master-not-pending'",
]) {
  assert.ok(manual.includes(marker), `processQueueNow missing ${marker}`);
}
assert.match(
  manual,
  /const \[queueDoc, masterJobDoc\] = await Promise\.all\(\[[\s\S]*transaction\.get\(queueRef\),[\s\S]*transaction\.get\(masterJobRef\),[\s\S]*\]\);/,
  'manual dispatch must read queue and master job in the same transaction before leasing',
);
assert.match(
  manual,
  /if \(isTerminalJobStatus\(job\.status\)\) \{[\s\S]*transaction\.update\(queueRef,[\s\S]*return \{ lease: null, outcome: 'terminal-job' as const \};[\s\S]*\}/,
  'manual dispatch must reconcile terminal jobs without leasing or publishing them',
);
assert.match(
  manual,
  /if \(job\.status !== 'PENDING'\) \{\s*return \{ lease: null, outcome: 'master-not-pending' as const \};\s*\}/,
  'manual dispatch must refuse any non-pending master job',
);
assert.match(
  manual,
  /transaction\.update\(queueRef, leaseUpdate\);\s*transaction\.update\(masterJobRef, leaseUpdate\);/,
  'manual dispatch may lease both records only after queue and master state checks pass',
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
console.log('[PASS] scheduled and manual dispatch preserve master job terminal/non-pending state');
console.log('[PASS] post-publish receipt preserves running and superseding leases');
console.log('[PASS] single safe queue recovery and exact async-callback authority contract');
