import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Actual exported source; Firebase Auth/Firestore/PubSub are explicit local
// interfaces. No deployed service, bearer credential or private source is used.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRef = process.argv.find(value => value.startsWith('--source-ref='))?.slice('--source-ref='.length);
if (sourceRef) assert.match(sourceRef, /^[a-f0-9]{40}$/);
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const deleted = Symbol('local-delete');
const fieldValue = { serverTimestamp: () => new Date(), delete: () => deleted, increment: amount => ({ increment: amount }) };

function harness({ operator = true, own = false, status = 'FAILED', afterRead } = {}) {
  const uid = 'synthetic-actor', jobId = 'synthetic-managed-job';
  const claims = operator ? { role: 'operator', roles: ['operator'] } : {};
  const state = {
    uid, jobId, claims: structuredClone(claims), decoded: { uid, ...structuredClone(claims) },
    live: { uid, disabled: false, customClaims: structuredClone(claims) },
    tokenRejected: false, liveMissing: false, verifies: 0, authReads: 0, publishes: 0, reads: [], writes: 0, afterRead,
  };
  const docs = new Map([
    ['users/' + uid, { uid, role: operator ? 'operator' : 'user', disabled: false }],
    ['jobs/' + jobId, { jobId, ownerUid: own ? uid : 'synthetic-other-owner', status, retryCount: 0, payload: { text: 'synthetic-private-fixture' } }],
    ['jobs/' + jobId + '/logs/log', { createdAt: new Date(), message: 'synthetic-log' }],
    ['jobQueue/' + jobId, { jobId, status, availableAt: new Date(Date.now() - 60000) }],
  ]);
  state.docs = docs;
  function snapshot(key) {
    state.reads.push(key); const copy = structuredClone(docs.get(key));
    const snap = { id: key.split('/').at(-1), exists: docs.has(key), data: () => copy, ref: ref(key) };
    state.afterRead?.(state, key); return snap;
  }
  function ref(key) { return { path: key, get: async () => snapshot(key), collection: name => collection(key + '/' + name) }; }
  function collection(key) {
    const conditions = []; let count = Infinity;
    const query = {
      path: key, doc: id => ref(key + '/' + id),
      where(field, op, value) { conditions.push({ field, op, value }); return query; },
      orderBy() { return query; }, limit(value) { count = value; return query; },
      async add(value) { docs.set(key + '/new-log', structuredClone(value)); state.writes++; },
      async get() {
        const keys = [...docs.keys()].filter(p => p.startsWith(key + '/') && !p.slice(key.length + 1).includes('/'))
          .filter(p => conditions.every(c => c.op === '==' ? docs.get(p)[c.field] === c.value : docs.get(p)[c.field] <= c.value)).slice(0, count);
        const result = { docs: keys.map(snapshot), size: keys.length, empty: keys.length === 0 };
        state.afterRead?.(state, key); return result;
      },
    }; return query;
  }
  function apply(reference, values) {
    const record = structuredClone(docs.get(reference.path) || {});
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split('.'); let current = record;
      for (const part of parts.slice(0, -1)) current = current[part] ||= {};
      const end = parts.at(-1);
      if (value === deleted) delete current[end];
      else if (value?.increment !== undefined) current[end] = (current[end] || 0) + value.increment;
      else current[end] = structuredClone(value);
    }
    docs.set(reference.path, record); state.writes++;
  }
  const db = {
    collection, doc: ref,
    async runTransaction(run) {
      const writes = [];
      const result = await run({
        async get(reference) { assert.equal(writes.length, 0, 'all transactional reads precede writes'); return reference.get(); },
        set(reference, value) { writes.push(() => apply(reference, value)); },
        update(reference, value) { writes.push(() => apply(reference, value)); },
      });
      for (const write of writes) write(); return result;
    },
  };
  const imports = {
    'firebase-admin/app': { getApps: () => [{}] },
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: fieldValue },
    'firebase-admin/auth': { getAuth: () => ({
      async verifyIdToken(token, revoked) { state.verifies++; assert.equal(token, 'synthetic-token'); assert.equal(revoked, true); if (state.tokenRejected) throw new Error('synthetic-revoked'); return structuredClone(state.decoded); },
      async getUser(subject) { state.authReads++; assert.equal(subject, uid); if (state.liveMissing) throw new Error('synthetic-deleted'); return structuredClone(state.live); },
    }) },
    'firebase-functions/v1': { https: { HttpsError, onCall: run => run } },
    'firebase-functions/v2/https': { HttpsError, onCall: (_options, run) => run },
    zod: require('zod'), ulid: { ulid: () => 'synthetic-generated-id' },
    '@google-cloud/pubsub': { PubSub: class { topic() { return { async publishMessage() { state.publishes++; return 'synthetic-publication'; } }; } } },
  };
  const compiled = new Map();
  function load(relative) {
    if (compiled.has(relative)) return compiled.get(relative);
    if (relative === 'functions/src/core/errors.ts') return { httpsError: (code, message) => new HttpsError(code, message) };
    if (relative === 'functions/src/core/firestore-paths.ts') return { userDoc: subject => ref('users/' + subject), jobDoc: id => ref('jobs/' + id), jobQueueEntryDoc: id => ref('jobQueue/' + id) };
    if (relative === 'functions/src/core/dispatchRecovery.ts') return { returnLeaseAfterPublishFailure: async () => { throw new Error('Unexpected dispatch recovery'); } };
    const exports = {}; compiled.set(relative, exports);
    const source = sourceRef ? execFileSync('git', ['show', sourceRef + ':' + relative], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relative), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(output, { exports, Date, Set, Promise, process: { env: {} }, console: { log() {}, error() {}, warn() {} },
      require(name) {
        if (Object.hasOwn(imports, name)) return imports[name];
        if (name.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(relative), name.replace(/\.js$/, '.ts'))));
        if (name === 'node:crypto') return require(name);
        throw new Error('Unexpected source import: ' + name);
      },
    }); return exports;
  }
  const request = { auth: { uid, token: state.claims }, data: { jobId, limit: 10 }, rawRequest: { headers: { authorization: 'Bearer synthetic-token' } } };
  const routes = {
    getJob: ['getJob.ts', 'getJob'], getJobStatus: ['getJobStatus.ts', 'getJobStatus', true],
    cancelJob: ['cancelJob.ts', 'cancelJob'], listJobs: ['admin.ts', 'listJobs', true],
    listJobLogs: ['admin.ts', 'listJobLogs', true], retryJob: ['admin.ts', 'retryJob', true],
    listJobsV2: ['admin-v2.ts', 'listJobsV2'], listJobLogsV2: ['admin-v2.ts', 'listJobLogsV2'], retryJobV2: ['admin-v2.ts', 'retryJobV2'],
    processQueueNow: ['processQueueNow.ts', 'processQueueNow'],
  };
  return { state, request, routes, job: () => docs.get('jobs/' + jobId), profile: () => docs.get('users/' + uid),
    async call(name) { const [file, exported, v1] = routes[name]; const fn = load('functions/src/jobs/' + file)[exported]; return v1 ? fn(request.data, { auth: request.auth, rawRequest: request.rawRequest }) : fn(request); },
  };
}

for (const route of ['getJob', 'getJobStatus', 'cancelJob']) {
  test(`${route} retains an active owner's ordinary path`, async () => {
    const f = harness({ operator: false, own: true, status: 'PENDING' });
    const result = await f.call(route); assert.ok(result); if (route === 'cancelJob') assert.equal(f.job().status, 'CANCELLED');
  });
}
for (const route of ['listJobs', 'listJobLogs', 'retryJob', 'listJobsV2', 'listJobLogsV2', 'retryJobV2', 'processQueueNow']) {
  test(`${route} retains a current protected operator`, async () => { const f = harness({ status: route === 'processQueueNow' ? 'PENDING' : 'FAILED' }); assert.ok(await f.call(route)); });
}
for (const route of ['getJob', 'getJobStatus', 'cancelJob', 'listJobs', 'listJobLogs', 'retryJob', 'listJobsV2', 'listJobLogsV2', 'retryJobV2', 'processQueueNow']) {
  for (const failure of ['live-disabled', 'live-deleted', 'token-revoked', 'profile-disabled', 'profile-deleted', 'profile-missing']) {
    test(`${route} denies ${failure} before disclosure or mutation`, async () => {
      const f = harness({ own: true, status: route === 'cancelJob' || route === 'processQueueNow' ? 'PENDING' : 'FAILED' });
      if (failure === 'live-disabled') f.state.live.disabled = true;
      if (failure === 'live-deleted') f.state.liveMissing = true;
      if (failure === 'token-revoked') f.state.tokenRejected = true;
      if (failure === 'profile-disabled') f.profile().disabled = true;
      if (failure === 'profile-deleted') f.profile().deleted = true;
      if (failure === 'profile-missing') f.state.docs.delete('users/' + f.state.uid);
      await assert.rejects(f.call(route), error => ['unauthenticated', 'permission-denied'].includes(error.code));
      assert.equal(f.state.writes, 0); assert.equal(f.state.publishes, 0);
    });
  }
}
for (const route of ['getJob', 'cancelJob', 'listJobs', 'listJobLogs', 'retryJob', 'listJobsV2', 'listJobLogsV2', 'retryJobV2', 'processQueueNow']) {
  for (const failure of ['live-role-downgrade', 'protected-role-downgrade']) {
    test(`${route} denies stale operator claims after ${failure}`, async () => {
      const f = harness({ status: route === 'cancelJob' || route === 'processQueueNow' ? 'PENDING' : 'FAILED' });
      if (failure === 'live-role-downgrade') f.state.live.customClaims = {};
      else f.profile().role = 'user';
      await assert.rejects(f.call(route), error => error.code === 'permission-denied');
      assert.equal(f.state.writes, 0); assert.equal(f.state.publishes, 0);
    });
  }
}
for (const route of ['getJob', 'getJobStatus', 'cancelJob', 'listJobs', 'listJobLogs', 'retryJob', 'listJobsV2', 'listJobLogsV2', 'retryJobV2', 'processQueueNow']) {
  for (const failure of ['foreign-profile-uid', 'foreign-live-uid', 'foreign-decoded-uid', 'missing-bearer', 'malformed-disabled', 'suspended-profile', 'unknown-status']) {
    test(`${route} denies incoherent ${failure} authority`, async () => {
      const f = harness({ own: true, status: route === 'cancelJob' || route === 'processQueueNow' ? 'PENDING' : 'FAILED' });
      if (failure === 'foreign-profile-uid') f.profile().uid = 'synthetic-foreign';
      if (failure === 'foreign-live-uid') f.state.live.uid = 'synthetic-foreign';
      if (failure === 'foreign-decoded-uid') f.state.decoded.uid = 'synthetic-foreign';
      if (failure === 'missing-bearer') delete f.request.rawRequest.headers.authorization;
      if (failure === 'malformed-disabled') f.profile().disabled = 'false';
      if (failure === 'suspended-profile') f.profile().suspended = true;
      if (failure === 'unknown-status') f.profile().status = 'unknown';
      await assert.rejects(f.call(route), error => ['unauthenticated', 'permission-denied'].includes(error.code));
      assert.equal(f.state.writes, 0); assert.equal(f.state.publishes, 0);
    });
  }
  for (const failure of ['live-disabled', 'protected-role-downgrade']) {
    test(`${route} rechecks ${failure} after awaited job data`, async () => {
      const f = harness({ status: route === 'cancelJob' || route === 'processQueueNow' ? 'PENDING' : 'FAILED',
        afterRead(state, key) {
          if (!(key === 'jobs' || key.startsWith('jobs/'))) return;
          if (failure === 'live-disabled') state.live.disabled = true;
          else state.docs.get('users/' + state.uid).role = 'user';
        },
      });
      await assert.rejects(f.call(route), error => ['unauthenticated', 'permission-denied'].includes(error.code));
      assert.equal(f.state.writes, 0); assert.equal(f.state.publishes, 0);
    });
  }
}
