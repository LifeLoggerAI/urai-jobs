import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Readable, PassThrough } from 'node:stream';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const ts = require('typescript');
const contract = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: contract, require });
const longform = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../functions/src/jobs/studioLifeMovieLongformContract.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: longform,
  require(name) {
    if (name === './studioLifeMovieContract.js') return contract;
    return require(name);
  },
});

const source = {
  id: 'selected-source', bucket: 'synthetic-private-bucket', objectPath: 'tenants/synthetic/source.png',
  generation: '1793378565000001', mimeType: 'image/png', provenance: 'original-source',
  sourceRefs: ['synthetic-source'], consentRef: 'synthetic-reference-not-grant', ownerOrRightsRef: 'synthetic-rights',
};

function worker(storage) {
  const app = { use() {}, get() {}, post() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => () => {} });
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(new URL('../../workers/studio-worker/index.js', import.meta.url), 'utf8')
    + '\nmodule.exports = { sourceGeneration, openSelectedSource, lifeMovieConsentAuthorityAvailable };', {
    module, Buffer, console, process: { env: {} },
    require(name) {
      if (name === 'express') return express;
      if (name === 'firebase-admin') return { initializeApp() {}, storage: () => storage };
      if (name === './private-output-cleanup') return { cleanupPrivateOutputs: async () => { throw new Error('test_cleanup_not_available'); } };
      return require(name);
    },
  });
  return module.exports;
}

test('admission retains exact selected generation strings supported by the installed SDK', () => {
  assert.equal(contract.LifeMovieSourceSchema.parse(source).generation, source.generation);
  assert.equal(contract.LifeMovieSourceSchema.parse({ ...source, generation: '9007199254740991' }).generation, '9007199254740991');
});

test('admission and worker reject missing, rounded, ambiguous and out-of-range generations', () => {
  const parsed = worker({});
  for (const generation of [undefined, null, 10000000000000000, '', '0', '01', '-1', '1.0', '1e3', ' 1', '1 ', '9007199254740992', '10000000000000001', '18446744073709551616']) {
    assert.equal(contract.LifeMovieSourceSchema.safeParse({ ...source, generation }).success, false, String(generation));
    assert.throws(() => parsed.sourceGeneration(generation), /invalid_source_generation/);
  }
});

test('a path replacement cannot change which selected generation is streamed', async () => {
  const versions = new Map([[source.generation, 'selected bytes'], ['1793378565000002', 'replacement bytes']]);
  let observed;
  const parsed = worker({ bucket: bucket => ({ file: (objectPath, options) => ({
    createReadStream() {
      observed = { bucket, objectPath, options };
      return Readable.from([versions.get(options?.generation) ?? 'replacement bytes']);
    },
  }) }) });
  const chunks = [];
  for await (const chunk of parsed.openSelectedSource(source)) chunks.push(chunk);
  assert.equal(chunks.join(''), 'selected bytes');
  assert.deepEqual(JSON.parse(JSON.stringify(observed)), { bucket: source.bucket, objectPath: source.objectPath, options: { generation: source.generation } });
});

test('an unavailable selected generation propagates failure without reading latest', async () => {
  let reads = 0;
  const parsed = worker({ bucket: () => ({ file: (_path, options) => ({
    createReadStream() { reads++; assert.equal(options.generation, source.generation); return Readable.from((async function* () { throw Object.assign(new Error('selected generation missing'), { code: 404 }); })()); },
  }) }) });
  await assert.rejects(async () => { for await (const _chunk of parsed.openSelectedSource(source)) {} }, /selected generation missing/);
  assert.equal(reads, 1);
});

test('installed Storage SDK serializes the selected generation exactly without network access', async () => {
  const workerRequire = createRequire(new URL('../../workers/studio-worker/package.json', import.meta.url));
  const adminRequire = createRequire(workerRequire.resolve('firebase-admin'));
  const { Storage } = adminRequire('@google-cloud/storage');
  const storage = new Storage({ projectId: 'synthetic-selected-source' });
  let query;
  const parsed = worker({ bucket: name => ({ file: (objectPath, options) => {
    const file = storage.bucket(name).file(objectPath, options);
    file.requestStream = request => {
      query = request.qs;
      const stream = new PassThrough();
      queueMicrotask(() => stream.destroy(new Error('synthetic-no-network')));
      return stream;
    };
    return file;
  } }) });
  await assert.rejects(async () => { for await (const _chunk of parsed.openSelectedSource(source)) {} }, /synthetic-no-network/);
  assert.equal(query.alt, 'media');
  assert.equal(String(query.generation), source.generation);
});

test('preparing source contracts does not activate render authority', () => {
  assert.equal(worker({}).lifeMovieConsentAuthorityAvailable(), false);
});


test('Jobs independently checks the exact normalized Studio render-plan digest', () => {
  const plan = {
    schemaVersion: 'urai-life-movie-render-v1',
    projectId: 'synthetic-project',
    renderPlanDigest: '0'.repeat(64),
    sceneTruthReceiptRef: 'str_' + 'a'.repeat(24) + '_' + 'b'.repeat(8) + '_' + 'c'.repeat(43),
    sceneTruthDigest: 'd'.repeat(64),
    outputPrefix: 'tenants/synthetic/life-movies/synthetic-project/',
    width: 640, height: 480, fps: 30,
    sources: [source],
    timeline: [{ sourceId: source.id, startMs: 0, endMs: 1000 }],
    audioCues: [], subtitleText: '',
    spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
  };
  const sorted = (value) => Array.isArray(value) ? value.map(sorted)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]))
      : value;
  const { renderPlanDigest, schemaVersion, spatialRequired,
    publicReleaseAuthorized, providerGenerationAuthorized, ...renderPlan } = plan;
  const expected = require('node:crypto').createHash('sha256')
    .update(JSON.stringify(sorted(renderPlan))).digest('hex');
  assert.equal(contract.computeStudioLifeMovieRenderPlanDigest(plan), expected);
  assert.equal(contract.assertStudioLifeMovieRenderPlanDigest({ ...plan, renderPlanDigest: expected }).renderPlanDigest, expected);
  assert.throws(() => contract.assertStudioLifeMovieRenderPlanDigest(plan), /life_movie_render_plan_digest_mismatch/);
  for (const altered of [
    { ...plan, sources: [{ ...source, generation: '1793378565000002' }] },
    { ...plan, sources: [{ ...source, ownerOrRightsRef: 'other-rights' }] },
    { ...plan, subtitleText: 'other subtitle' },
    { ...plan, timeline: [{ sourceId: source.id, startMs: 0, endMs: 999 }] },
  ]) {
    assert.notEqual(contract.computeStudioLifeMovieRenderPlanDigest(altered), expected);
    assert.throws(() => contract.assertStudioLifeMovieRenderPlanDigest({ ...altered, renderPlanDigest: expected }), /life_movie_render_plan_digest_mismatch/);
  }
});


test('Jobs recomputes long-form digest and rejects source/rights/timeline tampering', () => {
  const plan = {
    schemaVersion: 'urai-life-movie-longform-v1',
    projectId: 'synthetic-project',
    renderPlanDigest: '0'.repeat(64),
    sceneTruthReceiptRef: 'str_' + 'a'.repeat(24) + '_' + 'b'.repeat(8) + '_' + 'c'.repeat(43),
    sceneTruthDigest: 'd'.repeat(64),
    outputPrefix: 'tenants/synthetic/life-movies/synthetic-project/',
    width: 640, height: 480, fps: 30,
    sources: [source],
    timeline: [{ sourceId: source.id, startMs: 0, endMs: 15000 }],
    audioCues: [], subtitleText: '',
    spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
  };
  const { schemaVersion, renderPlanDigest, spatialRequired,
    publicReleaseAuthorized, providerGenerationAuthorized, ...renderPlan } = plan;
  const expected = require('node:crypto').createHash('sha256')
    .update(contract.canonicalRenderPlanJson(renderPlan)).digest('hex');
  assert.equal(longform.computeStudioLifeMovieLongformPlanDigest(plan), expected);
  assert.equal(longform.assertStudioLifeMovieLongformPlanDigest({ ...plan, renderPlanDigest: expected }).renderPlanDigest, expected);
  assert.throws(() => longform.assertStudioLifeMovieLongformPlanDigest(plan), /life_movie_longform_render_plan_digest_mismatch/);
  for (const altered of [
    { ...plan, sources: [{ ...source, generation: '1793378565000002' }] },
    { ...plan, sources: [{ ...source, ownerOrRightsRef: 'other-rights' }] },
    { ...plan, timeline: [{ sourceId: source.id, startMs: 0, endMs: 14999 }] },
    { ...plan, subtitleText: 'changed subtitle' },
  ]) {
    assert.notEqual(longform.computeStudioLifeMovieLongformPlanDigest(altered), expected);
    assert.throws(() => longform.assertStudioLifeMovieLongformPlanDigest({ ...altered, renderPlanDigest: expected }), /life_movie_longform_render_plan_digest_mismatch/);
  }
});
