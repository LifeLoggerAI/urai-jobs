import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const axios = require('axios').create({ proxy: false, adapter: 'http' });
const root = new URL('../', import.meta.url);
const baselinePath = process.argv.find(value => value.startsWith('--baseline-source='));
const original = fs.readFileSync(baselinePath ? baselinePath.slice('--baseline-source='.length) : new URL('functions/src/jobs/executeJob.ts', root), 'utf8');
let cases = 0;
function compile(source, dependencies, environment) {
  const exports = {};
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, require: dependencies, process: { env: environment }, Date, Set, Promise, console: { log() {}, warn() {}, error() {} } });
  return exports;
}
const guards = compile(fs.readFileSync(new URL('functions/src/jobs/executionGuards.ts', root), 'utf8'), () => { throw new Error('unexpected guard dependency'); }, {});
const registry = compile(fs.readFileSync(new URL('functions/src/core/runtimeJobTypes.ts', root), 'utf8'), () => { throw new Error('unexpected routing dependency'); }, {});
const routes = Object.entries(registry.RUNTIME_JOB_REGISTRY).filter(([, value]) => value.workerEnvKey);
const deletion = { marker: 'delete' };
const fieldValue = { serverTimestamp: () => new Date(), delete: () => deletion, increment: amount => ({ marker: 'increment', amount }) };
function fixture(jobType, origin, extra = {}) {
  const job = { jobId: 'synthetic-worker-job', type: jobType, jobType, status: 'LEASED', ownerUid: 'synthetic-owner', tenantId: 'synthetic-tenant', lease: { leaseToken: 'synthetic-lease' }, execution: { maxAttempts: 1 }, consent: { purpose: 'synthetic.private', policyVersion: 'synthetic-v1', decisionReceiptId: 'synthetic-decision' }, payload: { text: 'synthetic-private-job-bytes' } };
  const docs = new Map([['jobs/' + job.jobId, job], ['jobQueue/' + job.jobId, { jobId: job.jobId, status: 'LEASED', lease: { leaseToken: 'synthetic-lease' } }]]);
  const logs = [];
  const reference = path => ({ path, async get() { return snapshot(path); }, collection() { return { async add(value) { logs.push(value); } }; } });
  const snapshot = path => ({ exists: docs.has(path), data: () => structuredClone(docs.get(path)) });
  function update(ref, values, merge = true) {
    const value = merge ? structuredClone(docs.get(ref.path) || {}) : {};
    for (const [key, next] of Object.entries(values)) {
      const keys = key.split('.'); let target = value;
      for (const part of keys.slice(0, -1)) target = target[part] ||= {};
      const last = keys.at(-1);
      if (next === deletion) delete target[last];
      else if (next?.marker === 'increment') target[last] = Number(target[last] || 0) + next.amount;
      else target[last] = next;
    }
    docs.set(ref.path, value);
  }
  const db = {
    doc: reference, collection: name => ({ doc: id => reference(name + '/' + id) }),
    async runTransaction(run) {
      const writes = [];
      const result = await run({
        get: async ref => snapshot(ref.path),
        update: (ref, value) => writes.push(() => update(ref, value)),
        set: (ref, value, options) => writes.push(() => update(ref, value, options?.merge))
      });
      for (const write of writes) write(); return result;
    }
  };
  const environment = { URAI_ENV: 'staging', URAI_JOBS_WORKER_TOKEN: 'synthetic-private-worker-token', [registry.workerEnvKeyForJobType(jobType)]: origin, ...extra };
  const imports = {
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: fieldValue },
    'firebase-functions/params': { defineSecret: () => ({ value: () => environment.URAI_JOBS_WORKER_TOKEN }) },
    'firebase-functions/v2/pubsub': { onMessagePublished: (_options, run) => run },
    axios,
    // This fixture starts after valid intake; validation behavior is tested elsewhere.
    zod: { z: { object: () => ({ safeParse: data => ({ success: true, data }) }), string: () => ({ min() { return this; } }) } },
    '../core/firestore-paths.js': { jobDoc: id => reference('jobs/' + id), jobQueueEntryDoc: id => reference('jobQueue/' + id) },
    '../core/runtimeJobTypes.js': registry,
    '../providers/tinyfish.js': { isTinyFishJobType: () => false, tinyFishApiKeySecret: {}, executeTinyFishJob() { throw new Error('provider prohibited'); } },
    './executionGuards.js': guards,
    '../privacy/privateLifeModelDataRights.js': { async canFinalizePrivateSource() { return true; } }
  };
  imports['../privacy/consentBlocks.js'] = compile(fs.readFileSync(new URL('functions/src/privacy/consentBlocks.ts', root), 'utf8'), name => name === 'node:crypto' ? require(name) : imports[name], environment);
  const handler = compile(original, name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; }, environment).executeJob;
  return { docs, logs, job, execute: () => handler({ data: { message: { json: { jobId: job.jobId, leaseToken: 'synthetic-lease' } } } }) };
}
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return 'http://127.0.0.1:' + server.address().port; }
async function close(server) { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
async function scenario(jobType, status, sameOrigin, mode = 'redirect') {
  const received = [], escaped = [];
  const consume = async request => { const chunks = []; for await (const chunk of request) chunks.push(chunk); return Buffer.concat(chunks).toString(); };
  const sink = http.createServer(async (req, res) => { escaped.push({ body: await consume(req), authorization: req.headers.authorization }); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
  const sinkOrigin = await listen(sink);
  let origin;
  const worker = http.createServer(async (req, res) => {
    const input = { method: req.method, path: req.url, body: await consume(req), authorization: req.headers.authorization };
    if (req.url === '/redirected') { escaped.push(input); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
    received.push(input);
    if (mode === 'redirect') { res.writeHead(status, { location: (sameOrigin ? origin : sinkOrigin) + '/redirected' }); res.end(); }
    else if (mode === 'hang') { /* The synthetic timeout closes this request. */ }
    else { res.writeHead(status, { 'content-type': 'application/json' }); res.end('{"ok":true,"fixture":"owned-worker-response"}'); }
  });
  origin = await listen(worker);
  const f = fixture(jobType, origin, mode === 'hang' ? { URAI_JOBS_WORKER_TIMEOUT_MS: '40' } : {});
  try {
    await f.execute();
    assert.equal(received.length, 1, 'one owned worker POST');
    assert.equal(received[0].method, 'POST');
    assert.equal(received[0].authorization, 'Bearer synthetic-private-worker-token');
    assert.equal(JSON.parse(received[0].body).tenantId, f.job.tenantId);
    assert.equal(JSON.parse(received[0].body).payload.text, f.job.payload.text);
    assert.equal(received[0].path, registry.workerRouteForJobType(jobType));
    const final = f.docs.get('jobs/' + f.job.jobId);
    if (baselinePath && mode === 'redirect') {
      assert.equal(escaped.length, 1, 'baseline redispatch must be reproduced');
      assert.equal(JSON.parse(escaped[0].body).payload.text, f.job.payload.text, 'actual private body was replayed');
      if (sameOrigin) assert.equal(escaped[0].authorization, received[0].authorization, 'same-origin worker authority was replayed');
      assert.equal(final.status, 'SUCCESS');
    } else {
      assert.equal(escaped.length, 0, 'private body and worker authority must never reach a redirect target');
      if (mode === 'redirect' || mode === 'hang') { assert.equal(final.status, 'DEAD'); assert.equal(final.output, undefined); assert.equal(final.result, undefined); }
      else if (status === 202) { assert.equal(final.status, 'RUNNING'); assert.equal(final.output, undefined); }
      else { assert.equal(final.status, 'SUCCESS'); assert.equal(final.output.fixture, 'owned-worker-response'); }
    }
    cases++;
    console.log('[PASS] ' + jobType + ' ' + mode + ' ' + status + ' ' + (sameOrigin ? 'same-origin' : 'cross-origin'));
  } finally { await close(worker); await close(sink); }
}
if (baselinePath) {
  for (const status of [307, 308]) for (const sameOrigin of [true, false]) await scenario('studio.render.video', status, sameOrigin);
  console.log('[REPRODUCED] ' + cases + ' actual Axios worker redirect redispatches from exact predecessor source');
} else {
  for (const [jobType] of routes) {
    for (const status of [301, 302, 303, 307, 308]) for (const sameOrigin of [true, false]) await scenario(jobType, status, sameOrigin);
    await scenario(jobType, 200, true, 'success');
    await scenario(jobType, 202, true, 'accepted');
  }
  await scenario('narrator.tts', 0, true, 'hang');
  console.log('[PASS] Actual dispatcher/Axios loopback boundary: ' + cases + ' cases; no provider or private source used');
}
