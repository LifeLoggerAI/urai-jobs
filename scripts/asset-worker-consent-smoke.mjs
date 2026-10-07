/** Executes actual asset-worker registered handlers with synthetic Firestore/GitHub only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2), idx = args.indexOf('--source-root');
const root = idx < 0 ? path.resolve(fileURLToPath(new URL('..', import.meta.url))) : path.resolve(args[idx + 1]);
const baseline = args.includes('--baseline');
const source = fs.readFileSync(path.join(root, 'workers/asset-worker/index.js'), 'utf8');
const types = ['asset.generate', 'asset.validate', 'asset.package', 'asset.publish', 'asset.forge.v1'];
const hash = value => createHash('sha256').update(value).digest('hex');
const consentId = (owner, purpose) => hash(owner + '\n' + purpose);
const primary = { purpose: 'asset.private-source', policyVersion: 'policy1', decisionReceiptId: 'receipt1' };
const extra = { purpose: 'asset.voice', policyVersion: 'policy2', decisionReceiptId: 'receipt2' };
const token = 'synthetic-callback-only', auth = 'synthetic-callback-secret';
const DELETE = Symbol('FieldValue.delete');
const timestamp = millis => ({ toMillis: () => millis, toDate: () => new Date(millis) });
const clone = value => value === null || typeof value !== 'object' ? value
  : Array.isArray(value) ? value.map(clone)
  : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
function apply(target, update) {
  for (const [key, value] of Object.entries(update)) {
    const keys = key.split('.'), last = keys.pop();
    let at = target;
    for (const part of keys) { if (!at[part] || typeof at[part] !== 'object') at[part] = {}; at = at[part]; }
    if (value === DELETE) delete at[last]; else at[last] = clone(value);
  }
}
function fixture(type, options = {}) {
  const routes = new Map(), docs = new Map(), reads = [], githubBodies = [];
  let nextId = 0, mode = options.dispatchMode || 'accepted';
  const job = { jobId: 'job1', ownerUid: 'owner1', tenantId: 'tenant1', type, status: 'RUNNING',
    consent: primary, consents: [extra, primary], lease: { token: 'lease1' },
    execution: { leaseToken: 'lease1', startedAt: timestamp(Date.now() - 1000) }, payload: { rounds: 2 } };
  if (options.staleCompatRevoke) job.consentRevoked = true;
  if (options.withoutConsent) { delete job.consent; delete job.consents; }
  if (options.callback || options.duplicate) Object.assign(job.execution, { asyncCallbackPending: true,
    callbackTokenHash: hash(token), callbackLeaseToken: 'lease1', callbackDeadlineAt: timestamp(Date.now() + 60000) });
  if (options.duplicate) {
    job.status = options.duplicateStatus || 'SUCCESS';
    Object.assign(job.execution, { asyncCallbackPending: false, completedCallbackTokenHash: hash(token),
      completedCallbackResultId: 'prior-result', completedCallbackStatus: job.status });
    job.result = { resultId: 'prior-result', outputRefs: ['synthetic-private-prior-ref'] };
    docs.set('jobResults/prior-result', { jobId: 'job1', status: job.status, historical: true });
  }
  docs.set('jobs/job1', job); docs.set('jobQueue/job1', { jobId: 'job1', status: 'RUNNING' });
  if (options.block) docs.set('jobConsentBlocks/' + consentId(options.blockOwner || 'owner1', options.block), { active: options.active !== false });
  const snapshot = ref => ({ exists: docs.has(ref.key), data: () => clone(docs.get(ref.key)) });
  const doc = (collection, id = 'generated-' + ++nextId) => ({ key: collection + '/' + id, id,
    get: async () => snapshot({ key: collection + '/' + id }) });
  const db = { collection: name => ({ doc: id => doc(name, id), add: async value => {
    const ref = doc(name); docs.set(ref.key, clone(value)); return ref;
  } }), runTransaction: async fn => {
    const writes = [], tx = {
      get: async ref => { assert.equal(writes.length, 0, 'all Firestore reads precede writes'); reads.push(ref.key); return snapshot(ref); },
      set: (ref, value, options = {}) => writes.push({ ref, value, merge: options.merge === true }),
      update: (ref, value) => writes.push({ ref, value, merge: true }),
    };
    const result = await fn(tx);
    for (const w of writes) { const current = w.merge ? clone(docs.get(w.ref.key) || {}) : {}; apply(current, w.value); docs.set(w.ref.key, current); }
    return result;
  } };
  function express() { return { set() {}, use() {}, get(route, ...handlers) { routes.set('GET ' + route, handlers); },
    post(route, ...handlers) { routes.set('POST ' + route, handlers); }, listen() {} }; }
  express.json = () => () => {};
  function firestore() { return db; }
  firestore.Timestamp = { fromMillis: timestamp, now: () => timestamp(Date.now()) };
  firestore.FieldValue = { delete: () => DELETE, serverTimestamp: () => timestamp(Date.now()) };
  const admin = { initializeApp() {}, firestore };
  const context = { Buffer, URL, Date, console: { log() {}, warn() {}, error() {} },
    process: { env: { URAI_ENV: 'test', URAI_JOBS_WORKER_TOKEN: 'synthetic-worker-token',
      URAI_WHEEL_GITHUB_TOKEN: 'synthetic-github-token', URAI_JOBS_CALLBACK_SECRET: auth,
      ASSET_WORKER_PUBLIC_URL: 'https://synthetic-worker.example' } },
    require: name => name === 'express' ? express : name === 'firebase-admin' ? admin : require(name),
    fetch: async (_url, init) => {
      githubBodies.push(JSON.parse(init.body));
      if (mode === 'ambiguous') throw new Error('synthetic connection lost');
      return { ok: mode !== 'rejected', status: mode === 'rejected' ? 403 : 204, text: async () => 'synthetic rejected' };
    },
  };
  vm.runInNewContext(source, context, { filename: 'actual-asset-worker/index.js', timeout: 1000 });
  async function invoke(route, body = {}, options = {}) {
    const req = { body, query: { callbackToken: options.token || token }, protocol: 'https',
      get: name => name === 'authorization' ? 'Bearer ' + (options.auth || (route === '/callback' ? auth : 'synthetic-worker-token')) : 'synthetic-worker.example' };
    const res = { code: 200, body: null, status(code) { this.code = code; return this; }, send(value) { this.body = value; return this; }, set() { return this; } };
    const handlers = routes.get('POST ' + route); assert.ok(handlers, 'actual route registered');
    let offset = 0;
    async function next() { const fn = handlers[offset++]; if (fn) await fn(req, res, next); }
    await next(); return res;
  }
  return { docs, reads, githubBodies, job: () => docs.get('jobs/job1'), invoke };
}
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('[PASS] ' + label); }
for (const type of types) {
  for (const purpose of [primary.purpose, extra.purpose]) {
    await check(type + ' revoked registration ' + purpose, async () => {
      const f = fixture(type, { block: purpose });
      const r = await f.invoke('/', { jobId: 'job1', leaseToken: 'lease1' });
      if (baseline) { assert.equal(r.code, 202); assert.equal(f.githubBodies.length, 1); }
      else { assert.equal(r.code, 409); assert.equal(f.githubBodies.length, 0); assert.equal(f.job().status, 'CANCELLED');
        assert.equal(f.job().execution.leaseToken, undefined); assert.equal(f.docs.get('jobQueue/job1').status, 'CANCELLED'); }
    });
    for (const status of ['SUCCESS', 'FAILED']) await check(type + ' revoked callback ' + purpose + ' ' + status, async () => {
      const f = fixture(type, { callback: true, block: purpose });
      const r = await f.invoke('/callback', { jobId: 'job1', status, spatialSha: 'a'.repeat(40), assetFactoryRun: '1' });
      if (baseline) { assert.equal(r.code, 200); assert.equal(f.job().status, status); }
      else { assert.equal(r.code, 409); assert.equal(f.job().status, 'CANCELLED'); assert.equal(f.job().execution.callbackTokenHash, undefined);
        assert.equal(f.job().execution.callbackLeaseToken, undefined); assert.equal(f.job().execution.callbackDeadlineAt, undefined);
        assert.equal([...f.docs.keys()].some(k => k.startsWith('jobResults/')), false); }
    });
  }
  for (const status of ['SUCCESS', 'FAILED']) await check(type + ' revoked completed duplicate ' + status, async () => {
    const f = fixture(type, { duplicate: true, duplicateStatus: status, block: primary.purpose });
    const r = await f.invoke('/callback', { jobId: 'job1', status });
    if (baseline) { assert.equal(r.code, 200); assert.equal(r.body.resultId, 'prior-result'); }
    else { assert.equal(r.code, 409); assert.equal(f.job().status, 'CANCELLED'); assert.equal(f.job().result?.resultId, undefined);
      assert.equal(f.job().execution.completedCallbackTokenHash, undefined); assert.equal(f.docs.get('jobResults/prior-result').historical, true); }
  });
  if (baseline) continue;
  for (const options of [{}, { block: primary.purpose, active: false }, { block: primary.purpose, blockOwner: 'other-owner' }, { block: 'unrelated-purpose' }, { withoutConsent: true }, { staleCompatRevoke: true }]) {
    await check(type + ' authorized registration isolation ' + JSON.stringify(options), async () => {
      const f = fixture(type, options), r = await f.invoke('/', { jobId: 'job1', leaseToken: 'lease1' });
      assert.equal(r.code, 202); assert.equal(f.githubBodies.length, 1); assert.equal(f.job().execution.asyncCallbackPending, true);
      if (!options.withoutConsent) assert.equal(f.reads.filter(k => k.startsWith('jobConsentBlocks/')).length, 2, 'deduplicated purposes');
    });
    for (const status of ['SUCCESS', 'FAILED']) await check(type + ' authorized callback isolation ' + status + ' ' + JSON.stringify(options), async () => {
      const f = fixture(type, { ...options, callback: true }), r = await f.invoke('/callback', { jobId: 'job1', status });
      assert.equal(r.code, 200); assert.equal(f.job().status, status); assert.equal(f.job().execution.asyncCallbackPending, false);
      assert.equal([...f.docs.keys()].filter(k => k.startsWith('jobResults/')).length, 1);
      const replay = await f.invoke('/callback', { jobId: 'job1', status });
      assert.equal(replay.code, 200); assert.equal(replay.body.duplicate, true); assert.equal(replay.body.resultId, r.body.resultId);
      assert.equal([...f.docs.keys()].filter(k => k.startsWith('jobResults/')).length, 1);
    });
  }
  for (const mutate of ['wrong-token', 'wrong-secret', 'expired', 'wrong-lease', 'no-pending', 'terminal']) await check(type + ' callback ownership fence ' + mutate, async () => {
    const f = fixture(type, { callback: true });
    if (mutate === 'expired') f.job().execution.callbackDeadlineAt = timestamp(Date.now() - 1000);
    if (mutate === 'wrong-lease') f.job().execution.leaseToken = 'different-lease';
    if (mutate === 'no-pending') f.job().execution.asyncCallbackPending = false;
    if (mutate === 'terminal') f.job().status = 'CANCELLED';
    const before = f.job().status;
    const r = await f.invoke('/callback', { jobId: 'job1', status: 'SUCCESS' }, { token: mutate === 'wrong-token' ? 'wrong' : token, auth: mutate === 'wrong-secret' ? 'wrong' : auth });
    assert.equal(r.code, mutate.startsWith('wrong-') && mutate !== 'wrong-lease' ? 403 : 409); assert.equal(f.job().status, before);
    assert.equal([...f.docs.keys()].some(k => k.startsWith('jobResults/')), false);
  });
  for (const mode of ['ambiguous', 'rejected']) await check(type + ' dispatch ' + mode + ' preserves prior recovery semantics', async () => {
    const f = fixture(type, { dispatchMode: mode }), r = await f.invoke('/', { jobId: 'job1', leaseToken: 'lease1' });
    assert.equal(r.code, mode === 'ambiguous' ? 202 : 502);
    assert.equal(f.job().status, mode === 'ambiguous' ? 'RUNNING' : 'FAILED');
    assert.equal(f.job().execution.asyncCallbackPending, mode === 'ambiguous');
  });
}
console.log('Actual asset-worker synthetic consent/ownership regressions: ' + passed + ' passed; mode=' + (baseline ? 'predecessor defect reproduced' : 'corrected') + '; GitHub/provider network calls: 0; spending: 0.');
