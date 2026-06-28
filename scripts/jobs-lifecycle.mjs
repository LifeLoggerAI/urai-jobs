import fs from 'node:fs';
import path from 'node:path';

const TERMINAL = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);
const SUPPORTED = new Set(['narrator.tts']);

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`; }
function assert(name, condition) {
  if (!condition) throw new Error(`[FAIL] ${name}`);
  console.log(`[PASS] ${name}`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

class Harness {
  constructor() {
    this.jobs = new Map();
    this.queue = new Map();
    this.logs = new Map();
    this.idempotency = new Map();
  }
  log(jobId, level, message, metadata = {}) {
    const list = this.logs.get(jobId) || [];
    list.push({ level, message, metadata, createdAt: now() });
    this.logs.set(jobId, list);
  }
  createJob({ jobType, payload, ownerUid = 'local-user', idempotencyKey = '' }) {
    if (!SUPPORTED.has(jobType)) throw new Error(`Unsupported job type: ${jobType}`);
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) throw new Error('narrator.tts payload.text is required');
    const idem = idempotencyKey ? `${ownerUid}:${idempotencyKey}` : '';
    if (idem && this.idempotency.has(idem)) {
      const existing = this.idempotency.get(idem);
      this.log(existing, 'info', 'idempotent create returned existing job');
      return { jobId: existing, idempotent: true };
    }
    const jobId = id('job');
    this.jobs.set(jobId, { jobId, type: jobType, jobType, ownerUid, payload, status: 'PENDING', retryCount: 0, createdAt: now(), updatedAt: now() });
    this.queue.set(jobId, { jobId, jobType, status: 'PENDING', availableAt: now(), createdAt: now() });
    if (idem) this.idempotency.set(idem, jobId);
    this.log(jobId, 'info', 'job created and queued', { jobType });
    return { jobId, idempotent: false };
  }
  claimJob(jobId, workerId) {
    const job = this.jobs.get(jobId);
    const queue = this.queue.get(jobId);
    if (!job || !queue || job.status !== 'PENDING' || queue.status !== 'PENDING') return null;
    const lease = { leaseId: id('lease-id'), leaseToken: id('lease'), workerId, expiresAt: new Date(Date.now() + 60000).toISOString() };
    job.status = 'LEASED'; job.lease = lease; job.updatedAt = now();
    queue.status = 'LEASED'; queue.lease = lease; queue.updatedAt = now();
    this.log(jobId, 'info', 'job leased', { workerId });
    return { jobId, leaseToken: lease.leaseToken };
  }
  executeJob(jobId, leaseToken, options = {}) {
    const job = this.jobs.get(jobId);
    const queue = this.queue.get(jobId);
    if (!job || !queue) return { action: 'noop', reason: 'missing' };
    if (TERMINAL.has(job.status)) { this.log(jobId, 'warn', 'duplicate terminal execution ignored', { status: job.status }); return { action: 'noop', reason: 'terminal', status: job.status }; }
    if (job.status !== 'LEASED' || queue.status !== 'LEASED') return { action: 'noop', reason: 'not-leased', status: job.status };
    if (job.lease?.leaseToken !== leaseToken || queue.lease?.leaseToken !== leaseToken) return { action: 'noop', reason: 'lease-mismatch', status: job.status };
    job.status = 'RUNNING'; queue.status = 'RUNNING'; job.startedAt = now(); job.updatedAt = now(); queue.updatedAt = now();
    this.log(jobId, 'info', 'job running');
    if (options.fail) {
      job.status = 'FAILED'; queue.status = 'DONE'; job.error = { message: 'intentional local failure proof' }; job.completedAt = now(); job.updatedAt = now();
      this.log(jobId, 'error', 'job failed', { errorPresent: true });
      return { action: 'failed', status: 'FAILED' };
    }
    job.status = 'SUCCESS'; queue.status = 'DONE'; job.result = { ok: true, mode: 'local-proof', completedAt: now() }; job.output = job.result; job.completedAt = now(); job.updatedAt = now();
    this.log(jobId, 'info', 'job succeeded', { resultPresent: true });
    return { action: 'completed', status: 'SUCCESS' };
  }
  retryJob(jobId) {
    const job = this.jobs.get(jobId);
    const queue = this.queue.get(jobId) || { jobId };
    if (!job || job.status !== 'FAILED') return { action: 'blocked', reason: 'not-failed' };
    job.status = 'PENDING'; job.retryCount += 1; delete job.error; delete job.lease; job.updatedAt = now();
    queue.status = 'PENDING'; queue.availableAt = now(); delete queue.lease; this.queue.set(jobId, queue);
    this.log(jobId, 'info', 'failed job requeued', { retryCount: job.retryCount });
    return { action: 'requeued', status: 'PENDING', retryCount: job.retryCount };
  }
}

const harness = new Harness();
const transitions = [];
const created = harness.createJob({ jobType: 'narrator.tts', payload: { text: 'URAI Jobs local proof', format: 'MP3' }, idempotencyKey: 'local-proof' });
const jobId = created.jobId;
transitions.push({ stage: 'created', status: harness.jobs.get(jobId).status });
assert('job doc created', harness.jobs.has(jobId));
assert('queue doc created', harness.queue.has(jobId));
assert('idempotency returns existing job', harness.createJob({ jobType: 'narrator.tts', payload: { text: 'URAI Jobs local proof' }, idempotencyKey: 'local-proof' }).jobId === jobId);
const lease = harness.claimJob(jobId, 'local-worker-a');
transitions.push({ stage: 'claimed', status: harness.jobs.get(jobId).status });
assert('worker claims pending job', Boolean(lease?.leaseToken));
assert('duplicate worker cannot double-claim', harness.claimJob(jobId, 'local-worker-b') === null);
const run = harness.executeJob(jobId, lease.leaseToken);
transitions.push({ stage: 'terminal', status: harness.jobs.get(jobId).status });
assert('job succeeds', run.status === 'SUCCESS');
assert('result persisted', Boolean(harness.jobs.get(jobId).result));
assert('logs persisted', (harness.logs.get(jobId) || []).length >= 5);
const duplicate = harness.executeJob(jobId, lease.leaseToken);
assert('duplicate execution no-ops after terminal', duplicate.reason === 'terminal');
let unsupportedRejected = false;
try { harness.createJob({ jobType: 'asset.render', payload: {} }); } catch { unsupportedRejected = true; }
assert('unsupported job type is rejected', unsupportedRejected);
const failedJob = harness.createJob({ jobType: 'narrator.tts', payload: { text: 'failure proof' } });
const failedLease = harness.claimJob(failedJob.jobId, 'local-worker-failure');
const failed = harness.executeJob(failedJob.jobId, failedLease.leaseToken, { fail: true });
assert('failure path records failed status', failed.status === 'FAILED');
const retry = harness.retryJob(failedJob.jobId);
assert('retry path requeues failed job', retry.action === 'requeued');
const proof = {
  environment: 'local-in-memory', generatedAt: now(), jobId, jobType: 'narrator.tts', statusTransitions: transitions,
  queueDocumentProof: true, leaseTokenProof: lease?.leaseToken ? 'present-redacted' : 'missing', workerEndpointUsed: 'local proof harness', workerAuthMode: 'local-only',
  logsCount: (harness.logs.get(jobId) || []).length, resultPresent: Boolean(harness.jobs.get(jobId).result), errorPresent: false,
  duplicateExecutionResult: duplicate, failureRetryResult: { failedJobId: failedJob.jobId, failureStatus: failed.status, retry }, unsupportedJobTypeRejected: unsupportedRejected,
  finalVerdict: 'LOCAL_WORKER_LIFECYCLE_READY__DEPLOYMENT_AND_PRODUCTION_SMOKE_NEEDED', snapshot: { job: clone(harness.jobs.get(jobId)), queue: clone(harness.queue.get(jobId)), logs: clone(harness.logs.get(jobId) || []) }
};
const proofDir = process.env.URAI_JOBS_PROOF_DIR;
if (proofDir) { fs.mkdirSync(proofDir, { recursive: true }); fs.writeFileSync(path.join(proofDir, 'jobs-lifecycle-proof.json'), JSON.stringify(proof, null, 2)); }
console.log(JSON.stringify(proof, null, 2));
console.log('[PASS] URAI_JOBS_LOCAL_LIFECYCLE_PROOF');
