import fs from 'node:fs';

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function check(name, condition) {
  if (!condition) { console.error(`[FAIL] ${name}`); process.exitCode = 1; }
  else console.log(`[PASS] ${name}`);
}

const executeJob = read('functions/src/jobs/executeJob.ts');
const createJob = read('functions/src/jobs/createJob.ts');
const contracts = read('functions/src/jobs/job-contracts.ts');
const narrator = read('workers/narrator-worker/src/index.ts');
const career = read('workers/career-worker/src/handlers/index.ts');
const app = read('web/src/App.tsx');
const authGate = read('web/src/components/AuthGate.tsx');

check('executeJob reads job and queue inside a transaction', executeJob.includes('startJobIfLeased') && executeJob.includes('db.runTransaction'));
check('executeJob refuses non-LEASED execution', executeJob.includes("job.status !== 'LEASED'") && executeJob.includes("queue.status !== 'LEASED'"));
check('executeJob ignores duplicate terminal deliveries', executeJob.includes('TERMINAL_JOB_STATUSES') && executeJob.includes('Duplicate execution ignored'));
check('executeJob rejects explicit worker failure bodies', executeJob.includes('assertWorkerResultAccepted') && executeJob.includes("record.ok === false") && executeJob.includes("NOT_IMPLEMENTED"));
check('inline fallback disabled by default in production', executeJob.includes('URAI_JOBS_ALLOW_INLINE_FALLBACK') && executeJob.includes('Inline fallback is disabled'));
check('production worker dispatch requires worker auth configuration', executeJob.includes('URAI_JOBS_WORKER_TOKEN') && executeJob.includes('required in production'));
check('createJob imports job contract validation', createJob.includes('parseJobPayload') && createJob.includes('SUPPORTED_JOB_TYPES'));
check('createJob enforces idempotency', createJob.includes('jobIdempotency') && createJob.includes('idempotencyKeyHash'));
check('job types are allowlisted', contracts.includes('SUPPORTED_JOB_TYPES') && contracts.includes('narrator.tts') && !contracts.includes('asset.render'));
check('narrator worker fails closed when auth config missing', narrator.includes('worker auth token is not configured') && narrator.includes('URAI_JOBS_WORKER_TOKEN'));
check('career worker no longer returns stubbed success', career.includes('NOT_IMPLEMENTED') && !career.includes("status: 'stubbed'"));
check('admin route is route-gated', app.includes('requireOperator') && app.includes('AuthGate'));
check('create route is route-gated', app.includes('AuthGate') && app.includes('CreateJobPageLocked'));
check('AuthGate renders sign-in state', authGate.includes('Sign in required'));

if (process.exitCode) process.exit(process.exitCode);
console.log('[PASS] URAI_JOBS_PRODUCTION_LOCK_CHECK');
