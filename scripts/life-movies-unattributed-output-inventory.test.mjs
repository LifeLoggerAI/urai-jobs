/**
 * Review-only source-backed regression for the original private derivative
 * revocation inventory helper. NO Firebase emulator, cloud credentials, user
 * media, IAM or rendering. Its result cannot certify eventual/lifetime
 * absence, authenticated private delivery or production deletion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = requireFunctions('typescript');
const original = readFileSync(
  new URL('../functions/src/privacy/lifeMovieDerivativeRevocation.ts', import.meta.url),
  'utf8',
);
function extract(pattern, label) {
  const match = original.match(pattern);
  assert.ok(match && match[0], 'Missing exact original-source declaration: ' + label);
  return match[0];
}
const safeSegment = extract(/^const SAFE_SEGMENT = .*;$/m, 'SAFE_SEGMENT');
const concurrency = extract(/^const FIRESTORE_CONCURRENCY = .*;$/m, 'FIRESTORE_CONCURRENCY');
const batches = extract(/async function mapInBatches<[\s\S]*?\n\}/, 'mapInBatches');
const inventory = extract(/async function assertNoUnattributedLifeMovieOutputs\([\s\S]*?\n\}/,
  'assertNoUnattributedLifeMovieOutputs');

const code = ts.transpileModule(
  [safeSegment, concurrency, batches, inventory,
    'exports.inventory = assertNoUnattributedLifeMovieOutputs;'].join('\n'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true },
);
assert.equal((code.diagnostics || []).filter(d =>
  d.category === ts.DiagnosticCategory.Error).length, 0,
'Original-source inventory must transpile without diagnostics');

let calls = [];
let response = [[]];
let requestError = null;
const storage = () => ({
  bucket: bucket => ({
    async getFiles(options) {
      calls.push({ bucket, ...options });
      if (requestError) throw requestError;
      return response;
    },
  }),
});
const compiled = { exports: {} };
// Load extracted original TypeScript in the normal Node realm; inject only
// the read-only Cloud Storage query surface. No production modules are patched.
new Function('module', 'exports', 'getStorage', code.outputText)(
  compiled, compiled.exports, storage,
);
const assertNoUnattributed = compiled.exports.inventory;
assert.equal(typeof assertNoUnattributed, 'function');

const job = (tenantId = 'tenantA', projectId = 'projectA') => ({
  data: { tenantId, payload: { projectId } },
});
const run = (jobs = [job()], plans = [], buckets = new Set(['private-bucket'])) =>
  assertNoUnattributed(jobs, plans, buckets);

test('original-source bounded private output inventory: 15 adversarial cases', async () => {
  let passed = 0;
  const checked = () => { passed++; };
  const scoped = 'tenants/tenantA/life-movies/projectA/';

  await run();
  assert.deepEqual(calls, [{
    bucket: 'private-bucket', prefix: scoped, autoPaginate: false, maxResults: 1,
  }]);
  checked();

  calls = [];
  await run([], [], new Set());
  assert.equal(calls.length, 0);
  checked();

  response = [[{ name: 'must-never-be-logged' }]];
  await assert.rejects(run(), /life_movie_revocation_unattributed_output_unresolved/);
  checked();

  response = [null];
  await assert.rejects(run(), /life_movie_revocation_output_inventory_unverified/);
  checked();

  response = [[]];
  requestError = new Error('storage-unavailable');
  await assert.rejects(run(), /storage-unavailable/);
  requestError = null;
  checked();

  await assert.rejects(run([job()], [], new Set()),
    /life_movie_revocation_output_bucket_authority_unavailable/);
  checked();

  const tooManyBuckets = new Set(Array.from({ length: 9 }, (_, i) => 'bucket-' + i));
  await assert.rejects(run([job()], [], tooManyBuckets),
    /life_movie_revocation_output_bucket_authority_unavailable/);
  checked();

  await assert.rejects(run([job('bad/tenant', 'projectA')]),
    /life_movie_revocation_output_scope_unverified/);
  checked();

  await assert.rejects(run([job('tenantA', '../invalid')]),
    /life_movie_revocation_output_scope_unverified/);
  checked();

  const excessive = Array.from({ length: 65 }, (_, i) => job('tenantA', 'project-' + i));
  await assert.rejects(run(excessive),
    /life_movie_revocation_output_scope_limit_exceeded/);
  checked();

  calls = [];
  await run([job(), job()]);
  assert.equal(calls.length, 1, 'same project prefix must not be listed twice');
  checked();

  calls = [];
  await run([], [{ data: () => ({ tenantId: 'tenantB', projectId: 'planB' }) }]);
  assert.equal(calls[0].prefix, 'tenants/tenantB/life-movies/planB/');
  checked();

  await assert.rejects(run([], [{ data: () => null }]),
    /life_movie_revocation_output_scope_unverified/);
  checked();

  await assert.rejects(run([{
    data: { tenantId: 'tenantA', projectId: 'projectA', payload: {} },
  }]), /life_movie_revocation_output_scope_unverified/);
  checked();

  calls = [];
  await run([job()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].prefix, scoped);
  checked();

  assert.equal(passed, 15);
  console.log('R512_ORIGINAL_SOURCE_INVENTORY_ISOLATED_PASS checks=' + passed +
    ' source-backed=true cloudAccess=false productionAuthorized=false');
});
