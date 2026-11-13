'use strict';

/**
 * R1238: merged Studio -> Jobs review-tree Life Movie producer/consumer contract.
 *
 * REVIEW ONLY. This is not a dispatch authorization, production IAM test,
 * signed consent check, or a reason to enable private Storage writes.
 *
 * Requires an explicitly pinned, separately checked-out Studio repository.
 * Fails closed on missing source pins. Never fetches network sources itself.
 *
 * Example (after frozen Jobs dependency installation):
 *   URAI_STUDIO_ROOT=/workspace/urai-studio \
 *   URAI_EXPECTED_JOBS_SHA=<40-character-exact-reviewed-head> \
 *   node --test scripts/review-only/r1098-studio-jobs-exact-contract.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const STUDIO_SHA = '97a7aaf2a87697e25cbf98373259025402564d3e';
const STUDIO_BRIDGE_BLOB = '9427263442d93c916516a76ae7b953585792be1a';
const JOBS_CONSUMER_BLOB = '5f944e906de7243d7415ac479cf92356b09c84c9';
const jobsRoot = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const configuredStudioRoot = process.env.URAI_STUDIO_ROOT;
const expectedJobsSha = process.env.URAI_EXPECTED_JOBS_SHA;
assert.ok(configuredStudioRoot && path.isAbsolute(configuredStudioRoot),
  'URAI_STUDIO_ROOT must identify an existing absolute checkout path');
assert.match(expectedJobsSha || '', /^[0-9a-f]{40}$/,
  'URAI_EXPECTED_JOBS_SHA must be the immutable reviewed Jobs commit');
const studioRoot = fs.realpathSync(configuredStudioRoot);

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 }).trim();
}
assert.equal(git(['rev-parse', 'HEAD'], studioRoot), STUDIO_SHA,
  'Studio source drift: expected the independently reviewed #202 exact head');
assert.equal(git(['rev-parse', 'HEAD'], jobsRoot), expectedJobsSha,
  'Jobs source drift: rerun checks after every reviewed head change');

const studioFile = 'apps/studio/lib/studio-life-movie-jobs-bridge.ts';
const jobsFile = 'functions/src/jobs/studioLifeMovieContract.ts';
assert.equal(git(['hash-object', studioFile], studioRoot), STUDIO_BRIDGE_BLOB,
  'Studio producer bytes changed');
assert.equal(git(['hash-object', jobsFile], jobsRoot), JOBS_CONSUMER_BLOB,
  'Jobs consumer bytes changed');

const jobsRequire = createRequire(path.join(jobsRoot, 'functions', 'package.json'));
const ts = jobsRequire('typescript');

function loadReviewedModule(absolutePath) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: jobsRequire, Buffer,
  }, { filename: absolutePath, timeout: 15000 });
  return module.exports;
}
const studio = loadReviewedModule(path.join(studioRoot, studioFile));
const jobs = loadReviewedModule(path.join(jobsRoot, jobsFile));

function fixture() {
  return {
    tenantId: 'tenant1', projectId: 'project1',
    sceneTruthReceiptRef: 'str_' + 'A'.repeat(16) + '_' +
      'a'.repeat(8) + '_' + 'B'.repeat(40),
    sceneTruthDigest: 'b'.repeat(64),
    sources: [{
      id: 'source01', bucket: 'urai-media-test',
      objectPath: 'tenants/tenant1/raw/source01.mp4',
      generation: '17', mimeType: 'video/mp4',
      provenance: 'original-source', sourceRefs: ['proof-001'],
      consentRef: 'consent-001', ownerOrRightsRef: 'rights-001',
    }],
    timeline: [{ sourceId: 'source01', startMs: 0, endMs: 1000 }],
  };
}
const envelope = (input = fixture()) => studio.buildJobsLifeMovieEnvelope(input);
function request() {
  const value = envelope();
  return {
    tenantId: 'tenant1', userId: 'user1', action: 'create',
    idempotencyKey: value.idempotencyKey,
    consent: {
      purpose: 'life-movie.render', policyVersion: '1.1.0',
      decisionReceiptId: 'c'.repeat(64),
    },
    payload: value.payload,
  };
}

test('valid Studio output passes Jobs schema, canonical digest, and tenant scope', () => {
  const value = envelope();
  const parsed = jobs.StudioLifeMovieCreateRequestSchema.safeParse(request());
  assert.equal(parsed.success, true,
    parsed.success ? '' : JSON.stringify(parsed.error.issues));
  assert.equal(
    jobs.assertStudioLifeMovieRenderPlanDigest(parsed.data.payload).renderPlanDigest,
    value.payload.renderPlanDigest,
  );
  assert.equal(
    jobs.assertLifeMovieTenantPaths(parsed.data.payload, 'tenant1').projectId,
    'project1',
  );
  assert.match(
    jobs.deriveStudioLifeMovieRenderScope(parsed.data.payload).sourceSetDigest,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(value.dispatchAuthorized, false);
  assert.equal(value.publicReleaseAuthorized, false);
  assert.equal(value.providerGenerationAuthorized, false);
});

for (const field of ['sceneTruthReceiptRef', 'sceneTruthDigest']) {
  test(field + ': JSON array coercion denied at both boundaries', () => {
    const input = fixture();
    input[field] = [input[field]];
    assert.throws(() => envelope(input), /life_movie_invalid_scene_truth/);
    const consumerRequest = request();
    consumerRequest.payload[field] = [consumerRequest.payload[field]];
    assert.equal(
      jobs.StudioLifeMovieCreateRequestSchema.safeParse(consumerRequest).success,
      false,
    );
  });

  test(field + ': object coercion denied without side effects', () => {
    const input = fixture();
    const original = input[field];
    let calls = 0;
    input[field] = { toString() { calls += 1; return original; } };
    assert.throws(() => envelope(input), /life_movie_invalid_scene_truth/);
    assert.equal(calls, 0);
  });
}

test('cross-tenant source path denied on producer and consumer', () => {
  const input = fixture();
  input.sources[0].objectPath = 'tenants/tenant2/raw/a.mp4';
  assert.throws(() => envelope(input), /life_movie_source_outside_tenant/);
  const consumerRequest = request();
  consumerRequest.payload.sources[0].objectPath = input.sources[0].objectPath;
  assert.throws(
    () => jobs.assertLifeMovieTenantPaths(consumerRequest.payload, 'tenant1'),
    /life_movie_source_outside_tenant/,
  );
});

test('unsafe object generation denied by Studio and Jobs', () => {
  const input = fixture();
  input.sources[0].generation = '9007199254740993';
  assert.throws(() => envelope(input), /life_movie_invalid_source_generation/);
  const consumerRequest = request();
  consumerRequest.payload.sources[0].generation = input.sources[0].generation;
  assert.equal(
    jobs.StudioLifeMovieCreateRequestSchema.safeParse(consumerRequest).success,
    false,
  );
});

test('render plan digest tampering denied by Jobs', () => {
  const consumerRequest = request();
  consumerRequest.payload.subtitleText = 'tampered';
  assert.throws(
    () => jobs.assertStudioLifeMovieRenderPlanDigest(consumerRequest.payload),
    /life_movie_render_plan_digest_mismatch/,
  );
});

test('surplus public media URL denied at both service boundaries', () => {
  const input = fixture();
  input.sources[0].publicUrl = 'https://example.invalid/a';
  assert.throws(() => envelope(input), /life_movie_invalid_source_shape/);
  const consumerRequest = request();
  consumerRequest.payload.sources[0].publicUrl = 'https://example.invalid/a';
  assert.equal(
    jobs.StudioLifeMovieCreateRequestSchema.safeParse(consumerRequest).success,
    false,
  );
});

test('provider and public release authority cannot be elevated', () => {
  assert.equal(envelope().dispatchAuthorized, false);
  for (const field of ['providerGenerationAuthorized', 'publicReleaseAuthorized']) {
    const consumerRequest = request();
    consumerRequest.payload[field] = true;
    assert.equal(
      jobs.StudioLifeMovieCreateRequestSchema.safeParse(consumerRequest).success,
      false,
    );
  }
});

test('cross-tenant output prefix denied despite valid structural schema', () => {
  const consumerRequest = request();
  consumerRequest.payload.outputPrefix = 'tenants/tenant2/life-movies/project1/';
  assert.equal(
    jobs.StudioLifeMovieCreateRequestSchema.safeParse(consumerRequest).success,
    true,
  );
  assert.throws(
    () => jobs.assertLifeMovieTenantPaths(consumerRequest.payload, 'tenant1'),
    /life_movie_output_outside_tenant_project/,
  );
});

test('duplicate source identifiers cannot be emitted', () => {
  const input = fixture();
  input.sources.push({ ...input.sources[0] });
  assert.throws(() => envelope(input), /life_movie_invalid_source_id/);
});
