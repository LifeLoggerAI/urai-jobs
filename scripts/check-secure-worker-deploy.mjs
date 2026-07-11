import fs from 'node:fs';
import { runWorkerDeployReceiptValidatorSelfTest } from './validate-worker-deploy-receipt.mjs';

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

function requireOrder(path, markers, description) {
  const source = read(path);
  const indexes = markers.map((marker) => source.indexOf(marker));
  if (indexes.some((index) => index < 0) || indexes.some((value, index) => index > 0 && value <= indexes[index - 1])) {
    failures.push(`${description}: ${path} does not preserve ${markers.join(' -> ')}`);
  }
}

for (const [path, text, description] of [
  ['workers/asset-worker/index.js', "app.post('/', requireWorkerAuth", 'asset execution must require bearer auth'],
  ['workers/asset-worker/index.js', "app.get('/authz', requireWorkerAuth", 'asset auth probe must be protected'],
  ['workers/asset-worker/index.js', 'validateProductionConfiguration();', 'asset worker must fail closed at startup'],
  ['workers/narrator-worker/src/index.ts', "validateRequiredEnv(productionRuntime ? ['URAI_JOBS_WORKER_TOKEN', 'GCS_BUCKET_NAME'] : []);", 'narrator production secrets must be mandatory'],
  ['workers/narrator-worker/src/index.ts', "app.get('/authz', requireWorkerAuth", 'narrator auth probe must be protected'],
  ['functions/src/jobs/executeJob.ts', "defineSecret('URAI_JOBS_WORKER_TOKEN')", 'Firebase worker token must use Secret Manager'],
  ['functions/src/jobs/executeJob.ts', 'secrets: [workerTokenSecret]', 'PubSub function must bind the worker secret'],
]) requireText(path, text, description);

for (const [text, description] of [
  [': "${GITHUB_SHA:?GITHUB_SHA must contain the verified deployment source SHA}"', 'worker deploy must require exact source SHA'],
  [': "${DEPLOY_ROLLBACK_SHA:?DEPLOY_ROLLBACK_SHA must contain the approved rollback source SHA}"', 'worker deploy must require rollback SHA'],
  ['--set-secrets "$secret_vars"', 'worker deploy must inject exact Secret Manager bindings'],
  ['--service-account "$WORKER_RUNTIME_SERVICE_ACCOUNT"', 'worker deploy must use explicit runtime service account'],
  ['Mutable Secret Manager aliases are forbidden', 'worker deploy must reject mutable aliases'],
  ['gcloud builds describe "$build_id"', 'worker deploy must read Cloud Build result'],
  ["value(results.images[0].digest)", 'worker deploy must bind Cloud Build digest'],
  ['gcloud artifacts docker images describe "$immutable_image"', 'worker deploy must resolve Artifact Registry digest'],
  ['--image "$immutable_image"', 'worker deploy must deploy immutable digest'],
  ['--labels "urai-source-sha=$GITHUB_SHA,urai-environment=$URAI_ENV"', 'revision labels must bind source and environment'],
  ['verify_revision_configuration', 'deployed revision configuration must be read back'],
  ['Deployment did not create a revision distinct from rollback', 'new revision must differ from rollback'],
  ["schemaVersion: 'urai-jobs-worker-deploy-receipt-3'", 'worker deploy must emit hardened receipt'],
  ['validate-worker-deploy-receipt.mjs', 'worker deploy receipt must be validated'],
  ['unauthorized auth probe returned', 'unauthorized probe must be verified'],
  ['authorized auth probe returned', 'authorized probe must be verified'],
]) requireText('scripts/deploy-workers.sh', text, description);
rejectText('scripts/deploy-workers.sh', ':latest', 'worker deploy must not bind mutable secret aliases');

for (const [text, description] of [
  ['DEPLOY_TARGET_SECRET_VERSIONS_JSON is required', 'approved target-secret input must be mandatory'],
  ["Target secret approvals must contain exactly", 'approval must have exact logical binding set'],
  ['must use an exact numeric Secret Manager version', 'approved versions must be numeric'],
  ['secrets versions describe', 'approved versions must exist and be enabled before mutation'],
  ['No approved logical binding exists for secret', 'unapproved secret names must fail closed'],
  ['Exact target Secret Manager versions approved before mutation', 'wrapper must record the approval boundary'],
  ['bash scripts/deploy-workers.sh', 'wrapper must delegate only after approval'],
  ['DEPLOY_RECEIPT_PATH', 'wrapper must read the exact worker deployment receipt'],
  ["receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3'", 'post-deploy verification must require the hardened receipt schema'],
  ['Worker deploy receipt service set does not match the approved worker set', 'post-deploy verification must bind the exact approved worker set'],
  ['deployed secret versions do not equal the explicit target approval', 'post-deploy verification must reject secret-version drift'],
  ['Deployed worker receipt secret versions equal the explicit target approval', 'wrapper must record successful receipt-to-approval equality'],
]) requireText('scripts/deploy-workers-approved.sh', text, description);

requireOrder('scripts/deploy-workers-approved.sh', [
  'Exact target Secret Manager versions approved before mutation',
  'bash scripts/deploy-workers.sh',
  'Deployed worker receipt secret versions equal the explicit target approval',
], 'approved wrapper must verify target approvals before mutation and receipt equality after mutation');

requireText('package.json', 'bash scripts/deploy-workers-approved.sh', 'canonical package command must use the approved-version wrapper');
requireText('package.json', '"deploy:firebase:prod": "bash scripts/deploy-firebase.sh"', 'Firebase target must be passed explicitly rather than hard-coded to prod');

for (const [text, description] of [
  ["schemaVersion: 'urai-jobs-firebase-prebuilt-1'", 'Firebase manifest must have a schema'],
  ['Firebase prebuilt source mismatch', 'Firebase output must bind exact source SHA'],
  ['Firebase prebuilt output contains a symlink', 'Firebase output must reject symlinks'],
  ['file set, sizes, or hashes', 'Firebase verifier must compare exact bytes'],
  ['workflow run ID', 'Firebase verifier must bind the workflow run'],
]) requireText('scripts/firebase-prebuilt-manifest.mjs', text, description);
requireText('firebase.json', 'node scripts/firebase-prebuilt-manifest.mjs --verify', 'Firebase predeploy must verify prebuilt bytes');
rejectText('firebase.json', 'npx --yes', 'Firebase predeploy must not download or build under cloud authority');

for (const [text, description] of [
  ['URAI_FIREBASE_PREBUILT_VERIFIED is required', 'Firebase deploy must require prebuilt authority'],
  ['node scripts/firebase-prebuilt-manifest.mjs --verify', 'Firebase deploy must verify prebuilt bytes'],
  ['Canonical Firebase deployment target must be staging or prod', 'Firebase target must be bounded'],
  ['FIREBASE_PROJECT_ID and GCLOUD_PROJECT must match', 'Firebase and Google Cloud projects must agree'],
  ['Refusing to create hosting infrastructure during deployment', 'Firebase deploy must not create hosting implicitly'],
]) requireText('scripts/deploy-firebase.sh', text, description);
rejectText('scripts/deploy-firebase.sh', 'pnpm prod:precheck', 'credentialed Firebase deploy must not run repository precheck');
rejectText('scripts/deploy-firebase.sh', 'pnpm --filter', 'credentialed Firebase deploy must not rebuild source');
rejectText('scripts/deploy-firebase.sh', 'WEBHOOK_SIGNING_SECRET=', 'secrets must not be written into functions/.env');

for (const [path, text, description] of [
  ['scripts/validate-worker-deploy-receipt.mjs', 'buildImageDigest', 'validator must bind build and revision digests'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'secretVersions', 'validator must require numeric secret versions'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'must not use latest', 'validator must reject latest aliases'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'configFingerprint does not match the canonical configuration', 'validator must recompute current configuration'],
  ['scripts/verify-deploy-authority.sh', 'git status --porcelain --untracked-files=all', 'deployment authority must require clean source'],
  ['scripts/verify-deploy-authority.sh', 'git merge-base --is-ancestor', 'rollback must be an ancestor'],
  ['scripts/ensure-gcs-bucket.sh', 'GCS_BUCKET_CREATION_APPROVAL', 'bucket creation must need separate approval'],
]) requireText(path, text, description);

const canonicalWorkflow = '.github/workflows/urai-jobs-production-deploy.yml';
for (const [text, description] of [
  ['target_secret_versions_json:', 'workflow must require exact target secret versions'],
  ['name: Verify exact candidate without cloud authority', 'workflow must have credential-free preflight'],
  ['cloudAuthenticated: false', 'preflight receipt must prove no cloud authentication'],
  ['name: Protected worker and Firebase mutation', 'workflow must isolate protected mutation'],
  ['needs: preflight', 'mutation must depend on preflight'],
  ['environment: ${{ inputs.target }}', 'mutation must use protected environment'],
  ['actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683', 'checkout must be immutable'],
  ['actions/setup-node@1e60f620b9541d80c77f7b4a3bcd8bf5e940c37', 'Node setup must be immutable'],
  ['google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed', 'Google auth must be immutable'],
  ['google-github-actions/setup-gcloud@e427ad8a34f8676edf47cf7d7925499adf3eb74f', 'gcloud setup must be immutable'],
  ['actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', 'artifact upload must be immutable'],
  ['FIREBASE_CLI_VERSION: ${{ vars.FIREBASE_CLI_VERSION }}', 'Firebase CLI must use protected exact version'],
  ['GCLOUD_CLI_VERSION: ${{ vars.GCLOUD_CLI_VERSION }}', 'gcloud CLI must use protected exact version'],
  ['Build and hash Firebase deployable bytes before cloud authentication', 'Firebase bytes must be built before auth'],
  ['Authenticate to Google Cloud with workload identity', 'workflow must use OIDC'],
  ['Deploy canonical worker fleet with approved target secret versions', 'worker mutation must use approved secret versions'],
  ['URAI_FIREBASE_PREBUILT_VERIFIED: \'1\'', 'Firebase mutation must require verified prebuilt bytes'],
  ['paidProviderSmokeAuthorized: false', 'canonical deploy receipt must prohibit paid smoke'],
  ['paidProviderCalls: 0', 'canonical deploy receipt must record zero paid calls'],
  ["Canonical deployment cannot execute paid provider smoke", 'paid provider path must be separately blocked'],
]) requireText(canonicalWorkflow, text, description);

rejectText(canonicalWorkflow, 'paid_provider_smoke_authorization:', 'canonical workflow must not expose a paid-smoke switch');
rejectText(canonicalWorkflow, 'PAID-PROVIDER-SMOKE', 'canonical workflow must not contain a paid provider authorization token');
rejectText(canonicalWorkflow, 'actions/checkout@v4', 'checkout tag must not be mutable');
rejectText(canonicalWorkflow, 'actions/setup-node@v4', 'setup-node tag must not be mutable');
rejectText(canonicalWorkflow, 'google-github-actions/auth@v2', 'Google auth tag must not be mutable');
rejectText(canonicalWorkflow, 'google-github-actions/setup-gcloud@v2', 'gcloud tag must not be mutable');
rejectText(canonicalWorkflow, 'actions/upload-artifact@v4', 'artifact tag must not be mutable');
rejectText(canonicalWorkflow, 'pnpm/action-setup@', 'pnpm setup action must be replaced by exact corepack activation');
rejectText(canonicalWorkflow, 'actions/setup-java@', 'unused Java setup must not expand the credential chain');
rejectText(canonicalWorkflow, 'pnpm add --global firebase-tools\n', 'Firebase CLI must include an exact version');

requireOrder(canonicalWorkflow, [
  'Install exact candidate dependencies before cloud authentication',
  'Revalidate deployment source contracts before cloud authentication',
  'Build and hash Firebase deployable bytes before cloud authentication',
  'Install exact Firebase CLI before cloud authentication',
  'Authenticate to Google Cloud with workload identity',
  'Deploy canonical worker fleet with approved target secret versions',
  'Deploy verified prebuilt Firebase runtime',
], 'workflow must preserve no-credential build and protected mutation order');

const workflowSource = read(canonicalWorkflow);
const authIndex = workflowSource.indexOf('Authenticate to Google Cloud with workload identity');
const deployJobIndex = workflowSource.indexOf('\n  deploy:\n');
if (authIndex < 0 || deployJobIndex < 0) failures.push('canonical workflow auth/deploy section is missing');
else if (workflowSource.slice(deployJobIndex, authIndex).includes('secrets.')) {
  failures.push('canonical workflow exposes repository/environment secrets before the authentication boundary');
}

for (const legacyWorkflow of [
  '.github/workflows/production-deploy-publish.yml',
  '.github/workflows/deploy-asset-worker.yml',
  '.github/workflows/career-production-release.yml',
]) {
  requireText(legacyWorkflow, '[BLOCKED]', 'legacy deployment authority must remain disabled');
  rejectText(legacyWorkflow, 'gcloud run deploy', 'legacy authority must not deploy Cloud Run');
  rejectText(legacyWorkflow, 'firebase deploy', 'legacy authority must not deploy Firebase');
}

try {
  runWorkerDeployReceiptValidatorSelfTest();
} catch (error) {
  failures.push(`worker deploy receipt behavioral validation failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error('[FAIL] secure worker deployment contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] credential-free exact-head preflight precedes protected mutation');
console.log('[PASS] target and rollback secret versions are explicit, numeric, approval-bound, and receipt-verified');
console.log('[PASS] Firebase bytes are built and hashed before cloud authentication');
console.log('[PASS] credential-bearing actions and artifact upload use immutable commits');
console.log('[PASS] canonical deployment can execute zero paid provider calls');