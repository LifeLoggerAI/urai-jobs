import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../workers/private-life-model-index-provider/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(new URL('../workers/private-life-model-index-provider/src/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;

const request = {
  sourceHandle: 'psh_opaque_source_fixture_01',
  sourceEvidenceClass: 'ATTRIBUTED_TESTIMONY',
  transcriptRef: 'private:fixtures/transcript-01',
  provenanceRef: 'private:fixtures/provenance-01',
  requestedPurpose: 'memory-index',
  idempotencyKey: 'fixture-job-01',
};
const transcript = 'A fictional person remembers a fictional event.';
function extraction() {
  return {
    entities: [{ entityId: 'entity_1', type: 'person', label: 'Fictional fixture' }],
    claims: [{ claimId: 'claim_1', subject: 'entity_1', predicate: 'remembers', object: 'fictional event', evidenceClass: request.sourceEvidenceClass, confidence: 0.4, sourceSpan: { startChar: 0, endChar: transcript.length } }],
    relationships: [], temporalStates: [], places: [], conflicts: [], negativeConstraints: [],
    sceneTruth: { decision: 'READY', reasons: [] },
  };
}

function harness(options = {}) {
  const records = new Map();
  const stats = { extractorCalls: 0, resolverCalls: 0, logs: [] };
  let clock = 1_780_000_000_000;
  let serial = Promise.resolve();
  const ref = path => ({ path, collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
  const db = {
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    async runTransaction(callback) {
      const operation = serial.then(async () => {
        const writes = [];
        const result = await callback({
          async get(document) {
            assert.equal(writes.length, 0, 'Firestore transactions must read before writing');
            const data = records.get(document.path);
            return { exists: data !== undefined, data: () => data && structuredClone(data) };
          },
          create(document, value) { writes.push({ kind: 'create', document, value }); },
          set(document, value, settings) { writes.push({ kind: settings?.merge ? 'merge' : 'set', document, value }); },
          update(document, value) { writes.push({ kind: 'update', document, value }); },
        });
        for (const { kind, document } of writes) {
          if (kind === 'create') assert.equal(records.has(document.path), false, 'immutable record already exists');
          if (kind === 'update') assert.equal(records.has(document.path), true, 'updated record must exist');
        }
        for (const { kind, document, value } of writes) {
          records.set(document.path, structuredClone(kind === 'merge' || kind === 'update' ? { ...records.get(document.path), ...value } : value));
        }
        return result;
      });
      serial = operation.catch(() => {});
      return operation;
    },
  };
  const routes = new Map();
  const app = { use() {}, get() {}, post(path, ...handlers) { routes.set(path, handlers); }, listen(_port, _host, callback) { callback(); } };
  const express = () => app;
  express.json = () => () => {};
  class FixtureDate extends Date { static now() { return clock; } }
  const env = {
    URAI_ENV: 'test', PRIVATE_SOURCE_INDEX_TOKEN: 'fixture-index-token',
    PRIVATE_SOURCE_REF_RESOLVER_URL: 'https://resolver.example.invalid',
    PRIVATE_SOURCE_REF_RESOLVER_TOKEN: 'fixture-resolver-token',
    OPENAI_API_KEY: 'fixture-extractor-token', FIREBASE_PROJECT_ID: 'fixture-project',
    URAI_LIFE_MODEL_EXTRACTOR_MODEL: 'fixture-model',
    ...options.env,
  };
  const context = {
    exports: {}, Date: FixtureDate, process: { env }, AbortSignal, URL,
    console: { log(value) { stats.logs.push(String(value)); }, error(value) { stats.logs.push(String(value)); } },
    async fetch(url, init) {
      const body = JSON.parse(init.body);
      if (url.endsWith('/resolve-life-model-inputs')) {
        stats.resolverCalls++;
        const payload = {
          authorized: true, synthetic: false, sourceHandle: body.sourceHandle,
          transcriptRef: body.transcriptRef, provenanceRef: body.provenanceRef,
          sourceEvidenceClass: request.sourceEvidenceClass, transcriptText: transcript,
          sourceFixityRef: 'private:fixtures/fixity-01', sourceSha256: 'a'.repeat(64),
          ...options.resolver?.(stats.resolverCalls, body),
        };
        return { ok: true, status: 200, json: async () => payload };
      }
      assert.equal(url, 'https://api.openai.com/v1/chat/completions', 'only the injected extractor is allowed');
      const call = ++stats.extractorCalls;
      const value = options.extract ? await options.extract(call, body) : extraction();
      return { ok: true, status: 200, json: async () => ({
        id: `fixture-response-${call}`, model: body.model,
        usage: { prompt_tokens: 100, completion_tokens: 200 },
        choices: [{ message: { content: options.rawContent ?? JSON.stringify(value) } }],
      }) };
    },
    require(name) {
      if (name === 'express') return express;
      if (name === 'firebase-admin/app') return { applicationDefault: () => ({}), getApps: () => [{}], initializeApp() {} };
      if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'fixture-server-time' } };
      if (name === 'node:crypto') return require(name);
      if (name === './contracts.js') {
        const exports = {};
        const contractSource = fs.readFileSync(new URL('../workers/private-life-model-index-provider/src/contracts.ts', import.meta.url), 'utf8');
        const compiled = ts.transpileModule(contractSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        vm.runInNewContext(compiled, { exports, Date: FixtureDate });
        return exports;
      }
      throw new Error(`Unexpected service dependency: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return {
    records, stats,
    advance(ms) { clock += ms; },
    async dispatch(body = request, authorization = 'Bearer fixture-index-token') {
      const result = { status: 200, headers: {}, body: undefined };
      const req = { body, get: key => key === 'Authorization' ? authorization : undefined };
      const res = { status(value) { result.status = value; return res; }, set(key, value) { result.headers[key] = value; return res; }, send(value) { result.body = structuredClone(value); return res; } };
      const [auth, handler] = routes.get('/');
      let allowed = false;
      auth(req, res, () => { allowed = true; });
      if (allowed) await handler(req, res);
      return result;
    },
  };
}

test('authorized retry returns one immutable revision without a second extraction', async () => {
  const h = harness();
  const first = await h.dispatch();
  const again = await h.dispatch();
  assert.equal(first.status, 200, JSON.stringify(h.stats));
  assert.equal(again.status, 200);
  assert.equal(again.body.checksum, first.body.checksum);
  assert.equal(again.body.memoryIndexRef, first.body.memoryIndexRef);
  assert.equal(again.body.replayed, true);
  assert.equal(h.stats.extractorCalls, 1);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 1);
});

test('idempotency key cannot mix previous artifact hashes with changed request refs', async () => {
  const h = harness();
  await h.dispatch();
  const changed = await h.dispatch({ ...request, transcriptRef: 'private:fixtures/transcript-02' });
  assert.equal(changed.status, 409);
  assert.equal(h.stats.extractorCalls, 1);
  assert.equal(changed.body.memoryIndexRef, undefined);
});

test('source revocation during extraction prevents persistence and delivery', async () => {
  const h = harness({ resolver: count => count > 1 ? { authorized: false } : {} });
  const output = await h.dispatch();
  assert.notEqual(output.status, 200);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 0);
  assert.equal(output.body.memoryIndexRef, undefined);
});

test('model output with a dangling subject cannot become a graph revision', async () => {
  const h = harness({ extract: () => { const value = extraction(); value.claims[0].subject = 'unresolved_entity'; return value; } });
  const output = await h.dispatch();
  assert.notEqual(output.status, 200);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 0);
});

test('invalid model JSON cannot expose private content through logs', async () => {
  const sensitiveFixture = 'PRIVATE_FIXTURE_SHOULD_NEVER_BE_LOGGED';
  const h = harness({ extract: () => sensitiveFixture });
  const output = await h.dispatch();
  assert.notEqual(output.status, 200);
  assert.ok(h.stats.logs.every(value => !value.includes(sensitiveFixture)));
  assert.ok(h.stats.logs.every(value => !value.includes(transcript)));
});

test('current authorization is required before replaying a retained success', async () => {
  let revoked = false;
  const h = harness({ resolver: () => revoked ? { authorized: false } : {} });
  assert.equal((await h.dispatch()).status, 200);
  revoked = true;
  assert.notEqual((await h.dispatch()).status, 200);
  assert.equal(h.stats.extractorCalls, 1);
});

test('source bytes changing during extraction cannot be committed', async () => {
  const h = harness({ resolver: count => count > 1 ? { sourceSha256: 'b'.repeat(64) } : {} });
  const output = await h.dispatch();
  assert.equal(output.status, 409);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 0);
});

test('revocation after commit prevents delivery of retained private refs', async () => {
  const h = harness({ resolver: count => count >= 3 ? { authorized: false } : {} });
  const output = await h.dispatch();
  assert.notEqual(output.status, 200);
  assert.equal(output.body.memoryIndexRef, undefined);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 1);
});

test('identical concurrent submissions reserve extraction exactly once', async () => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const h = harness({ extract: async () => { entered(); await blocked; return extraction(); } });
  const first = h.dispatch();
  await started;
  const duplicate = await h.dispatch();
  assert.equal(duplicate.status, 503);
  assert.equal(duplicate.headers['Retry-After'], '5');
  assert.equal(h.stats.extractorCalls, 1);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await h.dispatch()).body.replayed, true);
});

test('restart recovery fences an expired attempt from a newer successful lease', async () => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const h = harness({ extract: async call => { if (call === 1) { entered(); await blocked; } return extraction(); } });
  const expired = h.dispatch();
  await started;
  h.advance(180001);
  const recovered = await h.dispatch();
  assert.equal(recovered.status, 200);
  release();
  assert.equal((await expired).status, 409);
  assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 1);
  assert.equal((await h.dispatch()).body.checksum, recovered.body.checksum);
});

test('transient extraction failure permits a bounded same-input retry', async () => {
  const h = harness({ extract: call => { if (call === 1) throw new Error('temporary fixture failure'); return extraction(); } });
  assert.equal((await h.dispatch()).status, 502);
  assert.equal((await h.dispatch()).status, 200);
  assert.equal(h.stats.extractorCalls, 2);
});

test('permanent extraction failures stop after the admitted attempt ceiling', async () => {
  const h = harness({ extract: () => { throw new Error('permanent fixture failure'); } });
  for (let i = 0; i < 3; i++) assert.equal((await h.dispatch()).status, 502);
  assert.equal((await h.dispatch()).status, 409);
  assert.equal(h.stats.extractorCalls, 3);
});

test('unbound legacy receipts are preserved and cannot authorize mixed-input replay', async () => {
  const h = harness();
  await h.dispatch();
  const entry = [...h.records.entries()].find(([path]) => path.includes('/idempotency/'));
  delete entry[1].requestHash;
  const output = await h.dispatch();
  assert.equal(output.status, 409);
  assert.equal(h.stats.extractorCalls, 1);
  assert.equal(h.records.get(entry[0]).checksum, entry[1].checksum);
});

test('admitted graph preserves relationships, time uncertainty and private provenance', async () => {
  const h = harness({ extract: () => {
    const value = extraction();
    value.entities.push({ entityId: 'entity_2', type: 'person', label: 'Second fictional fixture' });
    value.relationships.push({ from: 'entity_1', to: 'entity_2', type: 'sibling', confidence: 0.3 });
    value.claims[0].time = { start: '1980', end: '1981', uncertainty: 'Fixture recollection has year uncertainty.' };
    value.temporalStates.push({ entityId: 'entity_1', validFrom: '1980', validTo: '1981', attributes: { age: 12, asserted: false } });
    return value;
  } });
  const output = await h.dispatch();
  assert.equal(output.status, 200);
  assert.equal(output.body.provenanceRef, request.provenanceRef);
  const record = [...h.records.entries()].find(([path]) => path.includes('/revisions/'))[1];
  assert.equal(record.extraction.relationships[0].to, 'entity_2');
  assert.equal(record.extraction.claims[0].time.start, '1980');
  assert.ok(record.extraction.claims[0].time.uncertainty);
  assert.equal(record.syntheticOutputMayBecomeHistoricalSource, false);
  assert.equal(record.sourceHandle, undefined);
  assert.equal(record.extractionProvider.requestedModel, 'fixture-model');
  assert.equal(record.extractionProvider.responseId, 'fixture-response-1');
  assert.equal(record.extractionProvider.usage.completionTokens, 200);
  assert.equal(JSON.stringify(output.body).includes('Second fictional fixture'), false);
});

for (const [label, alter] of [
  ['duplicate entity identity', value => value.entities.push({ ...value.entities[0] })],
  ['duplicate claim identity', value => value.claims.push({ ...value.claims[0] })],
  ['dangling relationship', value => value.relationships.push({ from: 'entity_1', to: 'unknown_entity', type: 'relative', confidence: 0.5 })],
  ['invalid historical age/time interval', value => value.temporalStates.push({ entityId: 'entity_1', validFrom: '2001', validTo: '1999', attributes: { age: 8 } })],
  ['invalid calendar date', value => { value.claims[0].time = { start: '2025-02-29' }; }],
  ['missing source span', value => { delete value.claims[0].sourceSpan; }],
  ['span beyond source bytes', value => { value.claims[0].sourceSpan.endChar = transcript.length + 1; }],
  ['promoted historical evidence', value => { value.claims[0].evidenceClass = 'SOURCE_CAPTURED'; }],
  ['synthetic historical evidence', value => { value.claims[0].evidenceClass = 'SYNTHETIC_SIMULATION'; }],
  ['dangling negative constraint', value => value.negativeConstraints.push({ constraintId: 'constraint_1', text: 'Fixture constraint', sourceClaimIds: ['unknown_claim'] })],
  ['unsupported place precision', value => value.places.push({ placeId: 'place_1', label: 'Fictional fixture', precision: 'precise-gps' })],
  ['arbitrary model field', value => { value.rawTranscript = transcript; }],
  ['occlusion status without required occlusion', value => { value.sceneTruth.decision = 'READY_WITH_OCCLUSION'; }],
]) {
  test(`graph admission rejects ${label}`, async () => {
    const h = harness({ extract: () => { const value = extraction(); alter(value); return value; } });
    assert.equal((await h.dispatch()).status, 502);
    assert.equal([...h.records.keys()].filter(path => path.includes('/revisions/')).length, 0);
  });
}

test('unresolved contradictions cannot self-declare a READY scene', async () => {
  const h = harness({ extract: () => {
    const value = extraction();
    value.claims.push({ ...value.claims[0], claimId: 'claim_2', object: 'contradictory fictional event' });
    value.conflicts.push({ conflictId: 'conflict_1', claimIds: ['claim_1', 'claim_2'], reason: 'Unresolved fictional source conflict.' });
    return value;
  } });
  const output = await h.dispatch();
  assert.equal(output.status, 200);
  assert.equal(output.body.backlogState, 'CONFLICTED');
  const record = [...h.records.entries()].find(([path]) => path.includes('/revisions/'))[1];
  assert.equal(record.extraction.sceneTruth.decision, 'BLOCKED');
  assert.equal(record.extraction.claims.length, 2, 'source history must remain retained');
});

test('unknown identity/time/place details may remain absent without invented certainty', async () => {
  const h = harness({ extract: () => {
    const value = extraction();
    value.claims[0].place = { precision: 'unknown' };
    value.claims[0].time = { uncertainty: 'Unknown time' };
    value.sceneTruth.decision = 'READY_INTERPRETIVE';
    return value;
  } });
  const output = await h.dispatch();
  assert.equal(output.status, 200);
  const record = [...h.records.entries()].find(([path]) => path.includes('/revisions/'))[1];
  assert.equal(record.extraction.claims[0].time.start, undefined);
  assert.equal(record.extraction.claims[0].place.precision, 'unknown');
});

test('extractor request has explicit model identity, bounded tokens and compatible sampling', async () => {
  let dispatched;
  const h = harness({ extract: (_call, body) => { dispatched = body; return extraction(); } });
  assert.equal((await h.dispatch()).status, 200);
  assert.equal(dispatched.model, 'fixture-model');
  assert.equal(dispatched.max_completion_tokens, 8192);
  assert.equal(dispatched.temperature, undefined);
});

test('bearer authentication rejects unauthorized invocation before all external work', async () => {
  const h = harness();
  assert.equal((await h.dispatch(request, 'Bearer wrong-fixture-token')).status, 401);
  assert.equal(h.stats.resolverCalls, 0);
  assert.equal(h.stats.extractorCalls, 0);
  assert.equal(h.records.size, 0);
});

test('unconfigured or whitespace-only model binding refuses extractor work', async () => {
  for (const model of ['', '   ']) {
    const h = harness({ env: { URAI_LIFE_MODEL_EXTRACTOR_MODEL: model } });
    assert.equal((await h.dispatch()).status, 503);
    assert.equal(h.stats.extractorCalls, 0);
    assert.equal(h.stats.resolverCalls, 0);
  }
});

test('raw malformed model JSON cannot leak its content through parser errors', async () => {
  const h = harness({ rawContent: 'SECRET_FIXTURE invalid JSON payload' });
  assert.equal((await h.dispatch()).status, 502);
  assert.ok(h.stats.logs.every(value => !value.includes('SECRET_FIXTURE')));
});

test('request parsing cannot echo arbitrary private field names into logs', async () => {
  const h = harness();
  assert.equal((await h.dispatch({ ...request, PRIVATE_FIXTURE_FIELD: 'private-fixture-value' })).status, 400);
  assert.ok(h.stats.logs.every(value => !value.includes('PRIVATE_FIXTURE_FIELD')));
  assert.equal(h.stats.resolverCalls, 0);
});

test('malformed scalar inputs cannot masquerade as opaque string refs', async () => {
  const h = harness();
  assert.equal((await h.dispatch({ ...request, transcriptRef: { toString: () => request.transcriptRef } })).status, 400);
  assert.equal(h.stats.resolverCalls, 0);
});

test('terminal cancellation cannot be resurrected by retry admission', async () => {
  const h = harness();
  await h.dispatch();
  const entry = [...h.records.entries()].find(([path]) => path.includes('/idempotency/'));
  entry[1].state = 'CANCELLED';
  assert.equal((await h.dispatch()).status, 409);
  assert.equal(h.stats.extractorCalls, 1);
  assert.equal(entry[1].state, 'CANCELLED');
});

test('retained revision bytes must agree with their receipt before replay', async () => {
  const h = harness();
  await h.dispatch();
  const entry = [...h.records.entries()].find(([path]) => path.includes('/revisions/'));
  entry[1].extraction.claims[0].object = 'tampered fictional value';
  const output = await h.dispatch();
  assert.equal(output.status, 409);
  assert.equal(output.body.memoryIndexRef, undefined);
  assert.equal(h.stats.extractorCalls, 1);
});

test('missing revision cannot be replayed from an idempotency string alone', async () => {
  const h = harness();
  await h.dispatch();
  for (const key of h.records.keys()) if (key.includes('/revisions/')) h.records.delete(key);
  assert.equal((await h.dispatch()).status, 409);
  assert.equal(h.stats.extractorCalls, 1);
});
