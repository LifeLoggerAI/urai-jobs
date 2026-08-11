import {readFileSync} from 'node:fs';

const workflowPaths = [
  '.github/workflows/firebase-deploy.yml',
  '.github/workflows/urai-jobs-production-deploy.yml',
  '.github/workflows/post-deploy-verify.yml',
  '.github/workflows/career-production-release.yml',
  '.github/workflows/production-deploy-publish.yml'
];

const forbiddenPatterns = [
  ['credentials_json', /credentials_json\s*:/],
  ['Firebase CLI token deploy auth', /\$\{\{\s*secrets\.FIREBASE_TOKEN\s*\}\}|--token(?:\s|=)|^\s*FIREBASE_TOKEN\s*:/m],
  ['legacy GCP service-account JSON secret', /\$\{\{\s*secrets\.GCP_SERVICE_ACCOUNT_JSON\s*\}\}/],
  ['legacy Firebase service-account JSON secret', /\$\{\{\s*secrets\.FIREBASE_SERVICE_ACCOUNT_URAI_JOBS\s*\}\}/],
  ['generic GCP key secret', /\$\{\{\s*secrets\.GCP_SA_KEY\s*\}\}/]
];

const requiredPatterns = [
  ['OIDC permission', /id-token:\s*write/],
  ['WIF provider', /GCP_WIF_PROVIDER/],
  ['deploy service account', /GCP_DEPLOY_SERVICE_ACCOUNT/],
  ['workload identity provider input', /workload_identity_provider:/],
  ['service account input', /service_account:/]
];

let failed = 0;
function fail(message) {
  failed += 1;
  console.error(`[FAIL] ${message}`);
}

for (const path of workflowPaths) {
  const source = readFileSync(path, 'utf8');
  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) fail(`${path} contains forbidden ${label}`);
  }
  for (const [label, pattern] of requiredPatterns) {
    if (!pattern.test(source)) fail(`${path} is missing ${label}`);
  }
}

const bootstrap = readFileSync('scripts/bootstrap-github-actions-deploy-secret.sh', 'utf8');
for (const [label, pattern] of [
  ['service-account key creation', /iam service-accounts keys create/],
  ['GitHub secret upload', /secret set/],
  ['legacy JSON secret name', /GCP_SERVICE_ACCOUNT_JSON/]
]) {
  if (pattern.test(bootstrap)) fail(`bootstrap script contains forbidden ${label}`);
}
for (const required of ['variable set GCP_WIF_PROVIDER', 'variable set GCP_DEPLOY_SERVICE_ACCOUNT']) {
  if (!bootstrap.includes(required)) fail(`bootstrap script is missing ${required}`);
}

const preflight = readFileSync('scripts/career-prod-preflight.mjs', 'utf8');
if (!preflight.includes('raw service-account JSON is prohibited')) {
  fail('career production preflight does not fail closed on raw service-account JSON');
}

if (failed) {
  throw new Error(`WIF_DEPLOY_AUTH_CONTRACT ${failed} checks failed`);
}

console.log('[PASS] WIF_DEPLOY_AUTH_CONTRACT');
