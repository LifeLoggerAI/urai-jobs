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
requireText('package.json', 'bash scripts/verify-deploy-authority.sh', 'worker deployment must run through immutable authority verification');
requireText('package.json', 'GITHUB_SHA=\\"$DEPLOY_SOURCE_SHA\\"', 'verified source SHA must bind image tags and receipts');
requireText('scripts/verify-deploy-authority.sh', 'git status --porcelain --untracked-files=all', 'deployment authority must require a clean tree');
requireText('scripts/verify-deploy-authority.sh', 'git merge-base --is-ancestor', 'rollback must be an ancestor of the deployment SHA');
requireText('scripts/verify-deploy-authority.sh', 'DEPLOY-URAI-JOBS-STAGING', 'staging requires environment-specific confirmation');
requireText('scripts/verify-deploy-authority.sh', 'DEPLOY-URAI-JOBS-PRODUCTION', 'production requires environment-specific confirmation');
requireText('scripts/ensure-gcs-bucket.sh', 'GCS_BUCKET_CREATION_APPROVAL', 'bucket creation must require separate infrastructure approval');
requireText('scripts/ensure-gcs-bucket.sh', 'PRODUCTION_INFRASTRUCTURE_APPROVAL', 'production infrastructure creation must require explicit approval');
requireText('scripts/deploy-firebase.sh', 'URAI_JOBS_WORKER_TOKEN_SECRET:-URAI_JOBS_WORKER_TOKEN', 'Firebase deploy must require the canonical worker secret');
rejectText('scripts/deploy-firebase.sh', 'WEBHOOK_SIGNING_SECRET=', 'secrets must not be written into functions/.env');
requireText('scripts/deploy-career-worker.sh', '[BLOCKED]', 'career scaffold deploy must be disabled');
requireText('scripts/deploy-managed-worker.sh', '[BLOCKED]', 'generic synthetic worker deploy must be disabled');
rejectText('scripts/deploy-career-worker.sh', 'gcloud run deploy', 'career scaffold must not contain a deploy command');
rejectText('scripts/deploy-managed-worker.sh', 'gcloud run deploy', 'generic synthetic worker must not contain a deploy command');

const canonicalWorkflow = '.github/workflows/urai-jobs-production-deploy.yml';
requireText(canonicalWorkflow, 'expected_sha:', 'canonical workflow must require an exact target SHA');
requireText(canonicalWorkflow, 'rollback_sha:', 'canonical workflow must require a rollback SHA');
requireText(canonicalWorkflow, 'fetch-depth: 0', 'canonical workflow must fetch rollback history');
requireText(canonicalWorkflow, 'persist-credentials: false', 'canonical checkout must not persist credentials');
requireText(canonicalWorkflow, 'git merge-base --is-ancestor', 'canonical workflow must reject unrelated rollback commits');
requireText(canonicalWorkflow, 'DEPLOY_SOURCE_SHA:', 'canonical workflow must pass exact source identity into worker deployment');
requireText(canonicalWorkflow, 'ALLOW_CREATE_GCS_BUCKET: "false"', 'canonical deploy must not create billable bucket infrastructure');
requireText(canonicalWorkflow, 'workload_identity_provider:', 'canonical workflow must use workload identity');
requireText(canonicalWorkflow, 'pnpm install --frozen-lockfile', 'canonical workflow must use the frozen lockfile');
requireText(canonicalWorkflow, 'PAID-PROVIDER-SMOKE', 'provider spend must require explicit authorization');
requireText(canonicalWorkflow, 'worker-deploy-receipt.json', 'canonical workflow must upload worker deployment receipts');

for (const legacyWorkflow of [
  '.github/workflows/production-deploy-publish.yml',
  '.github/workflows/deploy-asset-worker.yml',
  '.github/workflows/career-production-release.yml',
]) {
  requireText(legacyWorkflow, '[BLOCKED]', 'legacy deployment authority must be disabled');
  rejectText(legacyWorkflow, 'gcloud run deploy', 'legacy deployment authority must not deploy Cloud Run');
  rejectText(legacyWorkflow, 'firebase deploy', 'legacy deployment authority must not deploy Firebase');
}

if (failures.length > 0) {
  console.error('[FAIL] secure worker deployment contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] secure worker deployment contract');
console.log('[PASS] canonical deployment authority: .github/workflows/urai-jobs-production-deploy.yml');
console.log('[PASS] exact clean SHA and ancestor rollback authority required');
console.log('[PASS] implicit billable infrastructure creation blocked');
console.log('[PASS] production workers: narrator-worker, asset-worker');
console.log('[PASS] disabled workers: spatial-worker, studio-worker, career-worker, generic managed worker');
console.log('[PASS] provider calls executed: 0');
