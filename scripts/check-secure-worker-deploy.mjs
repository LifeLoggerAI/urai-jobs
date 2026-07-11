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

function jobSection(source, name) {
  const marker = `\n  ${name}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next);
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
  ['Target secret approvals must contain exactly', 'approval must have exact logical binding set'],
  ['must use an exact numeric Secret Manager version', 'approved versions must be numeric'],
  ['secrets versions describe', 'approved versions must exist and be enabled before mutation'],
  ['No approved logical binding exists for secret', 'unapproved secret names must fail closed'],
  ['Exact target Secret Manager versions approved before mutation', 'wrapper must record the approval boundary'],
  ['DEPLOY_RECEIPT_PATH', 'wrapper must read the exact worker deployment receipt'],
  ["receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3'", 'post-deploy verification must require the hardened receipt schema'],
  ['Worker deploy receipt service set does not match the approved worker set', 'post-deploy verification must bind the exact approved worker set'],
  ['deployed secret versions do not equal the explicit target approval', 'post-deploy verification must reject secret-version drift'],
  ['Deployed worker receipt secret versions equal the explicit target approval', 'wrapper must record successful receipt-to-approval equality'],
  ['bash scripts/deploy-workers.sh', 'wrapper must delegate only after approval'],
]) requireText('scripts/deploy-workers-approved.sh', text, description);
requireOrder('scripts/deploy-workers-approved.sh', [
  'Exact target Secret Manager versions approved before mutation',
  'bash scripts/deploy-workers.sh',
  'Deployed worker receipt secret versions equal the explicit target approval',
], 'approved wrapper must verify target approvals before mutation and receipt equality after mutation');

for (const [text, description] of [
  ["schemaVersion !== 'urai-jobs-worker-deploy-receipt-3'", 'URL exporter must require hardened receipt'],
  ['requiredWorkers = new Map', 'URL exporter must use an exact canonical worker set'],
  ['receipt.commitSha !== expectedSha', 'URL exporter must bind exact source SHA'],
  ['receipt.project !== expectedProject', 'URL exporter must bind project'],
  ['receipt.environment !== expectedEnvironment', 'URL exporter must bind environment'],
  ['image digest', 'URL exporter must bind immutable runtime image'],
]) requireText('scripts/export-worker-urls-from-receipt.mjs', text, description);

requireText('scripts/verify-worker-health.mjs', "['narrator-worker', process.env.NARRATOR_WORKER_URL]", 'Narrator health must be required');
requireText('scripts/verify-worker-health.mjs', "['asset-worker', process.env.ASSET_WORKER_URL]", 'Asset health must be required');
requireText('scripts/verify-worker-health.mjs', 'optionalWorkers', 'Undeployed workers must be optional only when explicitly supplied');
requireText('scripts/verify-worker-health.mjs', "parsed.protocol !== 'https:'", 'Worker health must require credential-free HTTPS URLs');

requireText('package.json', 'bash scripts/deploy-workers-approved.sh', 'canonical package command must use approved-version wrapper');
requireText('package.json', '"deploy:firebase:prod": "bash scripts/deploy-firebase.sh"', 'Firebase target must be passed explicitly rather than hard-coded to prod');

for (const [text, description] of [
  ["schemaVersion: 'urai-jobs-firebase-prebuilt-1'", 'Firebase manifest must have a schema'],
  ['Firebase prebuilt source mismatch', 'Firebase output must bind exact source SHA'],
  ['Firebase prebuilt output contains a symlink', 'Firebase output must reject symlinks'],
  ['file set, sizes, or hashes', 'Firebase verifier must compare exact bytes'],
  ['workflow run ID', 'Firebase verifier must bind workflow run'],
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
const workflowSource = read(canonicalWorkflow);
const preflightJob = jobSection(workflowSource, 'preflight');
const deployJob = jobSection(workflowSource, 'deploy');
const publicJob = jobSection(workflowSource, 'public-verify');
if (!preflightJob) failures.push('canonical workflow is missing credential-free preflight job');
if (!deployJob) failures.push('canonical workflow is missing protected deploy job');
if (!publicJob) failures.push('canonical workflow is missing public no-credential verification job');

for (const [text, description] of [
  ['target_secret_versions_json:', 'workflow must require exact target secret versions'],
  ['name: Verify exact candidate without cloud authority', 'workflow must have credential-free preflight'],
  ['cloudAuthenticated: false', 'preflight and public receipts must prove no cloud authentication'],
  ['name: Protected worker and Firebase mutation', 'workflow must isolate protected mutation'],
  ['name: Public verification without cloud identity', 'workflow must isolate public verification'],
  ['needs: preflight', 'mutation must depend on preflight'],
  ['needs: deploy', 'public verification must depend on mutation'],
  ['environment: ${{ inputs.target }}', 'mutation must use protected environment'],
  ['actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683', 'checkout must be immutable'],
  ['actions/setup-node@1e60f620b9541d80c77f7b4a3bcd8bf5e940c37', 'Node setup must be immutable'],
  ['google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed', 'Google auth must be immutable'],
  ['google-github-actions/setup-gcloud@e427ad8a34f8676edf47cf7d7925499adf3eb74f', 'gcloud setup must be immutable'],
  ['actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', 'artifact upload must be immutable'],
  ['actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093', 'artifact download must be immutable'],
  ['FIREBASE_CLI_VERSION: ${{ vars.FIREBASE_CLI_VERSION }}', 'Firebase CLI must use protected exact version'],
  ['GCLOUD_CLI_VERSION: ${{ vars.GCLOUD_CLI_VERSION }}', 'gcloud CLI must use protected exact version'],
  ['Build and hash Firebase deployable bytes before cloud authentication', 'Firebase bytes must be built before auth'],
  ['Authenticate to Google Cloud with workload identity', 'workflow must use OIDC'],
  ['Deploy canonical worker fleet with approved target secret versions', 'worker mutation must use approved secret versions'],
  ['Export canonical URLs from immutable worker receipt', 'Firebase URLs must come from receipt rather than fresh discovery'],
  ["URAI_FIREBASE_PREBUILT_VERIFIED: '1'", 'Firebase mutation must require verified prebuilt bytes'],
  ['Destroy cloud credentials before evidence handoff', 'cloud credentials must be destroyed before artifact handoff'],
  ['Upload mutation evidence after credential cleanup', 'mutation artifact must be uploaded after cleanup'],
  ['Bind public verification to mutation receipts', 'public verification must bind mutation receipts'],
  ['id: worker_health', 'worker health outcome must be captured'],
  ['id: domain_verify', 'domain outcome must be captured'],
  ['publicWorkerHealthChecked: workerPassed', 'public receipt must derive worker status from actual outcome'],
  ['publicHostingChecked: domainsPassed', 'public receipt must derive domain status from actual outcome'],
  ['publicVerificationCompleted: workerPassed && domainsPassed', 'public receipt must not self-certify'],
  ['node scripts/stamp-deployment-artifact.mjs', 'public stamp must run without package-manager setup'],
  ['paidProviderSmokeAuthorized: false', 'canonical deploy receipt must prohibit paid smoke'],
  ['paidProviderCalls: 0', 'canonical receipts must record zero paid calls'],
]) requireText(canonicalWorkflow, text, description);

for (const [text, description] of [
  ['paid_provider_smoke_authorization:', 'canonical workflow must not expose a paid-smoke switch'],
  ['PAID-PROVIDER-SMOKE', 'canonical workflow must not contain paid provider authorization'],
  ['actions/checkout@v4', 'checkout tag must not be mutable'],
  ['actions/setup-node@v4', 'setup-node tag must not be mutable'],
  ['google-github-actions/auth@v2', 'Google auth tag must not be mutable'],
  ['google-github-actions/setup-gcloud@v2', 'gcloud tag must not be mutable'],
  ['actions/upload-artifact@v4', 'artifact upload tag must not be mutable'],
  ['actions/download-artifact@v4', 'artifact download tag must not be mutable'],
  ['pnpm/action-setup@', 'pnpm setup action must be replaced by exact corepack activation'],
  ['actions/setup-java@', 'unused Java setup must not expand the credential chain'],
  ['publicWorkerHealthChecked: true', 'public receipt must not hard-code successful worker verification'],
  ['publicHostingChecked: true', 'public receipt must not hard-code successful domain verification'],
]) rejectText(canonicalWorkflow, text, description);

requireOrder(canonicalWorkflow, [
  'Install exact candidate dependencies before cloud authentication',
  'Revalidate deployment source contracts before cloud authentication',
  'Build and hash Firebase deployable bytes before cloud authentication',
  'Install exact Firebase CLI before cloud authentication',
  'Authenticate to Google Cloud with workload identity',
  'Deploy canonical worker fleet with approved target secret versions',
  'Deploy verified prebuilt Firebase runtime',
  'Destroy cloud credentials before evidence handoff',
  'Upload mutation evidence after credential cleanup',
  'Public verification without cloud identity',
], 'workflow must preserve pre-auth build, protected mutation, cleanup, and public verification order');

const authIndex = deployJob.indexOf('Authenticate to Google Cloud with workload identity');
if (authIndex < 0) failures.push('canonical deploy job authentication boundary is missing');
else if (deployJob.slice(0, authIndex).includes('secrets.')) failures.push('canonical deploy job exposes secrets before authentication boundary');
if (publicJob.includes('secrets.') || publicJob.includes('id-token: write') || publicJob.includes('environment:')) {
  failures.push('public verification job must not receive secrets, OIDC permission, or protected environment authority');
}
for (const forbidden of ['gcloud ', 'firebase deploy', 'google-github-actions/auth@', 'google-github-actions/setup-gcloud@']) {
  if (publicJob.includes(forbidden)) failures.push(`public verification job contains forbidden cloud authority: ${forbidden}`);
}
if (deployJob.includes('pnpm prod:verify-workers') || deployJob.includes('pnpm domains:verify') || deployJob.includes('stamp-deployment-artifact')) {
  failures.push('protected mutation job must not run public verification or public stamp scripts');
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
console.log('[PASS] cloud credentials are destroyed before immutable mutation evidence handoff');
console.log('[PASS] public health, domains, and outcome-exact receipts run without cloud identity');
console.log('[PASS] canonical deployment can execute zero paid provider calls');
