import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const createJob = await readFile(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const tick = await readFile(new URL('../functions/src/jobs/processQueueTick.ts', import.meta.url), 'utf8');
const manual = await readFile(new URL('../functions/src/jobs/processQueueNow.ts', import.meta.url), 'utf8');
const retry = await readFile(new URL('../functions/src/jobs/retryExpiredLeases.ts', import.meta.url), 'utf8');
const guards = await readFile(new URL('../functions/src/jobs/executionGuards.ts', import.meta.url), 'utf8');
const reconcile = await readFile(new URL('../functions/src/jobs/systemReconcile.ts', import.meta.url), 'utf8');
const execute = await readFile(new URL('../functions/src/jobs/executeJob.ts', import.meta.url), 'utf8');
const assetWorker = await readFile(new URL('../workers/asset-worker/index.js', import.meta.url), 'utf8');
const legacyFirebaseWorkflow = await readFile(new URL('../.github/workflows/firebase-deploy.yml', import.meta.url), 'utf8');
const firebaseDeploy = await readFile(new URL('../scripts/deploy-firebase.sh', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');

assert.ok(createJob.includes('db.runTransaction'), 'createJob must use a Firestore transaction');
assert.match(createJob, /transaction\.create\(jobRef, \{[\s\S]*?\.\.\.newJob,[\s\S]*?createdAt: now,[\s\S]*?updatedAt: now,[\s\S]*?\}\);/);
assert.match(createJob, /transaction\.create\(queueRef, \{[\s\S]*?\.\.\.newQueueEntry,[\s\S]*?availableAt: now,[\s\S]*?createdAt: now,[\s\S]*?\}\);/);
assert.equal(createJob.includes('publishMessage'), false, 'job creation must not couple persistence to publication');

for (const marker of [
  'compensatePublishFailure',
  'recordDispatchPublished',
  'canRequeueUnstartedLease',
  'MAX_DISPATCH_RETRIES',
  "return 'dead-retries-exhausted'",
  "if (current.status === 'RUNNING')",
  'current.lease?.leaseToken !== leaseToken',
  'queueEntry.lease?.leaseToken !== leaseToken',
  "'dispatch.publishedAt': now",
]) assert.ok(tick.includes(marker), `processQueueTick missing ${marker}`);
assert.equal(tick.includes("where('lease.expiresAt'"), false, 'queue tick must not reclaim expired leases');
assert.match(tick, /transaction\.update\(jobRef, receipt\);\s*transaction\.update\(queueRef, receipt\);/);

for (const marker of [
  'transaction.get(queueRef)',
  'transaction.get(masterJobRef)',
  'isTerminalJobStatus(job.status)',
  "job.status !== 'PENDING'",
  "outcome: 'missing-job'",
  "outcome: 'terminal-job'",
  "outcome: 'master-not-pending'",
]) assert.ok(manual.includes(marker), `processQueueNow missing ${marker}`);
assert.match(manual, /const \[queueDoc, masterJobDoc\] = await Promise\.all\(\[[\s\S]*transaction\.get\(queueRef\),[\s\S]*transaction\.get\(masterJobRef\),[\s\S]*\]\);/);
assert.match(manual, /transaction\.update\(queueRef, leaseUpdate\);\s*transaction\.update\(masterJobRef, leaseUpdate\);/);

for (const marker of [
  "where('status', '==', 'LEASED')",
  "where('lease.expiresAt', '<=', observedAt)",
  "orderBy('lease.expiresAt')",
  'canRequeueUnstartedLease(job, queueEntry, leaseToken)',
  'retryCount: nextRetryCount',
  'RETRY_BACKOFF_MS * nextRetryCount',
]) assert.ok(retry.includes(marker), `retryExpiredLeases missing ${marker}`);

assert.equal(reconcile.includes("where('status', '==', 'LEASED')"), false, 'systemReconcile must not duplicate LEASED recovery');
for (const marker of [
  "where('status', '==', 'RUNNING')",
  "where('lease.heartbeatAt', '<', staleThreshold)",
  'transaction.get(jobRef)',
  'transaction.get(queueRef)',
  "job.status !== 'RUNNING'",
  'job.lease?.leaseToken !== expectedLeaseToken',
  'heartbeatMillis > staleBeforeMillis',
  "queue.status !== 'RUNNING'",
  'queue.lease?.leaseToken !== expectedLeaseToken',
  "'execution.leaseToken': FieldValue.delete()",
]) assert.ok(reconcile.includes(marker), `systemReconcile missing ${marker}`);
assert.match(reconcile, /const \[jobSnapshot, queueSnapshot\] = await Promise\.all\(\[[\s\S]*transaction\.get\(jobRef\),[\s\S]*transaction\.get\(queueRef\),[\s\S]*\]\);/);

for (const marker of [
  'activeAsyncCallbackForLease',
  "current.status !== 'RUNNING'",
  'current.execution?.leaseToken !== leaseToken',
  "return 'callback-pending'",
  'Preserved active asynchronous callback attempt',
  "'execution.leaseToken': FieldValue.delete()",
  'lease: FieldValue.delete()',
]) assert.ok(execute.includes(marker), `executeJob missing ${marker}`);
assert.match(execute, /if \(activeAsyncCallbackForLease\(current, leaseToken, Date\.now\(\)\)\) \{\s*return 'callback-pending';\s*\}/);
assert.match(execute, /status: 'SUCCESS',[\s\S]*lease: FieldValue\.delete\(\),[\s\S]*'execution\.leaseToken': FieldValue\.delete\(\)/);
assert.match(execute, /status: 'FAILED',[\s\S]*lease: FieldValue\.delete\(\),[\s\S]*'execution\.leaseToken': FieldValue\.delete\(\)/);

for (const marker of [
  "job.status === 'LEASED'",
  "queueEntry.status === 'LEASED'",
  'job.execution?.leaseToken !== leaseToken',
]) assert.ok(guards.includes(marker), `execution guard missing ${marker}`);

for (const marker of [
  'crypto.randomBytes(32)',
  'callbackTokenHash',
  'completedCallbackTokenHash',
  'completedCallbackResultId',
  'completedCallbackStatus',
  'callbackLeaseToken',
  'callbackDeadlineAt',
  'callbackLeaseToken !== activeLeaseToken',
  "job.status !== 'RUNNING'",
  "status: 'DONE'",
  'db.runTransaction',
]) assert.ok(assetWorker.includes(marker), `asset worker callback boundary missing ${marker}`);
assert.match(assetWorker, /callbackToken=\$\{encodeURIComponent\(callbackToken\)\}/);
assert.match(assetWorker, /timingSafeEqual\(presentedCallbackTokenHash, expectedTokenHash\)/);
assert.match(assetWorker, /timingSafeEqual\(presentedCallbackTokenHash, completedCallbackTokenHash\)/);
assert.match(assetWorker, /duplicate: true,[\s\S]*resultId: String\(execution\.completedCallbackResultId/);
assert.match(assetWorker, /execution\.asyncCallbackPending !== true/);
assert.match(assetWorker, /callbackDeadlineMillis <= Date\.now\(\)/);
assert.doesNotMatch(assetWorker, /await jobRef\.update\(update\)/);

assert.match(legacyFirebaseWorkflow, /\[BLOCKED\]/);
assert.match(legacyFirebaseWorkflow, /Use \.github\/workflows\/urai-jobs-production-deploy\.yml/);
assert.doesNotMatch(legacyFirebaseWorkflow, /firebase deploy|gcloud run deploy|on:\s*\n\s*push:/);

for (const marker of [
  'DEPLOY_TARGET_SECRET_VERSIONS_JSON is required',
  'approval.URAI_JOBS_WORKER_TOKEN',
  'secrets versions describe',
  "--filter='state=ENABLED'",
  "--sort-by='~createTime'",
  'Firebase Functions would bind worker token version',
  'approvedWorkerTokenVersion',
  'resolvedWorkerTokenVersion',
  'verify_worker_secret\nwrite_config_receipt true',
]) assert.ok(firebaseDeploy.includes(marker), `deploy-firebase missing ${marker}`);

assert.match(workspace, /^\s*-\s*["']?workers["']?\s*$/m, 'root workers package must participate in pnpm installation');
assert.match(workspace, /^\s*-\s*["']?workers\/\*["']?\s*$/m, 'individual worker packages must participate in pnpm installation');

console.log('[PASS] transactional creation precedes publication');
console.log('[PASS] scheduled and manual dispatch preserve master state');
console.log('[PASS] retryExpiredLeases is the sole LEASED recovery owner');
console.log('[PASS] stale RUNNING recovery revalidates exact lease and heartbeat');
console.log('[PASS] ambiguous failures preserve active callbacks and terminal attempts clear authority');
console.log('[PASS] legacy Firebase authority is blocked and one approved worker-token version binds Workers and Functions');
console.log('[PASS] root and individual worker dependencies are installed by pnpm workspace authority');
