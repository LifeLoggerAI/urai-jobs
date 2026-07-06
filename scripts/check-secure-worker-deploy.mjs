import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

function requireText(path, text, description) {
  const source = read(path);
  if (!source.includes(text)) failures.push(`${description}: ${path} is missing ${JSON.stringify(text)}`);
}

function rejectText(path, text, description) {
  const source = read(path);
  if (source.includes(text)) failures.push(`${description}: ${path} still contains ${JSON.stringify(text)}`);
}

requireText('workers/asset-worker/index.js', "app.post('/', requireWorkerAuth", 'asset execution must require bearer auth');
requireText('workers/asset-worker/index.js', "app.get('/authz', requireWorkerAuth", 'asset auth probe must be protected');
requireText('workers/asset-worker/index.js', 'validateProductionConfiguration();', 'asset worker must fail closed at startup');
requireText('workers/narrator-worker/src/index.ts', "validateRequiredEnv(productionRuntime ? ['URAI_JOBS_WORKER_TOKEN', 'GCS_BUCKET_NAME'] : []);", 'narrator production secrets must be mandatory');
requireText('workers/narrator-worker/src/index.ts', "app.get('/authz', requireWorkerAuth", 'narrator auth probe must be protected');
requireText('functions/src/jobs/executeJob.ts', "defineSecret('URAI_JOBS_WORKER_TOKEN')", 'Firebase worker token must use Secret Manager');
requireText('functions/src/jobs/executeJob.ts', 'secrets: [workerTokenSecret]', 'PubSub function must bind the worker secret');
requireText('scripts/deploy-workers.sh', '--set-secrets "$secret_vars"', 'worker deploy must inject Secret Manager values');
requireText('scripts/deploy-workers.sh', '--service-account "$WORKER_RUNTIME_SERVICE_ACCOUNT"', 'worker deploy must use an explicit runtime service account');
requireText('scripts/deploy-workers.sh', 'rollbackRevision', 'worker deploy receipt must record rollback revision');
requireText('scripts/deploy-workers.sh', 'unauthorized auth probe returned', 'worker deploy must prove unauthorized access is rejected');
requireText('scripts/deploy-workers.sh', 'authorized auth probe returned', 'worker deploy must prove authorized access succeeds');
requireText('scripts/deploy-career-worker.sh', '[BLOCKED]', 'career scaffold deploy must be disabled');
requireText('scripts/deploy-managed-worker.sh', '[BLOCKED]', 'generic synthetic worker deploy must be disabled');
rejectText('scripts/deploy-career-worker.sh', 'gcloud run deploy', 'career scaffold must not contain a deploy command');
rejectText('scripts/deploy-managed-worker.sh', 'gcloud run deploy', 'generic synthetic worker must not contain a deploy command');

if (failures.length > 0) {
  console.error('[FAIL] secure worker deployment contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] secure worker deployment contract');
console.log('[PASS] production workers: narrator-worker, asset-worker');
console.log('[PASS] disabled workers: spatial-worker, studio-worker, career-worker, generic managed worker');
console.log('[PASS] provider calls executed: 0');
