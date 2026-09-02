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
  ['[[ "$version_id" =~ ^[1-9][0-9]*$ ]]', 'discovered Secret Manager versions must be exact positive integers'],
  ['SECRET_VERSION_IDS["$secret_name"]="$version_id"', 'validated numeric Secret Manager versions must be retained by secret name'],
  ['local worker_token_version="${SECRET_VERSION_IDS[$URAI_JOBS_WORKER_TOKEN_SECRET]}"', 'worker token binding must use the validated numeric version map'],
  ['gcloud builds describe "$build_id"', 'worker deploy must read Cloud Build result'],
  ['value(results.images[0].digest)', 'worker deploy must bind Cloud Build digest'],
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

requireText('scripts/verify-rollback-revision.mjs', 'secretRef?.key != null', 'rollback verifier must read Cloud Run secret versions from secretKeyRef.key');
rejectText('scripts/verify-rollback-revision.mjs', 'secretRef?.version', 'rollback verifier must not read the nonexistent secretKeyRef.version field');
requireText('scripts/deploy-workers.sh', 'if (entry?.name && ref?.key)', 'deployed revision verifier must read Cloud Run secret versions from secretKeyRef.key');
rejectText('scripts/deploy-workers.sh', 'ref?.version', 'deployed revision verifier must not read the nonexistent secretKeyRef.version field');

const deployWorkersSource = read('scripts/deploy-workers.sh');
for (const line of deployWorkersSource.split('\n')) {
  if (/^\s*(?:local\s+)?secret_vars=.*:latest(?:[",]|$)/.test(line)) {
    failures.push(`worker deploy constructs a mutable Secret Manager alias: ${line.trim()}`);
  }
}

for (const [text, description] of [
  ['DEPLOY_TARGET_SECRET_VERSIONS_JSON is required', 'approved target-secret input must be mandatory'],
  ['Target secret approvals must contain exactly', 'approval must have exact logical binding set'],
  ['must use an exact numeric Secret Manager version', 'approved versions must be numeric'],
  ['secrets versions describe', 'approved versions must exist and be enabled before mutation'],
  ['No approved logical binding exists for secret', 'unapproved secret names must fail closed'],
  ['Exact target Secret Manager versions approved before mutation', 'wrapper must record approval before mutation'],
  ['DEPLOY_RECEIPT_PATH', 'wrapper must read the exact worker receipt'],
  ["receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3'", 'post-deploy verification must require hardened schema'],
  ['Worker deploy receipt service set does not match the approved worker set', 'post-deploy verification must bind exact workers'],
  ['deployed secret versions do not equal the explicit target approval', 'post-deploy verification must reject secret drift'],
  ['Deployed worker receipt secret versions equal the explicit target approval', 'wrapper must record receipt-to-approval equality'],
  ['bash scripts/deploy-workers.sh', 'wrapper must delegate only after approval'],
]) requireText('scripts/deploy-workers-approved.sh', text, description);
requireOrder('scripts/deploy-workers-approved.sh', [
  'Exact target Secret Manager versions approved before mutation',
  'bash scripts/deploy-workers.sh',
  'Deployed worker receipt secret versions equal the explicit target approval',
], 'approved wrapper must verify before and after mutation');

for (const [text, description] of [
  ["schemaVersion !== 'urai-jobs-worker-deploy-receipt-3'", 'URL exporter must require hardened receipt'],
  ['requiredWorkers = new Map', 'URL exporter must use exact canonical workers'],
  ['receipt.commitSha !== expectedSha', 'URL exporter must bind source SHA'],
  ['receipt.project !== expectedProject', 'URL exporter must bind project'],
  ['receipt.environment !== expectedEnvironment', 'URL exporter must bind environment'],
  ['image digest', 'URL exporter must bind immutable image'],
]) requireText('scripts/export-worker-urls-from-receipt.mjs', text, description);

requireText('scripts/verify-worker-health.mjs', "['narrator-worker', process.env.NARRATOR_WORKER_URL]", 'Narrator health must be required');
requireText('scripts/verify-worker-health.mjs', "['asset-worker', process.env.ASSET_WORKER_URL]", 'Asset health must be required');
requireText('scripts/verify-worker-health.mjs', 'optionalWorkers', 'Undeployed workers must be optional');
requireText('scripts/verify-worker-health.mjs', "parsed.protocol !== 'https:'", 'Worker health must require credential-free HTTPS');

requireText('package.json', 'bash scripts/deploy-workers-approved.sh', 'package deployment must use approved wrapper');
requireText('package.json', '"deploy:firebase:prod": "bash scripts/deploy-firebase.sh"', 'Firebase target must not be hard-coded');

for (const [text, description] of [
  ["schemaVersion: 'urai-jobs-firebase-prebuilt-1'", 'Firebase manifest must have schema'],
  ['URAI_FIREBASE_PREBUILT_ROOT', 'Firebase verifier must support an external artifact root'],
  ['Choose exactly one of --write, --verify, or --materialize', 'Firebase artifact modes must be exclusive'],
  ['--materialize requires URAI_FIREBASE_PREBUILT_ROOT outside the repository', 'materialization must require external source'],
  ['Firebase prebuilt source mismatch', 'Firebase output must bind source SHA'],
  ['Firebase prebuilt output contains a symlink', 'Firebase output must reject symlinks'],
  ['file set, sizes, or hashes', 'Firebase verifier must compare exact bytes'],
  ['workflow run ID', 'Firebase verifier must bind workflow run'],
  ["status: 'MATERIALIZED'", 'Firebase verifier must revalidate materialized bytes'],
]) requireText('scripts/firebase-prebuilt-manifest.mjs', text, description);
requireText('firebase.json', 'node scripts/firebase-prebuilt-manifest.mjs --verify', 'Firebase predeploy must verify materialized bytes');
rejectText('firebase.json', 'npx --yes', 'Firebase predeploy must not download or build under authority');

for (const [text, description] of [
  ['URAI_FIREBASE_PREBUILT_VERIFIED is required', 'Firebase deploy must require prebuilt authority'],
  ['node scripts/firebase-prebuilt-manifest.mjs --verify', 'Firebase deploy must verify prebuilt bytes'],
  ['Canonical Firebase deployment target must be staging or prod', 'Firebase target must be bounded'],
  ['FIREBASE_PROJECT_ID and GCLOUD_PROJECT must match', 'Firebase and Google Cloud projects must agree'],
  ['Refusing to create hosting infrastructure during deployment', 'Firebase deploy must not create hosting implicitly'],
  ['Temporary Firebase config must stay at the repository root.', 'temporary Firebase config must stay at the project root for relative paths'],
  ['Temporary Firebase config filename must bind the exact source SHA.', 'temporary Firebase config must bind source identity'],
  ["schemaVersion: 'urai-jobs-firebase-deploy-config-1'", 'Firebase deploy must emit a runtime configuration receipt'],
  ['firebaseConfigSha256', 'Firebase receipt must hash effective Firebase configuration'],
  ['functionsEnvSha256', 'Firebase receipt must hash effective functions environment'],
  ['URAI_BUILD_SHA=${DEPLOY_SOURCE_SHA}', 'Firebase functions must receive the exact source SHA'],
  ["{ source: '/api/buildinfo', function: 'buildInfo' }", 'temporary Hosting config must expose build identity'],
  ["buildInfoPath: '/api/buildinfo'", 'Firebase receipt must record build identity path'],
  ['buildInfoExpectedSha: process.env.DEPLOY_SOURCE_SHA', 'Firebase receipt must record expected runtime SHA'],
  ['runtimeIdentityVerified: false', 'mutation receipt must not self-certify public runtime identity'],
  ['secretValuesIncluded: false', 'Firebase receipt must explicitly exclude secret values'],
  ['assert_only_evidence_residue', 'Firebase deploy must verify cleanup residue'],
  ['Firebase deployment left unexpected repository changes', 'Firebase deploy must fail on source residue'],
  ['trap - EXIT', 'Firebase deploy must disable the cleanup trap only after explicit cleanup'],
  ['public runtime identity verification is still required', 'Firebase deploy must preserve the two-phase completion boundary'],
]) requireText('scripts/deploy-firebase.sh', text, description);
rejectText('scripts/deploy-firebase.sh', 'pnpm prod:precheck', 'credentialed Firebase deploy must not run production precheck');
rejectText('scripts/deploy-firebase.sh', 'pnpm --filter', 'credentialed Firebase deploy must not rebuild source');
rejectText('scripts/deploy-firebase.sh', 'WEBHOOK_SIGNING_SECRET=', 'secrets must not enter functions/.env');
rejectText('scripts/deploy-firebase.sh', 'set_hosting_site_in_firebase_json', 'Firebase deploy must not edit tracked firebase.json');
rejectText('scripts/deploy-firebase.sh', 'runtimeIdentityVerified: true', 'mutation receipt must not claim public identity verification');

for (const [path, text, description] of [
  ['functions/src/system/buildInfo.ts', "schemaVersion: 'urai-jobs-build-info-1'", 'build-info endpoint must expose a versioned schema'],
  ['functions/src/system/buildInfo.ts', 'process.env.URAI_BUILD_SHA', 'build-info endpoint must report source SHA'],
  ['functions/src/system/buildInfo.ts', 'process.env.URAI_ENV', 'build-info endpoint must report environment'],
  ['functions/src/system/buildInfo.ts', 'process.env.FIREBASE_PROJECT_ID', 'build-info endpoint must report project'],
  ['functions/src/index.ts', 'export { buildInfo } from "./system/buildInfo.js";', 'build-info endpoint must be exported'],
  ['scripts/verify-custom-domains.mjs', '`${base}/api/buildinfo`', 'public verifier must call build-info endpoint'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.sourceSha === expectedSha', 'public verifier must require exact source SHA'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.environment === expectedEnvironment', 'public verifier must require exact environment'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.projectId === projectId', 'public verifier must require exact project'],
  ['scripts/verify-custom-domains.mjs', 'result.ok && result.hasAppShell && result.identityMatches', 'public verifier must combine app-shell and runtime identity'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'buildImageDigest', 'validator must bind build and revision digests'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'secretVersions', 'validator must require numeric secret versions'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'must not use latest', 'validator must reject latest aliases'],
  ['scripts/validate-worker-deploy-receipt.mjs', 'configFingerprint does not match the canonical configuration', 'validator must recompute configuration'],
  ['scripts/verify-deploy-authority.sh', 'git status --porcelain --untracked-files=all', 'authority must require clean source'],
  ['scripts/verify-deploy-authority.sh', 'git merge-base --is-ancestor', 'rollback must be ancestor'],
  ['scripts/ensure-gcs-bucket.sh', 'GCS_BUCKET_CREATION_APPROVAL', 'bucket creation must need separate approval'],
]) requireText(path, text, description);

const canonicalWorkflow = '.github/workflows/urai-jobs-production-deploy.yml';
const workflow = read(canonicalWorkflow);
const preflight = jobSection(workflow, 'preflight');
const deploy = jobSection(workflow, 'deploy');
const publicVerify = jobSection(workflow, 'public-verify');
if (!preflight) failures.push('missing credential-free preflight job');
if (!deploy) failures.push('missing protected mutation job');
if (!publicVerify) failures.push('missing public verification job');

for (const [text, description] of [
  ['target_secret_versions_json:', 'workflow must require exact target secret versions'],
  ['name: Verify and build exact candidate without cloud authority', 'preflight must build without cloud authority'],
  ['Create source-bound Firebase prebuilt manifest', 'preflight must attest Firebase bytes'],
  ['Upload exact Firebase prebuilt artifact', 'preflight must upload exact Firebase artifact'],
  ['name: Protected worker and Firebase mutation', 'workflow must isolate mutation'],
  ['name: Public verification without cloud identity', 'workflow must isolate public checks'],
  ['needs: preflight', 'mutation must depend on preflight'],
  ['needs: deploy', 'public verification must depend on mutation'],
  ['environment: ${{ inputs.target }}', 'mutation must use protected environment'],
  ['actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683', 'checkout must be immutable'],
  ['actions/setup-node@1e60f620b9541d80c77f7b4a3bcd8bf5e940c37', 'Node setup must be immutable'],
  ['actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', 'artifact upload must be immutable'],
  ['actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093', 'artifact download must be immutable'],
  ['google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed', 'Google auth must be immutable'],
  ['google-github-actions/setup-gcloud@e427ad8a34f8676edf47cf7d7925499adf3eb74f', 'gcloud setup must be immutable'],
  ['FIREBASE_CLI_VERSION: ${{ vars.FIREBASE_CLI_VERSION }}', 'Firebase CLI must use exact protected version'],
  ['GCLOUD_CLI_VERSION: ${{ vars.GCLOUD_CLI_VERSION }}', 'gcloud must use exact protected version'],
  ['Download exact Firebase prebuilt artifact outside repository', 'mutation must download artifact outside checkout'],
  ['Verify external Firebase artifact before cloud authentication', 'artifact must verify before authentication'],
  ['Install exact Firebase CLI outside repository before cloud authentication', 'CLI install must stay outside checkout and before auth'],
  ['Prove exact clean mutation source and authority', 'worker authority must be clean and exact'],
  ['Authenticate to Google Cloud with workload identity', 'workflow must use OIDC'],
  ['Deploy canonical worker fleet with approved target secret versions', 'worker mutation must use approved secrets'],
  ['Export canonical URLs from immutable worker receipt', 'URL handoff must use receipt'],
  ['Materialize verified Firebase bytes after worker mutation', 'Firebase artifact materialization must follow clean worker mutation'],
  ["URAI_FIREBASE_PREBUILT_VERIFIED: '1'", 'Firebase deploy must require verified prebuilt bytes'],
  ['Destroy cloud credentials before evidence handoff', 'credentials must be destroyed'],
  ['Upload mutation evidence after credential cleanup', 'mutation evidence must follow cleanup'],
  ['Bind public verification to mutation receipts', 'public checks must bind mutation receipts'],
  ['id: worker_health', 'worker outcome must be captured'],
  ['id: domain_verify', 'domain outcome must be captured'],
  ['publicWorkerHealthChecked: workerPassed', 'worker receipt field must derive from outcome'],
  ['publicHostingChecked: domainsPassed', 'public receipt field must derive from outcome'],
  ['publicVerificationCompleted: workerPassed && domainsPassed', 'public receipt must not self-certify'],
  ['node scripts/stamp-deployment-artifact.mjs', 'public stamp must not require installed dependencies'],
  ['paidProviderSmokeAuthorized: false', 'canonical mutation must prohibit paid smoke'],
  ['paidProviderCalls: 0', 'receipts must record zero paid calls'],
]) requireText(canonicalWorkflow, text, description);

for (const [text, description] of [
  ['paid_provider_smoke_authorization:', 'workflow must not expose paid-smoke input'],
  ['PAID-PROVIDER-SMOKE', 'workflow must not contain paid authorization token'],
  ['actions/checkout@v4', 'checkout tag must not be mutable'],
  ['actions/setup-node@v4', 'setup-node tag must not be mutable'],
  ['actions/upload-artifact@v4', 'upload tag must not be mutable'],
  ['actions/download-artifact@v4', 'download tag must not be mutable'],
  ['google-github-actions/auth@v2', 'auth tag must not be mutable'],
  ['google-github-actions/setup-gcloud@v2', 'gcloud tag must not be mutable'],
  ['pnpm/action-setup@', 'pnpm action must not expand authority'],
  ['actions/setup-java@', 'unused Java action must not expand authority'],
  ['publicWorkerHealthChecked: true', 'public worker result must not be hard-coded'],
  ['publicHostingChecked: true', 'public domain result must not be hard-coded'],
]) rejectText(canonicalWorkflow, text, description);

requireOrder(canonicalWorkflow, [
  'Create source-bound Firebase prebuilt manifest',
  'Upload exact Firebase prebuilt artifact',
  'Prove exact clean mutation source and authority',
  'Download exact Firebase prebuilt artifact outside repository',
  'Verify external Firebase artifact before cloud authentication',
  'Install exact Firebase CLI outside repository before cloud authentication',
  'Authenticate to Google Cloud with workload identity',
  'Deploy canonical worker fleet with approved target secret versions',
  'Materialize verified Firebase bytes after worker mutation',
  'Deploy verified prebuilt Firebase runtime',
  'Destroy cloud credentials before evidence handoff',
  'Upload mutation evidence after credential cleanup',
  'Public verification without cloud identity',
], 'workflow must preserve preflight artifact, clean worker authority, protected mutation, cleanup, and public verification order');

const authIndex = deploy.indexOf('Authenticate to Google Cloud with workload identity');
if (authIndex < 0) failures.push('deploy authentication boundary is missing');
else if (deploy.slice(0, authIndex).includes('secrets.')) failures.push('deploy job exposes secrets before authentication boundary');
for (const forbidden of ['pnpm install', 'pnpm build', 'pnpm test', 'pnpm prod:precheck', 'pnpm --filter']) {
  if (deploy.includes(forbidden)) failures.push(`protected mutation job contains forbidden repository dependency/build command: ${forbidden}`);
}
if (/\n    environment:/.test(publicVerify) || publicVerify.includes('secrets.') || publicVerify.includes('id-token: write')) {
  failures.push('public verification must not receive protected environment, secrets, or OIDC permission');
}
for (const forbidden of ['gcloud ', 'firebase deploy', 'google-github-actions/auth@', 'google-github-actions/setup-gcloud@']) {
  if (publicVerify.includes(forbidden)) failures.push(`public verification contains forbidden cloud authority: ${forbidden}`);
}
if (deploy.includes('prod:verify-workers') || deploy.includes('domains:verify') || deploy.includes('stamp-deployment-artifact')) {
  failures.push('protected mutation job must not run public verification or stamp scripts');
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

console.log('[PASS] credential-free preflight builds and attests exact Firebase bytes');
console.log('[PASS] protected worker mutation starts from clean exact source without dependency builds');
console.log('[PASS] target and rollback secret versions are numeric, approval-bound and receipt-verified');
console.log('[PASS] Firebase artifact verifies externally and after materialization');
console.log('[PASS] Firebase deploy cleans temporary source changes and leaves only release evidence');
console.log('[PASS] Firebase mutation receipt remains non-certifying until public exact-runtime verification');
console.log('[PASS] cloud credentials are destroyed before evidence handoff');
console.log('[PASS] public verification requires exact Firebase SHA, environment, project and app shell');
console.log('[PASS] canonical deployment can execute zero paid provider calls');
