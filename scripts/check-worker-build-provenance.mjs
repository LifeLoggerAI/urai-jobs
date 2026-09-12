import fs from 'node:fs';
import { runWorkerBuildProvenanceSelfTest } from './capture-worker-build-provenance.mjs';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');

function requireText(file, text, description) {
  if (!read(file).includes(text)) failures.push(`${description}: ${file} is missing ${JSON.stringify(text)}`);
}

function rejectText(file, text, description) {
  if (read(file).includes(text)) failures.push(`${description}: ${file} contains forbidden ${JSON.stringify(text)}`);
}

function requireOrder(file, markers, description) {
  const source = read(file);
  const indexes = markers.map((marker) => source.indexOf(marker));
  if (indexes.some((index) => index < 0) || indexes.some((index, position) => position > 0 && index <= indexes[position - 1])) {
    failures.push(`${description}: ${file} does not preserve ${markers.join(' -> ')}`);
  }
}

const wrapper = 'scripts/deploy-workers-approved.sh';
for (const [text, description] of [
  ['GITHUB_SHA is required for exact worker source provenance', 'wrapper must require exact source SHA'],
  ['GITHUB_RUN_ID is required for exact worker source provenance', 'wrapper must require workflow run identity'],
  ['WORKER_BUILD_SOURCE_ROOT', 'wrapper must isolate build archives outside the checkout'],
  ["schemaVersion: 'urai-jobs-worker-build-source-ledger-1'", 'wrapper must create a versioned source ledger'],
  ["schemaVersion: 'urai-jobs-worker-source-manifest-1'", 'wrapper must create versioned worker file manifests'],
  ['fs.lstatSync', 'wrapper must inspect source entry types'],
  ['contains a symlink', 'wrapper must reject symlinked build context entries'],
  ["tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner --format=ustar", 'wrapper must create deterministic source archives'],
  ['gzip -n', 'wrapper must remove gzip timestamp/name variability'],
  ['sourceManifestSha256', 'wrapper must hash the worker file manifest'],
  ['sourceArchiveSha256', 'wrapper must hash the submitted source archive'],
  ['if [ "${1:-}" = "builds" ] && [ "${2:-}" = "submit" ]', 'wrapper must intercept Cloud Build submission'],
  ['"$REAL_GCLOUD" builds submit "$archive_path"', 'wrapper must submit the deterministic archive'],
  ['node scripts/capture-worker-build-provenance.mjs', 'wrapper must capture permanent provider provenance'],
]) requireText(wrapper, text, description);

requireOrder(wrapper, [
  'Exact target Secret Manager versions approved before mutation',
  'bash scripts/deploy-workers.sh',
  'node scripts/capture-worker-build-provenance.mjs',
  'Deployed worker receipt secret versions equal the explicit target approval',
], 'wrapper must approve, deploy, capture provenance and then verify exact secrets');

rejectText(wrapper, 'tar -czf', 'wrapper must not create timestamp-bearing gzip archives');
rejectText(wrapper, 'eval ', 'wrapper must not evaluate generated shell text');

const provenance = 'scripts/capture-worker-build-provenance.mjs';
for (const [text, description] of [
  ["schemaVersion: 'urai-jobs-worker-build-provenance-1'", 'evidence must have a versioned schema'],
  ["schemaVersion !== 'urai-jobs-worker-build-source-ledger-1'", 'validator must require the source-ledger schema'],
  ['sourceProvenance?.resolvedStorageSource', 'validator must require permanent Cloud Build source identity'],
  ['resolvedStorageSource must contain bucket, object and numeric generation', 'resolved source identity must be complete'],
  ['sourceManifestSha256', 'evidence must bind the file manifest hash'],
  ['sourceArchiveSha256', 'evidence must bind the submitted archive hash'],
  ['build.status !== \'SUCCESS\'', 'evidence must reject incomplete or failed builds'],
  ['candidate?.name === service.imageTag && candidate?.digest === service.buildImageDigest', 'Cloud Build output must match exact image tag and digest'],
  ['service.buildImageDigest !== service.imageDigest', 'build output must equal deployed revision digest'],
  ["execFileSync(gcloud, ['builds', 'describe'", 'provider provenance must be read without a shell'],
  ['receiptSha256', 'provenance must bind the deployment receipt bytes'],
  ['runWorkerBuildProvenanceSelfTest', 'behavioral self-test must be exported'],
  ["expectRejected('missing resolved source'", 'self-test must reject missing provider source identity'],
  ["expectRejected('failed build'", 'self-test must reject failed builds'],
  ["expectRejected('digest mismatch'", 'self-test must reject digest drift'],
  ["expectRejected('archive hash drift'", 'self-test must reject archive identity drift'],
  ["expectRejected('stale source SHA'", 'self-test must reject stale source identity'],
]) requireText(provenance, text, description);

rejectText(provenance, 'shell: true', 'provider queries must not use a command shell');
rejectText(provenance, 'latest', 'provenance must not rely on a mutable provider alias');

try {
  runWorkerBuildProvenanceSelfTest();
} catch (error) {
  failures.push(`worker build provenance behavioral validation failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error('[FAIL] worker build provenance contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] deterministic worker archives bind exact source files and SHA');
console.log('[PASS] permanent Cloud Build source identity binds build ID, archive, image digest and deployed revision');
console.log('[PASS] worker build provenance remains shell-free, immutable and behaviorally tested');
