import fs from 'node:fs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const iam = read('scripts/verify-functions-runtime-firestore-iam.sh');
const bucket = read('scripts/ensure-gcs-bucket.sh');
const workflow = read('.github/workflows/urai-jobs-production-deploy.yml');

for (const token of [
  'URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT is required',
  'gcloud projects get-iam-policy',
  "entry?.role === 'roles/datastore.user'",
  '!entry.condition',
  'Functions runtime service account lacks an unconditional project-level roles/datastore.user grant',
]) {
  if (!iam.includes(token)) failures.push(`Functions runtime IAM verifier is missing ${JSON.stringify(token)}`);
}

const verifierCall = 'bash scripts/verify-functions-runtime-firestore-iam.sh';
const bucketRead = 'gcloud storage buckets describe';
if (!bucket.includes(verifierCall)) failures.push('Authenticated pre-mutation bucket step must invoke the Functions runtime IAM verifier.');
if (bucket.indexOf(verifierCall) < 0 || bucket.indexOf(bucketRead) < 0 || bucket.indexOf(verifierCall) > bucket.indexOf(bucketRead)) {
  failures.push('Functions runtime IAM verification must occur before bucket/provider mutation checks.');
}

for (const token of [
  'URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT: process.env.CONFIG_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT',
  'test -n "$URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT"',
  'bash scripts/ensure-gcs-bucket.sh',
]) {
  if (!workflow.includes(token)) failures.push(`Canonical production workflow is missing ${JSON.stringify(token)}`);
}

if (failures.length) {
  console.error('[FAIL] Functions runtime Firestore IAM contract');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[PASS] Functions runtime identity is source-bound to a fail-closed Firestore IAM preflight before deployment mutation.');
