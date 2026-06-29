import fs from 'node:fs';

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function check(name, condition) {
  if (!condition) { console.error(`[FAIL] ${name}`); process.exitCode = 1; }
  else console.log(`[PASS] ${name}`);
}

const executeJob = read('functions/src/jobs/executeJob.ts');
const createJob = read('functions/src/jobs/createJob.ts');
const contracts = read('functions/src/jobs/job-contracts.ts');
const jobsApi = read('web/src/lib/jobsApi.ts');
const narrator = read('workers/narrator-worker/src/index.ts');
const rootWorker = read('workers/src/index.ts');
const workerTsconfig = read('workers/tsconfig.json');
const career = read('workers/career-worker/src/index.ts') + read('workers/career-worker/src/handlers/index.ts');
const asset = read('workers/asset-worker/index.js');
const spatial = read('workers/spatial-worker/index.js');
const studio = read('workers/studio-worker/index.js');
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
check('backend job types are allowlisted', contracts.includes('SUPPORTED_JOB_TYPES') && contracts.includes('narrator.tts') && !contracts.includes('asset.render'));
check('client createJob blocks unsupported types before callable', jobsApi.includes('SUPPORTED_CREATE_JOB_TYPES') && jobsApi.includes('isSupportedCreateJobType') && jobsApi.includes('gated or not implemented'));
check('narrator worker fails closed when auth config missing', narrator.includes('worker auth token is not configured') && narrator.includes('URAI_JOBS_WORKER_TOKEN'));
check('root worker cannot fake success', rootWorker.includes('NOT_IMPLEMENTED') && !rootWorker.includes("status: 'SUCCESS'"));
check('root worker requires worker auth', rootWorker.includes('URAI_JOBS_WORKER_TOKEN') && rootWorker.includes('UNAUTHORIZED_WORKER_REQUEST'));
check('root workers tsconfig only includes root worker src', workerTsconfig.includes('"include": ["src/**/*.ts"]') && workerTsconfig.includes('"rootDir": "src"'));
check('career worker fails closed and returns not implemented', career.includes('worker auth token is not configured') && career.includes('NOT_IMPLEMENTED') && !career.includes("status: 'stubbed'"));
check('asset worker cannot fake success', asset.includes('NOT_IMPLEMENTED') && !asset.includes("status: 'SUCCESS'"));
check('spatial worker cannot fake success', spatial.includes('NOT_IMPLEMENTED') && !spatial.includes("status: 'SUCCESS'"));
check('studio worker cannot fake success', studio.includes('NOT_IMPLEMENTED') && !studio.includes("status: 'SUCCESS'"));
check('placeholder workers require worker auth', [asset, spatial, studio].every((worker) => worker.includes('URAI_JOBS_WORKER_TOKEN') && worker.includes('UNAUTHORIZED_WORKER_REQUEST')));
check('admin route is route-gated', app.includes('requireOperator') && app.includes('AuthGate'));
check('create route is route-gated', app.includes('AuthGate') && app.includes('CreateJobPageLocked'));
check('AuthGate renders sign-in state', authGate.includes('Sign in required'));

if (process.exitCode) process.exit(process.exitCode);
console.log('[PASS] URAI_JOBS_PRODUCTION_LOCK_CHECK');
