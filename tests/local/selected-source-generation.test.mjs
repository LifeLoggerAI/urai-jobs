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
