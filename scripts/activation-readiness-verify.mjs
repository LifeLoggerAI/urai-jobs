import fs from 'node:fs';

let failed = 0;

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function ok(name, condition) {
  if (condition) console.log(`[PASS] ${name}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}

const readme = read('README.md');
const packageJson = JSON.parse(read('package.json') || '{}');
const contracts = read('functions/src/jobs/job-contracts.ts');
const createJob = read('functions/src/jobs/createJob.ts');
const executeJob = read('functions/src/jobs/executeJob.ts');
const jobsApi = read('web/src/lib/jobsApi.ts');
const createPageLocked = read('web/src/pages/CreateJobPageLocked.tsx');
const app = read('web/src/App.tsx');
const authGate = read('web/src/components/AuthGate.tsx');
const productionLock = read('scripts/check-production-lock.mjs');
const claimsCheck = read('scripts/check-production-claims.mjs');
const routeCheck = read('scripts/verify-routes.mjs');
const lifecycle = read('scripts/jobs-lifecycle.mjs');
const sharedTypes = read('packages/shared-types/src/index.ts');
const rootWorker = read('workers/src/index.ts');
const legacyWorkerTs = read('workers/index.ts');
const legacyWorkerJs = read('workers/index.js');
const careerWorker = read('workers/career-worker/src/index.ts') + read('workers/career-worker/src/handlers/index.ts');
const assetWorker = read('workers/asset-worker/index.js');
const spatialWorker = read('workers/spatial-worker/index.js');
const studioWorker = read('workers/studio-worker/index.js');
const workflow = read('.github/workflows/production-verification.yml');

ok('activation guard uses current lifecycle-lock boundary', readme.includes('internal execution infrastructure preview'));
ok('README explicitly blocks production worker ready claim', readme.includes('must not be described as production worker ready until lifecycle proof exists'));
ok('README says production smoke has not run in this branch pass', readme.includes('production lifecycle smoke: not run in this branch pass'));
ok('README labels root and legacy workers fail-closed', readme.includes('root and legacy generic workers: gated fail-closed'));

ok('package activation:verify delegates to current jobs verifier', packageJson.scripts?.['activation:verify'] === 'npm run jobs:verify');
ok('package jobs:verify runs production lock check', String(packageJson.scripts?.['jobs:verify'] || '').includes('check-production-lock.mjs'));
ok('package jobs:verify runs claims check', String(packageJson.scripts?.['jobs:verify'] || '').includes('check-production-claims.mjs'));
ok('package jobs:verify runs route check', String(packageJson.scripts?.['jobs:verify'] || '').includes('verify-routes.mjs'));

ok('backend job contracts exist', contracts.includes('SUPPORTED_JOB_TYPES') && contracts.includes('parseJobPayload'));
ok('only narrator.tts is allowlisted in backend contracts', contracts.includes('narrator.tts') && !contracts.includes('career.profile.summarize') && !contracts.includes('asset.render'));
ok('createJob validates against supported contracts', createJob.includes('parseJobPayload') && createJob.includes('SUPPORTED_JOB_TYPES'));
ok('createJob enforces idempotency', createJob.includes('jobIdempotency') && createJob.includes('idempotencyKeyHash'));
ok('executeJob requires worker auth for production dispatch', executeJob.includes('URAI_JOBS_WORKER_TOKEN') && executeJob.includes('required in production'));
ok('executeJob rejects explicit worker failure bodies', executeJob.includes('assertWorkerResultAccepted') && executeJob.includes('NOT_IMPLEMENTED'));
ok('executeJob ignores duplicate terminal deliveries', executeJob.includes('TERMINAL_JOB_STATUSES') && executeJob.includes('Duplicate execution ignored'));

ok('client createJob has explicit supported type allowlist', jobsApi.includes('SUPPORTED_CREATE_JOB_TYPES') && jobsApi.includes('narrator.tts'));
ok('client createJob rejects gated unsupported types', jobsApi.includes('gated or not implemented'));
ok('locked create page exists', createPageLocked.includes('CreateJobPageLocked'));
ok('locked create page only submits narrator.tts', createPageLocked.includes('createJob("narrator.tts"'));
ok('app route-gates create page', app.includes('AuthGate') && app.includes('CreateJobPageLocked'));
ok('app route-gates admin page for operator', app.includes('requireOperator') && app.includes('AdminPage'));
ok('AuthGate renders sign-in state', authGate.includes('Sign in required'));

ok('shared job statuses are lifecycle-lock statuses', sharedTypes.includes("| 'PENDING'") && sharedTypes.includes("| 'LEASED'") && sharedTypes.includes("| 'SUCCESS'"));
ok('shared queue status separates DONE from JobStatus', sharedTypes.includes('JobQueueStatus') && sharedTypes.includes("| 'DONE'"));
ok('lifecycle harness exists', lifecycle.includes('URAI_JOBS_LIFECYCLE_PROOF') || lifecycle.includes('lifecycle'));
ok('production lock checker exists', productionLock.includes('URAI_JOBS_PRODUCTION_LOCK_CHECK'));
ok('claims checker exists', claimsCheck.includes('URAI_JOBS_PRODUCTION_CLAIMS_CHECK'));
ok('route checker exists', routeCheck.includes('URAI_JOBS_ROUTE_VERIFICATION'));

const blockedWorkers = [rootWorker, legacyWorkerTs, legacyWorkerJs, careerWorker, assetWorker, spatialWorker, studioWorker];
ok('all non-narrator/generic workers return not implemented or fail closed', blockedWorkers.every((worker) => worker.includes('NOT_IMPLEMENTED') || worker.includes('not production implemented yet')));
ok('generic and placeholder workers do not contain direct SUCCESS terminal writes', [rootWorker, legacyWorkerTs, legacyWorkerJs, assetWorker, spatialWorker, studioWorker].every((worker) => !worker.includes("status: 'SUCCESS'") && !worker.includes('status: "SUCCESS"')));
ok('generic and placeholder workers require worker auth', [rootWorker, legacyWorkerTs, legacyWorkerJs, assetWorker, spatialWorker, studioWorker].every((worker) => worker.includes('URAI_JOBS_WORKER_TOKEN')));

ok('production verification workflow is current CI gate', workflow.includes('production-verification') || workflow.includes('URAI Jobs Production Verification'));
ok('workflow runs lifecycle gate', workflow.includes('npm run jobs:lifecycle'));
ok('workflow runs production lock gate', workflow.includes('npm run check:production-lock'));
ok('workflow runs claims gate', workflow.includes('npm run check:production-claims'));
ok('workflow runs route gate', workflow.includes('npm run verify:routes'));
ok('workflow runs typecheck/build/test gates', workflow.includes('npm run check:types') && workflow.includes('npm run build') && workflow.includes('npm test'));
ok('workflow explicitly avoids deploy', workflow.includes('No deployment is performed'));

if (failed > 0) {
  console.error(`[FAIL] URAI_JOBS_ACTIVATION_READINESS_PREVIEW_CHECK ${failed} checks failed`);
  process.exit(1);
}

console.log('[PASS] URAI_JOBS_ACTIVATION_READINESS_PREVIEW_CHECK');
