import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failures = 0;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assert(name, condition) {
  if (!condition) {
    failures += 1;
    console.error(`[FAIL] ${name}`);
  } else {
    console.log(`[PASS] ${name}`);
  }
}

const createJob = read('functions/src/jobs/createJob.ts');
const adminV2 = read('functions/src/jobs/admin-v2.ts');
const cancelJob = read('functions/src/jobs/cancelJob.ts');
const processQueueTick = read('functions/src/jobs/processQueueTick.ts');
const retryExpiredLeases = read('functions/src/jobs/retryExpiredLeases.ts');
const executeJob = read('functions/src/jobs/executeJob.ts');
const narratorIndex = read('workers/narrator-worker/src/index.ts');
const narratorHandlers = read('workers/narrator-worker/src/handlers/index.ts');
const narratorTts = read('workers/narrator-worker/src/handlers/narrator-tts.ts');
const jobsApi = read('web/src/lib/jobsApi.ts');
const adminPage = read('web/src/pages/AdminPage.tsx');

assert('createJob writes canonical PENDING job status', createJob.includes("status: 'PENDING'"));
assert('createJob preserves job type on type field', createJob.includes('type: jobType'));
assert('admin v2 supports canonical PENDING status', adminV2.includes('"PENDING"'));
assert('admin retry requeues PENDING jobs', adminV2.includes('status: "PENDING"'));
assert('cancelJob writes canonical CANCELLED job status', cancelJob.includes('status: "CANCELLED"'));
assert('cancelJob marks queue entry DONE after cancellation', cancelJob.includes('status: "DONE"'));
assert('queue leaser writes lease.expiresAt', processQueueTick.includes('expiresAt'));
assert('queue leaser writes Firestore Timestamp leases', processQueueTick.includes('Timestamp.fromMillis'));
assert('expired lease retry queries lease.expiresAt', retryExpiredLeases.includes("where('lease.expiresAt', '<', now)"));
assert('expired lease retry uses canonical PENDING requeue status', retryExpiredLeases.includes("status: 'PENDING'"));
assert('executeJob posts to canonical /execute route', executeJob.includes("/execute"));
assert('executeJob sends stable worker envelope', executeJob.includes('jobId,') && executeJob.includes('leaseToken,'));
assert('executeJob clears lease on success', executeJob.includes('lease: FieldValue.delete()'));
assert('narrator worker exposes /execute route', narratorIndex.includes("app.post('/execute', execute)"));
assert('narrator worker keeps legacy /execute-job route', narratorIndex.includes("app.post('/execute-job', execute)"));
assert('narrator worker exposes health check', narratorIndex.includes("app.get('/healthz'"));
assert('narrator dispatch accepts job.type fallback', narratorHandlers.includes('job.jobType || job.type'));
assert('narrator TTS validates payload text', narratorTts.includes('payload.text is required'));
assert('narrator TTS normalizes mp3 format to MP3', narratorTts.includes("mp3: 'MP3'"));
assert('web API uses canonical uppercase statuses', jobsApi.includes('| "PENDING"') && jobsApi.includes('| "SUCCESS"'));
assert('admin board queries canonical PENDING status', adminPage.includes('"PENDING"'));
assert('admin board retries FAILED/DEAD/CANCELLED only', adminPage.includes('status === "FAILED"') && adminPage.includes('status === "DEAD"'));

if (failures > 0) {
  console.error(`[FAIL] URAI_JOBS_CONTRACTS ${failures} regression(s) detected.`);
  process.exit(1);
}

console.log('[PASS] URAI_JOBS_CONTRACTS');
