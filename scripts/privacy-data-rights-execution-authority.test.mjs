import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript'), zod = require('zod');
const ownerUid = 'synthetic-owner', actorUid = 'synthetic-operator', requestId = 'synthetic-deletion-request';
const jobPath = 'jobs/synthetic-job', queuePath = 'jobQueue/synthetic-job', logPath = `${jobPath}/logs/synthetic-log`;
const actorPath = `users/${actorUid}`, ownerPath = `users/${ownerUid}`, requestPath = `dataRightsRequests/${requestId}`;
const input = { requestId, retentionDecisionReceiptId: 'synthetic-retention-receipt', idempotencyKey: 'synthetic-idempotency-key' };
function harness(options = {}) {
  const documents = new Map(), versions = new Map(); let clock = 0;
  const state = { now: Date.now(), revoked: false, disabled: false, verifiedUid: actorUid,
    onRead: null, onQuery: null, onTransactionRead: null, onBeforeCommit: null, onPrivateDelete: null, maxWrites: 0, providerCalls: 0 };
  const deleted = '__DELETE__', server = '__TIMESTAMP__';
  function version(path) { const fingerprint = JSON.stringify(documents.get(path)), previous = versions.get(path);
    if (!previous || previous.fingerprint !== fingerprint) versions.set(path, { fingerprint, clock: ++clock });
    const stamp = versions.get(path).clock; return { seconds: stamp, nanoseconds: 0, isEqual: other => other?.seconds === stamp && other?.nanoseconds === 0 }; }
  function patch(path, fields, merge) { const result = merge ? structuredClone(documents.get(path) || {}) : {};
    for (const [key, value] of Object.entries(fields)) { if (value === deleted) delete result[key]; else result[key] = value === server ? new Date(state.now).toISOString() : structuredClone(value); }
    documents.set(path, result); }
  const snapshot = ref => { const value = structuredClone(documents.get(ref.path));
    return { ref, id: ref.id, exists: documents.has(ref.path), updateTime: version(ref.path), data: () => structuredClone(value) }; };
  const reference = path => ({ path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`),
    async get() { const result = snapshot(reference(path)); await state.onRead?.(path); return result; },
    async set(fields, options) { patch(path, fields, options?.merge); } });
  function collection(path) { const filters = []; let max = Infinity;
    return { path, doc: id => reference(`${path}/${id}`), where(field, op, value) { filters.push([field, op, value]); return this; },
      orderBy() { return this; }, limit(value) { max = value; return this; },
      async get() { const docs = [...documents].filter(([name, data]) => name.startsWith(`${path}/`)
        && name.split('/').length === path.split('/').length + 1 && filters.every(([field, op, value]) => op === '==' && data[field] === value))
        .sort(([left], [right]) => left.localeCompare(right)).slice(0, max).map(([name]) => snapshot(reference(name)));
        await state.onQuery?.(path, docs); return { docs, size: docs.length }; } };
  }
  const db = { collection, async runTransaction(callback) { const writes = [], reads = new Map();
    const tx = { async get(ref) { const result = snapshot(ref); reads.set(ref.path, result.updateTime); await state.onTransactionRead?.(ref.path); return result; },
      create(ref, fields) { writes.push(() => { assert.equal(documents.has(ref.path), false); patch(ref.path, fields, false); }); },
      set(ref, fields, options) { writes.push(() => patch(ref.path, fields, options?.merge)); },
      update(ref, fields) { writes.push(() => { assert.equal(documents.has(ref.path), true); patch(ref.path, fields, true); }); },
      delete(ref, precondition) { writes.push(() => { if (precondition?.lastUpdateTime) assert.equal(precondition.lastUpdateTime.isEqual(version(ref.path)), true); documents.delete(ref.path); }); } };
    const result = await callback(tx); await state.onBeforeCommit?.(reads, writes);
    for (const [path, stamp] of reads) if (!stamp.isEqual(version(path))) throw Object.assign(new Error('synthetic transaction read conflict'), { code: 'unavailable' });
    state.maxWrites = Math.max(state.maxWrites, writes.length); assert.ok(writes.length <= 450);
    for (const write of writes) write(); return result; }, batch() { const writes = [];
      return { delete: ref => writes.push(() => documents.delete(ref.path)), set: (ref, value, options) => writes.push(() => patch(ref.path, value, options?.merge)),
        async commit() { state.maxWrites = Math.max(state.maxWrites, writes.length); for (const write of writes) write(); } }; } };
  class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const auth = { async verifyIdToken(token, revoked) { assert.equal(revoked, true);
    if (token !== 'synthetic-current-token' || state.revoked) throw new Error('synthetic withdrawn credential'); return { uid: state.verifiedUid, role: 'operator' }; },
    async getUser(uid) { assert.equal(uid, actorUid); return { uid, disabled: state.disabled, customClaims: { role: 'operator' } }; } };
  const fixtureRequire = (name, parent) => {
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { delete: () => deleted, serverTimestamp: () => server } };
    if (name === 'firebase-admin/auth') return { getAuth: () => auth };
    if (name === 'firebase-functions/v1') return { https: { onCall: callback => callback, HttpsError } };
    if (name === 'firebase-functions/v2/https') return { HttpsError };
    if (name === 'zod') return zod;
    if (name === '../core/errors.js' || name === './errors.js') return { httpsError: (code, message) => new HttpsError(code, message) };
    if (name === './firestore-paths.js') return { userDoc: uid => reference(`users/${uid}`) };
    if (name === '../core/auth.js') return evaluate(new URL('../functions/src/core/auth.ts', import.meta.url));
    if (name === './currentJobActor.js') return evaluate(new URL('../functions/src/core/currentJobActor.ts', import.meta.url));
    if (name === '../core/gcs.js') return { uploadToGcs: async () => { state.providerCalls++; throw new Error('provider upload forbidden in deletion fixture'); } };
    if (name === './capturedRealityDerivativeRevocation.js') return {
      deleteCapturedRealityEngineJob: async () => { throw new Error('real provider engine fixture not admitted'); },
      deleteCapturedRealityPublishedRuntimeForOwner: async () => ({ deleted: 0, globalErasureVerified: false }) };
    if (name === './privateLifeModelDataRights.js') return {
      deleteOwnedPrivateLifeModel: async (_db, uid, id, checkpoint) => { assert.equal(uid, ownerUid); assert.equal(id, requestId);
        await checkpoint(); await state.onPrivateDelete?.(); return { deleted: 0, unresolvedDomains: ['synthetic-private-life-model-not-loaded'] }; },
      assertPrivateDataRightsExportDestination: async () => { throw new Error('export fixture not admitted'); },
      assertPrivateLifeModelOwnerEpoch: async () => { throw new Error('export fixture not admitted'); },
      exportOwnedPrivateLifeModel: async () => { throw new Error('export fixture not admitted'); },
      removePrivateDataRightsExportAttempt: async () => { throw new Error('export fixture not admitted'); } };
    if (name === './dataRightsContinuationPolicy.js') return evaluate(new URL('../functions/src/privacy/dataRightsContinuationPolicy.ts', import.meta.url));
    if (name.startsWith('node:')) return require(name);
    throw new Error(`unprovided source boundary ${parent}: ${name}`);
  };
  function evaluate(file) { const source = fs.readFileSync(file, 'utf8'), exports = {};
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(output, { exports, Buffer, Date: FixtureDate, process: { env: {
      URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE: options.mode ?? 'protected-staging', GCLOUD_PROJECT: 'demo-urai-jobs',
      URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT: options.allowedProject ?? 'demo-urai-jobs', URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED: options.production ?? 'false' } },
      require: name => fixtureRequire(name, String(file)) }, { filename: String(file) }); return exports; }
  documents.set(actorPath, { uid: actorUid, role: 'operator' }); documents.set(ownerPath, { uid: ownerUid });
  documents.set(requestPath, { ownerUid, requestType: 'DELETE', status: 'APPROVED' });
  documents.set(jobPath, { ownerUid, status: 'RUNNING', jobType: 'synthetic-source', payload: { private: 'synthetic data' } });
  documents.set(queuePath, { ownerUid, jobId: 'synthetic-job' }); documents.set(logPath, { message: 'synthetic private log' });
  const module = evaluate(process.env.JOBS_DELETION_SOURCE || new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url));
  const context = { auth: { uid: actorUid, token: {} }, rawRequest: { headers: { authorization: 'Bearer synthetic-current-token' }, get: name => name.toLowerCase() === 'authorization' ? 'Bearer synthetic-current-token' : undefined } };
  return { documents, state, call: () => module.processDataRightsRequest(input, context) };
}
const cases = [], test = (name, callback) => cases.push({ name, callback });
test('normal exact-owner deletion and truthful central privacy remainder', async () => {
  const h = harness(), result = await h.call();
  assert.equal(result.replay, false); assert.equal(h.documents.has(logPath), false); assert.equal(h.documents.has(queuePath), false);
  assert.match(h.documents.get(jobPath).ownerUid, /^deleted:/); assert.equal(h.documents.get(jobPath).payload, undefined);
  assert.ok(result.receipt.result.unresolvedDomains.includes('firebase-auth-account')); assert.notEqual(h.documents.get(requestPath).status, 'COMPLETED');
  const replay = await h.call(); assert.equal(replay.replay, true);
});
for (const [name, options] of [['hard-off', { mode: '' }], ['foreign-project', { allowedProject: 'foreign-project' }], ['production-forbidden', { production: 'true' }]]) {
  test(name, async () => { const h = harness(options); await assert.rejects(h.call()); assert.equal(h.documents.has(logPath), true); assert.equal(h.documents.get(jobPath).ownerUid, ownerUid); });
}
for (const reason of ['cancelled', 'subject', 'foreign-attempt', 'expired', 'token', 'role', 'disabled', 'actor']) {
  test(`withdrawal during awaited log page: ${reason}`, async () => {
    const h = harness(); h.state.onQuery = async path => { if (path !== `${jobPath}/logs`) return; h.state.onQuery = null;
      if (reason === 'cancelled') h.documents.get(requestPath).status = 'CANCELLED';
      if (reason === 'subject') h.documents.get(requestPath).ownerUid = 'synthetic-foreign-owner';
      if (reason === 'foreign-attempt') [...h.documents].find(([key]) => /\/audit\/execution-/.test(key))[1].leaseToken = 'synthetic-successor';
      if (reason === 'expired') h.state.now += 180001;
      if (reason === 'token') h.state.revoked = true;
      if (reason === 'role') h.documents.get(actorPath).role = 'user';
      if (reason === 'disabled') h.state.disabled = true;
      if (reason === 'actor') h.state.verifiedUid = 'synthetic-foreign-operator';
    };
    await assert.rejects(h.call()); assert.equal(h.documents.has(logPath), true);
    assert.equal(h.documents.get(jobPath).ownerUid, ownerUid); assert.equal(h.documents.has(queuePath), true);
  });
}
test('foreign job after awaited log query retains its logs', async () => {
  const h = harness(); h.state.onQuery = async path => { if (path !== `${jobPath}/logs`) return; h.state.onQuery = null; h.documents.get(jobPath).ownerUid = 'synthetic-foreign-owner'; };
  await assert.rejects(h.call()); assert.equal(h.documents.has(logPath), true); assert.equal(h.documents.get(jobPath).ownerUid, 'synthetic-foreign-owner');
});
for (const reason of ['foreign-job', 'foreign-queue', 'cancelled', 'role', 'token']) {
  test(`withdrawal during awaited queue read: ${reason}`, async () => {
    const h = harness(); const mutate = path => { if (path !== queuePath) return; h.state.onRead = null; h.state.onTransactionRead = null;
      if (reason === 'foreign-job') h.documents.get(jobPath).ownerUid = 'synthetic-foreign-owner';
      if (reason === 'foreign-queue') h.documents.get(queuePath).ownerUid = 'synthetic-foreign-owner';
      if (reason === 'cancelled') h.documents.get(requestPath).status = 'CANCELLED';
      if (reason === 'role') h.documents.get(actorPath).role = 'user';
      if (reason === 'token') h.state.revoked = true;
    }; h.state.onRead = mutate; h.state.onTransactionRead = mutate;
    await assert.rejects(h.call()); assert.equal(h.documents.has(queuePath), true); assert.equal(h.documents.get(jobPath).payload.private, 'synthetic data');
    if (reason === 'foreign-job') assert.equal(h.documents.get(jobPath).ownerUid, 'synthetic-foreign-owner');
    else assert.equal(h.documents.get(jobPath).ownerUid, ownerUid);
  });
}
test('no owner profile recreation after central removal', async () => {
  const h = harness(); h.state.onPrivateDelete = async () => h.documents.delete(ownerPath);
  const result = await h.call(); assert.equal(h.documents.has(ownerPath), false); assert.equal(result.receipt.result.profilePendingMarkerApplied, false);
});
test('foreign replacement profile is not marked for deletion', async () => {
  const h = harness(); h.state.onPrivateDelete = async () => h.documents.set(ownerPath, { uid: 'synthetic-foreign-owner' });
  await assert.rejects(h.call()); assert.deepEqual(h.documents.get(ownerPath), { uid: 'synthetic-foreign-owner' });
});
test('902 logs remain bounded and continue across pages', async () => {
  const h = harness(); h.documents.delete(logPath);
  for (let index = 0; index < 902; index++) h.documents.set(`${jobPath}/logs/synthetic_${String(index).padStart(4, '0')}`, { message: 'synthetic log' });
  const result = await h.call(); assert.equal(result.receipt.result.logDeletes, 902); assert.ok(h.state.maxWrites <= 450);
});
test('same-owner log correction during awaited page remains preserved', async () => {
  const h = harness(); h.state.onQuery = async path => { if (path !== `${jobPath}/logs`) return; h.state.onQuery = null; h.documents.get(logPath).message = 'synthetic corrected log'; };
  await assert.rejects(h.call()); assert.equal(h.documents.get(logPath).message, 'synthetic corrected log');
});
for (const reason of ['request', 'role']) test(`operator withdrawal during awaited target read prevents cancellation: ${reason}`, async () => {
  const h = harness(); h.state.onTransactionRead = async path => { if (path !== jobPath) return; h.state.onTransactionRead = null;
    if (reason === 'request') h.documents.get(requestPath).status = 'CANCELLED'; else h.documents.get(actorPath).role = 'user';
  };
  await assert.rejects(h.call()); assert.equal(h.documents.get(jobPath).status, 'RUNNING'); assert.equal(h.documents.has(logPath), true);
});
let passed = 0, failed = 0;
for (const entry of cases) { try { await entry.callback(); passed++; console.log(`[PASS] ${entry.name}`); }
  catch (error) { failed++; console.log(`[FAIL] ${entry.name}: ${error.message}`); } }
console.log(JSON.stringify({ kind: 'actual-Jobs-executor-and-auth-wrapper-source-with-explicit-Firebase-adapters', node: process.version,
  typescript: ts.version, zod: require('zod/package.json').version, passed, failed, loadedFunctions: false,
  privateLifeModelLoaded: false, capturedRealityEngineLoaded: false, deployedRuntime: false, providerCalls: 0 }));
if (failed) process.exitCode = 1;
