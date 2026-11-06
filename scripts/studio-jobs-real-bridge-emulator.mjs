// R815 review-only: actual committed Studio transport/JSON reader + real Jobs
// Firebase Functions HTTP emulator. Synthetic data. No positive consent grant.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, resolve } from 'node:path';

const PROJECT = 'demo-urai-jobs';
const STUDIO_SHA = '153d6c35557c66a8b9f8629778ca796b83730464';
const STUDIO_BLOBS = Object.freeze({
  'apps/studio/lib/studio-life-movie-jobs-client.ts': '0ca262e114b0439426d75cf7ac510e289ba315eb',
  'apps/studio/lib/studio-life-movie-longform-contract.ts': 'b61484f218a46b56fbe479dadec73595b8599b3f',
  'apps/studio/lib/studio-life-movie-jobs-bridge.ts': 'afca955d63a6ce928d2a6b6aa456b508a6134893',
});
const DANGEROUS = [
  'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN',
  'GH_TOKEN', 'RUNPOD_API_KEY', 'GOOGLE_CLOUD_ACCESS_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN',
];

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}
function log(message) { console.log('[R815] ' + message); }
function pass(name) { console.log('[PASS] ' + name); }
function hold(message) { throw new Error('R815_HOLD_' + message); }

const sourceDir = process.env.URAI_STUDIO_SOURCE_DIR;
if (!sourceDir || !isAbsolute(sourceDir)) hold('studio_checkout_absolute_path_required');
if (process.env.GCLOUD_PROJECT !== PROJECT || process.env.GOOGLE_CLOUD_PROJECT !== PROJECT)
  hold('non_demo_project');
for (const key of DANGEROUS) if (process.env[key]) hold('cloud_credential_present_' + key);
for (const [key, port] of [
  ['FIREBASE_AUTH_EMULATOR_HOST', '9099'],
  ['FIRESTORE_EMULATOR_HOST', '8080'],
  ['FIREBASE_STORAGE_EMULATOR_HOST', '9199'],
  ['FUNCTIONS_EMULATOR_HOST', '5001'],
]) {
  const raw = String(process.env[key] || '');
  if (raw !== '127.0.0.1:' + port && raw !== 'http://127.0.0.1:' + port)
    hold('missing_or_nonlocal_emulator_' + key);
}
const jobsSha = git(process.cwd(), 'rev-parse', 'HEAD');
if (!/^[0-9a-f]{40}$/.test(jobsSha) || jobsSha !== process.env.URAI_ACCEPTANCE_SHA)
  hold('jobs_source_pin_mismatch');
if (git(process.cwd(), 'status', '--porcelain', '--untracked-files=all'))
  hold('jobs_source_dirty');
const actualStudio = git(sourceDir, 'rev-parse', 'HEAD');
if (actualStudio !== STUDIO_SHA || (process.env.URAI_EXPECTED_STUDIO_SHA || '') !== STUDIO_SHA)
  hold('studio_source_pin_mismatch');
if (git(sourceDir, 'status', '--porcelain', '--untracked-files=all'))
  hold('studio_source_dirty');
for (const [relative, hash] of Object.entries(STUDIO_BLOBS)) {
  const actual = execFileSync('git', ['hash-object', join(sourceDir, relative)], { encoding: 'utf8' }).trim();
  assert.equal(actual, hash, 'Studio source blob drift: ' + relative);
}
log('Exact Jobs ' + jobsSha + ', Studio ' + STUDIO_SHA);
pass('R815_TWO_REPOSITORY_SOURCE_AND_BLOB_PINS');

const jobsRequire = createRequire(resolve('functions/package.json'));
const ts = jobsRequire('typescript');
function loadStudio(relative, replacements = {}) {
  const source = readFileSync(join(sourceDir, relative), 'utf8');
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: relative,
  });
  const errors = (emitted.diagnostics || []).filter((entry) => entry.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, 'Studio source transpile error: ' + relative);
  const module = { exports: {} };
  // The sole non-production substitution is the Next.js server-only marker:
  // Node's isolated emulator harness is not a Next.js runtime. No Studio
  // functions, response reader, or Jobs HTTP behavior are replaced.
  const checkedRequire = (name) => {
    if (name === 'server-only') return {};
    if (Object.prototype.hasOwnProperty.call(replacements, name)) return replacements[name];
    if (name === 'node:crypto') return jobsRequire(name);
    throw new Error('unexpected_studio_import_' + name);
  };
  const evaluate = new Function('module', 'exports', 'require', emitted.outputText);
  evaluate(module, module.exports, checkedRequire);
  return module.exports;
}
const contract = loadStudio('apps/studio/lib/studio-life-movie-longform-contract.ts');
const bridge = loadStudio('apps/studio/lib/studio-life-movie-jobs-bridge.ts');
const client = loadStudio('apps/studio/lib/studio-life-movie-jobs-client.ts', {
  './studio-life-movie-longform-contract': contract,
});
assert.equal(typeof contract.readStudioLongformJson, 'function');
assert.equal(typeof bridge.buildJobsLifeMovieEnvelope, 'function');
assert.equal(typeof client.callStudioJobsBridge, 'function');
pass('STUDIO_UNMODIFIED_SOURCE_TRANSPILATION_AND_REAL_RESPONSE_READER');

const baseFetch = globalThis.fetch.bind(globalThis);
const endpoint = 'http://127.0.0.1:5001/' + PROJECT + '/us-central1/studioLifeMovieBridge';
let clientRequests = 0;
globalThis.fetch = (...args) => {
  if (String(args[0]).startsWith(endpoint)) clientRequests++;
  return baseFetch(...args);
};
const token = 'r815-synthetic-bridge-token-no-prod';
process.env.NODE_ENV = 'test';
process.env.URAI_JOBS_BRIDGE_URL = endpoint;
process.env.URAI_STUDIO_JOBS_DISPATCH_ENABLED = 'true';
process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN = token;
const source = {
  id: 'synthetic-source',
  bucket: 'synthetic-fixture-bucket',
  objectPath: 'tenants/synthetic-tenant/source.jpg',
  generation: '1',
  mimeType: 'image/jpeg',
  provenance: 'original-source',
  sourceRefs: ['synthetic-receipt'],
  consentRef: 'synthetic-consent',
  ownerOrRightsRef: 'synthetic-rights',
};
const envelope = bridge.buildJobsLifeMovieEnvelope({
  tenantId: 'synthetic-tenant',
  projectId: 'synthetic-project',
  sceneTruthReceiptRef: 'str_fixturefixture1234_zzzzzzzz_' + 'A'.repeat(40),
  sceneTruthDigest: 'b'.repeat(64),
  sources: [source],
  timeline: [{ sourceId: source.id, startMs: 0, endMs: 1000 }],
  width: 640,
  height: 480,
  fps: 24,
});
const consent = () => ({
  purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'a'.repeat(64),
});
const create = () => ({
  action: 'create',
  tenantId: 'synthetic-tenant',
  userId: 'synthetic-owner',
  idempotencyKey: envelope.idempotencyKey,
  payload: envelope.payload,
  consent: consent(),
});
const raw = (method, bearer, payload) => baseFetch(endpoint, {
  method,
  headers: {
    'content-type': 'application/json',
    ...(bearer ? { authorization: 'Bearer ' + bearer } : {}),
  },
  ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
});
const waitForReady = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await raw('GET');
      if (response.status === 405) return;
    } catch { /* Functions emulator starts lazily; never contact a remote host. */ }
    await new Promise((done) => setTimeout(done, 350));
  }
  hold('real_jobs_functions_emulator_not_ready');
};
await waitForReady();
pass('REAL_JOBS_FUNCTIONS_HTTP_LISTENER_METHOD_405');

const admin = jobsRequire('firebase-admin/app');
const adminFs = jobsRequire('firebase-admin/firestore');
if (admin.getApps().length === 0) admin.initializeApp({ projectId: PROJECT });
const db = adminFs.getFirestore();
const collections = ['jobs', 'jobQueueEntries', 'studioLifeMovieBridgeBindings', 'studioSceneTruthReceiptBindings'];
async function counts() {
  const values = [];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    values.push(snapshot.size);
  }
  return values;
}
const before = await counts();

let response = await raw('POST', undefined, create());
assert.equal(response.status, 401);
assert.equal((await response.json()).error, 'unauthorized');
response = await raw('POST', 'wrong-synthetic-token', create());
assert.equal(response.status, 401);
pass('REAL_JOBS_HTTP_REJECTS_MISSING_AND_INVALID_BEARER');

response = await raw('POST', token, { ...create(), consent: { ...consent(), policyVersion: 'wrong' } });
assert.equal(response.status, 400);
assert.equal((await response.json()).error, 'invalid_bridge_request');
pass('REAL_JOBS_HTTP_REJECTS_MALFORMED_CREATE_REQUEST');

let previousRequests = clientRequests;
process.env.URAI_STUDIO_JOBS_DISPATCH_ENABLED = 'false';
try {
  await assert.rejects(client.callStudioJobsBridge(create()), /dispatch_disabled/);
  assert.equal(clientRequests, previousRequests);
} finally { process.env.URAI_STUDIO_JOBS_DISPATCH_ENABLED = 'true'; }
process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN = '';
try {
  await assert.rejects(client.callStudioJobsBridge(create()), /bridge_token_missing/);
  assert.equal(clientRequests, previousRequests);
} finally { process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN = token; }
pass('REAL_STUDIO_CLIENT_HARD_OFF_BEFORE_HTTP_TRANSMISSION');

const malformed = create();
malformed.consent.decisionReceiptId = 'forged';
await assert.rejects(client.callStudioJobsBridge(malformed), /life_movie_invalid_render_consent/);
const accessor = create();
let getterCalled = false;
Object.defineProperty(accessor.consent, 'purpose', {
  enumerable: true, get() { getterCalled = true; return 'life-movie.render'; },
});
await assert.rejects(client.callStudioJobsBridge(accessor), /life_movie_invalid_render_consent/);
assert.equal(getterCalled, false);
assert.equal(clientRequests, previousRequests);
pass('REAL_STUDIO_CONSENT_FORGERY_AND_ACCESSOR_DENIED_BEFORE_WIRE');

await assert.rejects(
  client.callStudioJobsBridge(create()),
  /life_movie_consent_authority_unavailable/,
);
assert.equal(clientRequests, previousRequests + 1);
const rawValid = await raw('POST', token, create());
assert.equal(rawValid.status, 503);
assert.equal((await rawValid.json()).error, 'life_movie_consent_authority_unavailable');
pass('REAL_STUDIO_TO_JOBS_AUTHENTICATED_HTTP_REACHES_CONSENT_GATE_503');

for (const action of ['playback', 'download']) {
  await assert.rejects(client.callStudioJobsBridge({
    action, tenantId: 'synthetic-tenant', userId: 'synthetic-owner', jobId: 'syntheticjobid1234567890',
  }), /life_movie_authenticated_delivery_required/);
}
pass('REAL_JOBS_LEGACY_PLAYBACK_AND_DOWNLOAD_FAIL_CLOSED');

await assert.rejects(client.callStudioJobsBridge({
  action: 'status', tenantId: 'synthetic-tenant', userId: 'synthetic-owner',
  jobId: 'syntheticjobid1234567890',
}), /job_not_found/);
pass('REAL_JOBS_OWNER_SCOPED_STATUS_DOES_NOT_INVENT_JOB');

const after = await counts();
assert.deepEqual(after, before, 'Unauthenticated or consent-denied requests must not persist Jobs state');
pass('FOUR_REAL_FIREBASE_EMULATOR_COLLECTIONS_NO_UNAUTHORIZED_ADMISSIONS');
console.log('URAI_STUDIO_JOBS_REAL_BRIDGE_FAIL_CLOSED_PASS jobs=' + jobsSha +
  ' studio=' + STUDIO_SHA + ' checks=10 positiveConsent=false movieRendered=false');
