const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the compiled production route with memory-only Firebase and fetch adapters.
// Any unexpected module or outbound URL is rejected; no network or credentials are used.
function harness(options = {}) {
  const docs = new Map();
  const calls = { resolver: 0, extractor: 0 };
  const logs = [];
  let route;
  let serial = Promise.resolve();
  function ref(name) {
    return { path: name, collection: (leaf) => ref(`${name}/${leaf}`), doc: (id) => ref(`${name}/${id}`) };
  }
  const db = {
    collection: (name) => ref(name),
    runTransaction(fn) {
      const result = serial.then(async () => {
        const writes = [];
        const tx = {
          get: async (entry) => ({ exists: docs.has(entry.path), data: () => docs.get(entry.path) }),
          set: (entry, value) => writes.push(['set', entry.path, value]),
          create: (entry, value) => {
            assert.ok(!docs.has(entry.path), 'immutable revision already exists');
            writes.push(['set', entry.path, value]);
          },
          delete: (entry) => writes.push(['delete', entry.path]),
        };
        const value = await fn(tx);
        for (const [operation, key, record] of writes) {
          if (operation === 'delete') docs.delete(key);
          else docs.set(key, structuredClone(record));
        }
        return value;
      });
      serial = result.catch(() => {});
      return result;
    },
  };
  const app = {
    use() {}, get() {}, listen() {},
    post(url, auth, handler) { assert.equal(url, '/'); route = { auth, handler }; },
  };
  const express = () => app;
  express.json = () => () => {};
  const modules = {
    'node:crypto': crypto,
    express,
    'firebase-admin/app': { applicationDefault: () => ({}), getApps: () => [{}], initializeApp() {} },
    'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'synthetic-server-time' }, getFirestore: () => db },
  };
  const context = vm.createContext({
    require(name) { assert.ok(Object.hasOwn(modules, name), `unexpected module: ${name}`); return modules[name]; },
    exports: {}, console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
    process: { env: {
      URAI_ENV: 'test', PRIVATE_SOURCE_REF_RESOLVER_URL: 'https://resolver.invalid',
      PRIVATE_SOURCE_REF_RESOLVER_TOKEN: 'synthetic-test-token', OPENAI_API_KEY: 'synthetic-extractor-token',
      FIREBASE_PROJECT_ID: 'synthetic-test-project', URAI_SOURCE_SHA: 'a'.repeat(40),
    } },
    URL, AbortSignal, Date,
    fetch: async (url, request) => {
      const body = JSON.parse(request.body);
      if (url === 'https://resolver.invalid/resolve-life-model-inputs') {
        calls.resolver += 1;
        const defaults = {
          authorized: true, synthetic: false, sourceHandle: body.sourceHandle,
          transcriptRef: body.transcriptRef, provenanceRef: body.provenanceRef,
          sourceEvidenceClass: 'SOURCE_DERIVED', transcriptText: 'Synthetic generic transcript fixture.',
          sourceFixityRef: 'private:fixity/synthetic-source', sourceSha256: 'b'.repeat(64),
        };
        const payload = options.resolve ? await options.resolve(calls.resolver, body, defaults) : defaults;
        return { ok: true, json: async () => payload };
      }
      assert.equal(url, 'https://api.openai.com/v1/chat/completions', 'unexpected outbound URL');
      calls.extractor += 1;
      if (options.extract) await options.extract(calls.extractor, body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        entities: [], claims: [], relationships: [], temporalStates: [], places: [], conflicts: [], negativeConstraints: [],
        sceneTruth: { decision: 'READY_WITH_OCCLUSION', reasons: ['Synthetic test fixture'] },
      }) } }] }) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8'), context);
  async function invoke(body = {}) {
    const request = { body: { ...fixture(), ...body }, get: () => '' };
    const response = { code: 200, headers: {}, value: null,
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.code = code; return this; },
      send(value) { this.value = JSON.parse(JSON.stringify(value)); return this; },
    };
    let pending;
    route.auth(request, response, () => { pending = route.handler(request, response); });
    await pending;
    return response;
  }
  return { invoke, calls, docs, logs };
}

function fixture() {
  return {
    sourceHandle: 'psh_synthetic_source_handle_001', sourceEvidenceClass: 'SOURCE_DERIVED',
    transcriptRef: 'private:transcripts/synthetic-001', provenanceRef: 'private:provenance/synthetic-001',
    requestedPurpose: 'memory-index', idempotencyKey: 'synthetic-request-001',
  };
}
function revisionCount(h) { return [...h.docs.keys()].filter((key) => key.includes('/revisions/')).length; }
function idempotencyKey() {
  return `uraiPrivateLifeModel/${crypto.createHash('sha256').update(fixture().sourceHandle).digest('hex').slice(0, 40)}`
    + `/idempotency/${crypto.createHash('sha256').update(fixture().idempotencyKey).digest('hex')}`;
}

test('duplicate returns the authorized immutable receipt without another extractor call', async () => {
  const h = harness();
  const first = await h.invoke();
  const replay = await h.invoke();
  assert.equal(first.code, 200); assert.equal(first.value.replayed, false);
  assert.equal(replay.code, 200); assert.equal(replay.value.replayed, true);
  assert.equal(replay.value.checksum, first.value.checksum);
  assert.equal(replay.value.memoryIndexRef, first.value.memoryIndexRef);
  assert.equal(h.calls.extractor, 1); assert.equal(h.calls.resolver, 3); assert.equal(revisionCount(h), 1);
  assert.equal(replay.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(replay.value).includes('Synthetic generic transcript'));
  assert.ok(!JSON.stringify(replay.value).includes(fixture().sourceHandle));
});

test('reusing an idempotency key with a changed request fails before extraction', async () => {
  const h = harness(); await h.invoke();
  for (const change of [
    { transcriptRef: 'private:transcripts/synthetic-002' }, { provenanceRef: 'private:provenance/synthetic-002' },
    { locale: 'es' }, { correlationTrigger: 'correction' }, { priorMemoryIndexRef: 'private:life-model/synthetic-prior' },
  ]) {
    const result = await h.invoke(change);
    assert.equal(result.code, 409); assert.equal(result.value.code, 'LIFE_MODEL_IDEMPOTENCY_CONFLICT');
  }
  assert.equal(h.calls.extractor, 1); assert.equal(revisionCount(h), 1);
});

test('a corrected transcript under the same ref cannot replay the old receipt', async () => {
  let corrected = false;
  const h = harness({ resolve: (_n, _body, defaults) => ({ ...defaults, transcriptText: corrected ? 'Synthetic correction.' : defaults.transcriptText }) });
  await h.invoke(); corrected = true;
  const result = await h.invoke();
  assert.equal(result.code, 409); assert.equal(result.value.code, 'LIFE_MODEL_IDEMPOTENCY_CONFLICT');
  assert.equal(h.calls.extractor, 1); assert.equal(revisionCount(h), 1);
});

test('changed source fixity cannot replay the old receipt', async () => {
  let changed = false;
  const h = harness({ resolve: (_n, _body, defaults) => ({ ...defaults, sourceSha256: (changed ? 'c' : 'b').repeat(64) }) });
  await h.invoke(); changed = true;
  assert.equal((await h.invoke()).value.code, 'LIFE_MODEL_IDEMPOTENCY_CONFLICT');
  assert.equal(h.calls.extractor, 1);
});

test('revocation rejects a replay before extraction or receipt delivery', async () => {
  let revoked = false;
  const h = harness({ resolve: (_n, _body, defaults) => ({ ...defaults, authorized: !revoked }) });
  await h.invoke(); revoked = true;
  const result = await h.invoke();
  assert.equal(result.code, 502); assert.equal(result.value.ok, false); assert.ok(!result.value.memoryIndexRef);
  assert.equal(h.calls.extractor, 1);
});

test('revocation during extraction prevents persistence and releases the request lease', async () => {
  let revoked = false;
  const h = harness({ resolve: (_n, _body, defaults) => ({ ...defaults, authorized: !revoked }), extract: () => { revoked = true; } });
  const result = await h.invoke();
  assert.equal(result.code, 502); assert.equal(revisionCount(h), 0); assert.equal(h.docs.has(idempotencyKey()), false);
});

test('correction during extraction prevents a stale revision from being committed', async () => {
  let corrected = false;
  const h = harness({ resolve: (_n, _body, defaults) => ({ ...defaults, transcriptText: corrected ? 'Synthetic correction.' : defaults.transcriptText }), extract: () => { corrected = true; } });
  const result = await h.invoke();
  assert.equal(result.code, 409); assert.equal(result.value.code, 'LIFE_MODEL_SOURCE_CHANGED');
  assert.equal(revisionCount(h), 0); assert.equal(h.docs.has(idempotencyKey()), false);
});

test('concurrent duplicate is fenced before a second extractor call', async () => {
  let started, finish;
  const entered = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { finish = resolve; });
  const h = harness({ extract: async () => { started(); await gate; } });
  const first = h.invoke(); await entered;
  const duplicate = await h.invoke();
  assert.equal(duplicate.code, 409); assert.equal(duplicate.value.code, 'LIFE_MODEL_INDEX_IN_PROGRESS');
  assert.equal(h.calls.extractor, 1);
  finish(); assert.equal((await first).code, 200);
  assert.equal((await h.invoke()).value.replayed, true); assert.equal(revisionCount(h), 1);
});

test('legacy unbound idempotency records fail closed without another extractor call', async () => {
  const h = harness();
  h.docs.set(idempotencyKey(), { revision: 1, checksum: 'b'.repeat(64), backlogState: 'INDEXED' });
  const result = await h.invoke();
  assert.equal(result.code, 409); assert.equal(result.value.code, 'LIFE_MODEL_IDEMPOTENCY_CONFLICT');
  assert.equal(h.calls.extractor, 0); assert.equal(revisionCount(h), 0);
});

test('failed extraction releases its own lease and an authorized retry can succeed', async () => {
  const h = harness({ extract: (n) => { if (n === 1) throw new Error('synthetic extractor failure'); } });
  assert.equal((await h.invoke()).code, 502); assert.equal(h.docs.has(idempotencyKey()), false);
  assert.equal((await h.invoke()).code, 200); assert.equal(revisionCount(h), 1);
  assert.ok(h.logs.every((line) => !line.includes('Synthetic generic transcript') && !line.includes(fixture().sourceHandle)));
});

test('an expired request lease can be reclaimed and an old failure cannot delete the new lease', async () => {
  let firstStarted, secondStarted, finishFirst, finishSecond;
  const enteredFirst = new Promise((resolve) => { firstStarted = resolve; });
  const enteredSecond = new Promise((resolve) => { secondStarted = resolve; });
  const gateFirst = new Promise((resolve) => { finishFirst = resolve; });
  const gateSecond = new Promise((resolve) => { finishSecond = resolve; });
  const h = harness({ extract: async (n) => {
    if (n === 1) { firstStarted(); await gateFirst; throw new Error('synthetic expired attempt failure'); }
    secondStarted(); await gateSecond;
  } });
  const first = h.invoke(); await enteredFirst;
  h.docs.set(idempotencyKey(), { ...h.docs.get(idempotencyKey()), leaseUntilMs: 0 });
  const second = h.invoke(); await enteredSecond;
  const secondToken = h.docs.get(idempotencyKey()).claimToken;
  finishFirst(); assert.equal((await first).code, 502);
  assert.equal(h.docs.get(idempotencyKey()).claimToken, secondToken);
  finishSecond(); assert.equal((await second).code, 200);
  assert.equal(revisionCount(h), 1); assert.equal((await h.invoke()).value.replayed, true);
});
