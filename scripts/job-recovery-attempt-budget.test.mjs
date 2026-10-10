import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Exercise the actual scheduler and dispatcher source with explicit local
// Firestore/transport adapters. This is not deployed or emulator acceptance.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const baselineArg = process.argv.find(value => value.startsWith('--baseline-root='));
const baselineRoot = baselineArg?.slice('--baseline-root='.length);
function source(relative) {
  const baseline = baselineRoot && path.join(baselineRoot, relative);
  return fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : path.join(root, relative), 'utf8');
}
function compile(relative, imports, environment = {}) {
  const exports = {};
  const output = ts.transpileModule(source(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(output, {
    exports, require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected source dependency: ${name}`);
      return imports[name];
    }, process: { env: environment }, Date, Set, Promise,
    console: { log() {}, warn() {}, error() {} },
  });
  return exports;
}
const guards = compile('functions/src/jobs/executionGuards.ts', {});
const routing = compile('functions/src/core/runtimeJobTypes.ts', {});
const deletion = Symbol('explicit-local-delete');
const fieldValue = {
  serverTimestamp: () => new Date(), delete: () => deletion,
  increment: amount => ({ increment: amount }),
};

function harness({ status = 'RUNNING', patch = {}, beforeTransaction, responseStatus = 200, afterDispatch } = {}) {
  const token = 'synthetic-current-lease';
  const job = {
    jobId: 'synthetic-recovery-job', type: 'narrator.tts', jobType: 'narrator.tts',
    ownerUid: 'synthetic-owner', tenantId: 'synthetic-tenant', status, retryCount: 0,
    lease: { leaseToken: token, heartbeatAt: new Date(Date.now() - 20 * 60 * 1000), expiresAt: new Date(Date.now() - 60 * 1000) },
    execution: { attemptCount: status === 'LEASED' ? 0 : 1, maxAttempts: 3, ...(status === 'RUNNING' ? { leaseToken: token } : {}) },
    payload: { text: 'synthetic-narration' }, ...structuredClone(patch),
  };
  const docs = new Map([
    ['jobs/' + job.jobId, job],
    ['jobQueue/' + job.jobId, { jobId: job.jobId, status, retryCount: 0, lease: structuredClone(job.lease) }],
  ]);
  const state = { docs, requests: 0, transactionWrites: 0, logs: [], beforeTransaction };
  const snapshot = name => ({ id: name.split('/').at(-1), exists: docs.has(name), data: () => structuredClone(docs.get(name)) });
  const reference = name => ({ path: name, get: async () => snapshot(name), collection: () => ({ add: async value => state.logs.push(value) }) });
  const collection = name => {
    const conditions = [];
    const query = {
      doc: id => reference(name + '/' + id),
      where(field, operator, expected) { conditions.push({ field, operator, expected }); return query; },
      orderBy() { return query; }, limit() { return query; },
      async get() {
        const selected = [...docs.keys()].filter(key => key.startsWith(name + '/') && !key.slice(name.length + 1).includes('/'))
          .filter(key => conditions.every(({ field, operator, expected }) => {
            const actual = field.split('.').reduce((value, part) => value?.[part], docs.get(key));
            if (operator === '==') return actual === expected;
            if (operator === '<') return actual < expected;
            if (operator === '<=') return actual <= expected;
            throw new Error('Unexpected query operator');
          })).map(snapshot);
        return { docs: selected, empty: selected.length === 0, size: selected.length };
      },
    };
    return query;
  };
  function apply(ref, values, merge = true) {
    const value = merge ? structuredClone(docs.get(ref.path) || {}) : {};
    for (const [field, next] of Object.entries(values)) {
      const parts = field.split('.'); let target = value;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      const last = parts.at(-1);
      if (next === deletion) delete target[last];
      else if (next && typeof next === 'object' && Object.hasOwn(next, 'increment')) target[last] = (target[last] || 0) + next.increment;
      else target[last] = structuredClone(next);
    }
    docs.set(ref.path, value);
  }
  const db = {
    collection, doc: reference,
    async runTransaction(run) {
      if (state.beforeTransaction) { const change = state.beforeTransaction; state.beforeTransaction = undefined; change(state); }
      const writes = [];
      const result = await run({
        async get(ref) { assert.equal(writes.length, 0, 'Firestore reads must precede writes'); return snapshot(ref.path); },
        update(ref, value) { assert.ok(docs.has(ref.path), 'update must target an existing document'); writes.push(() => apply(ref, value)); },
        set(ref, value, options) { writes.push(() => apply(ref, value, options?.merge)); },
      });
      state.transactionWrites += writes.length;
      for (const write of writes) write();
      return result;
    },
  };
  const imports = {
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: fieldValue, Timestamp: { now: () => new Date(), fromMillis: value => new Date(value) } },
    'firebase-functions/v1': { pubsub: { schedule: () => ({ onRun: run => run }) } },
    'firebase-functions/v2/scheduler': { onSchedule: (_schedule, run) => run },
    'firebase-functions/v2/pubsub': { onMessagePublished: (_options, run) => run },
    'firebase-functions/params': { defineSecret: () => ({ value: () => 'synthetic-worker-token' }) },
    ulid: { ulid: () => 'synthetic-recovery-tick' },
    zod: require('zod'),
    axios: { async post() {
      state.requests++;
      if (afterDispatch) afterDispatch(state);
      if (responseStatus >= 400) throw new Error('synthetic-transport-failure');
      return { status: responseStatus, data: { ok: true, fixture: 'synthetic-worker-result' } };
    } },
    '../core/firestore-paths.js': { jobDoc: id => reference('jobs/' + id), jobQueueEntryDoc: id => reference('jobQueue/' + id), jobsCollection: () => collection('jobs') },
    './executionGuards.js': guards,
    '../core/runtimeJobTypes.js': routing,
    '../providers/tinyfish.js': { isTinyFishJobType: () => false, tinyFishApiKeySecret: {}, executeTinyFishJob() { throw new Error('Provider execution prohibited'); } },
    '../privacy/privateLifeModelDataRights.js': { async canFinalizePrivateSource() { throw new Error('Private source execution prohibited'); } },
    'node:crypto': require('node:crypto'),
  };
  imports['../privacy/consentBlocks.js'] = compile('functions/src/privacy/consentBlocks.ts', imports);
  const environment = { URAI_ENV: 'staging', URAI_JOBS_WORKER_TOKEN: 'synthetic-worker-token', NARRATOR_WORKER_URL: 'https://synthetic-worker.invalid' };
  return {
    state, token, jobPath: 'jobs/' + job.jobId, queuePath: 'jobQueue/' + job.jobId,
    job: () => docs.get('jobs/' + job.jobId), queue: () => docs.get('jobQueue/' + job.jobId),
    reconcile: () => compile('functions/src/jobs/systemReconcile.ts', imports).systemReconcile(),
    recoverLease: () => compile('functions/src/jobs/retryExpiredLeases.ts', imports).retryExpiredLeases(),
    dispatch: () => compile('functions/src/jobs/executeJob.ts', imports, environment).executeJob({ data: { message: { json: { jobId: job.jobId, leaseToken: token } } } }),
  };
}

function assertDead(f) {
  assert.equal(f.job().status, 'DEAD'); assert.equal(f.queue().status, 'DEAD');
  assert.equal(f.job().lease, undefined); assert.equal(f.queue().lease, undefined);
}

for (const [maxAttempts, attemptCount] of [[1, 1], [2, 2], [3, 3], [5, 5]]) {
  test(`stale RUNNING respects ${attemptCount}/${maxAttempts} started attempts`, async () => {
    const f = harness({ patch: { execution: { leaseToken: 'synthetic-current-lease', attemptCount, maxAttempts } } });
    await f.reconcile(); assertDead(f);
    assert.equal(f.job().execution.leaseToken, undefined); assert.ok(f.job().completedAt instanceof Date);
  });
}
test('stale RUNNING below budget requeues both records with one retry and unchanged started count', async () => {
  const f = harness({ patch: { execution: { leaseToken: 'synthetic-current-lease', attemptCount: 2, maxAttempts: 3 } } });
  await f.reconcile();
  assert.equal(f.job().status, 'PENDING'); assert.equal(f.queue().status, 'PENDING');
  assert.equal(f.job().retryCount, 1); assert.equal(f.queue().retryCount, 1);
  assert.equal(f.job().execution.attemptCount, 2); assert.equal(f.job().execution.leaseToken, undefined);
  assert.equal(guards.canFinalizeExecution(f.job(), f.token), false);
});
test('stale RUNNING recovery aligns a divergent queue counter with the master retry count', async () => {
  const f = harness(); f.queue().retryCount = 17;
  await f.reconcile(); assert.equal(f.job().retryCount, 1); assert.equal(f.queue().retryCount, 1);
});
test('retains the existing three-recovery limit even with remaining started attempts', async () => {
  const f = harness({ patch: { retryCount: 3, execution: { leaseToken: 'synthetic-current-lease', attemptCount: 1, maxAttempts: 10 } } });
  await f.reconcile(); assertDead(f);
});

const malformedPolicies = [
  { attemptCount: -1, maxAttempts: 3 }, { attemptCount: 0, maxAttempts: 3 },
  { attemptCount: 1.5, maxAttempts: 3 }, { attemptCount: NaN, maxAttempts: 3 },
  { attemptCount: '1', maxAttempts: 3 }, { attemptCount: 1, maxAttempts: 0 },
  { attemptCount: 1, maxAttempts: -1 }, { attemptCount: 1, maxAttempts: 1.5 },
  { attemptCount: 1, maxAttempts: '3' }, { attemptCount: 1, maxAttempts: Infinity },
  { attemptCount: null, maxAttempts: 3 }, { attemptCount: 1, maxAttempts: null },
];
for (const [index, execution] of malformedPolicies.entries()) {
  test(`malformed RUNNING attempt policy ${index} cannot enqueue more work`, async () => {
    const f = harness({ patch: { execution: { leaseToken: 'synthetic-current-lease', ...execution } } });
    await f.reconcile(); assertDead(f);
  });
}
for (const retryCount of [-1, 0.5, NaN, '0', null]) {
  test(`malformed RUNNING recovery count ${String(retryCount)} fails closed`, async () => {
    const f = harness({ patch: { retryCount } }); await f.reconcile(); assertDead(f);
  });
}

for (const mutation of ['execution-lease', 'queue-lease', 'heartbeat', 'terminal']) {
  test(`stale query cannot overwrite a newer ${mutation} at transaction time`, async () => {
    const f = harness({ beforeTransaction(state) {
      const job = state.docs.get('jobs/synthetic-recovery-job');
      const queue = state.docs.get('jobQueue/synthetic-recovery-job');
      if (mutation === 'execution-lease') job.execution.leaseToken = 'synthetic-new-lease';
      if (mutation === 'queue-lease') queue.lease.leaseToken = 'synthetic-new-lease';
      if (mutation === 'heartbeat') job.lease.heartbeatAt = new Date();
      if (mutation === 'terminal') { job.status = 'CANCELLED'; queue.status = 'CANCELLED'; }
    } });
    await f.reconcile(); assert.equal(f.state.transactionWrites, 0);
  });
}
test('unexpired exact callback survives a stale heartbeat at the final allowed attempt', async () => {
  const f = harness({ patch: { execution: {
    leaseToken: 'synthetic-current-lease', attemptCount: 1, maxAttempts: 1,
    asyncCallbackPending: true, callbackLeaseToken: 'synthetic-current-lease', callbackDeadlineAt: new Date(Date.now() + 60000),
  } } });
  await f.reconcile(); assert.equal(f.job().status, 'RUNNING'); assert.equal(f.state.transactionWrites, 0);
});
test('expired callback reaches DEAD when started-attempt budget is exhausted', async () => {
  const f = harness({ patch: { execution: {
    leaseToken: 'synthetic-current-lease', attemptCount: 1, maxAttempts: 1,
    asyncCallbackPending: true, callbackLeaseToken: 'synthetic-current-lease', callbackDeadlineAt: new Date(Date.now() - 1),
  } } });
  await f.reconcile(); assertDead(f); assert.equal(f.job().execution.asyncCallbackPending, false);
});

test('expired unstarted lease does not consume a started execution attempt', async () => {
  const f = harness({ status: 'LEASED', patch: { execution: { attemptCount: 0, maxAttempts: 1 } } });
  await f.recoverLease(); assert.equal(f.job().status, 'PENDING'); assert.equal(f.job().execution.attemptCount, 0);
  assert.equal(f.job().retryCount, 1); assert.equal(f.queue().retryCount, 1);
});
test('expired unstarted lease cannot revive an exhausted started-attempt budget', async () => {
  const f = harness({ status: 'LEASED', patch: { execution: { attemptCount: 2, maxAttempts: 2 } } });
  await f.recoverLease(); assertDead(f);
});
for (const patch of [{ retryCount: NaN }, { retryCount: -1 }, { retryCount: '0' }, { execution: { attemptCount: 0, maxAttempts: 0 } }]) {
  test(`malformed expired LEASED policy ${JSON.stringify(patch)} fails closed`, async () => {
    const f = harness({ status: 'LEASED', patch }); await f.recoverLease(); assertDead(f);
  });
}

for (const [attemptCount, maxAttempts] of [[1, 1], [2, 2], [3, 3], [0, 0], [-1, 3], [0, '3']]) {
  test(`dispatcher refuses exhausted/invalid ${attemptCount}/${maxAttempts} before worker transport`, async () => {
    const f = harness({ status: 'LEASED', patch: { execution: { attemptCount, maxAttempts } } });
    await f.dispatch(); assert.equal(f.state.requests, 0); assertDead(f);
  });
}
test('dispatcher admits the final allowed attempt exactly once', async () => {
  const f = harness({ status: 'LEASED', patch: { execution: { attemptCount: 1, maxAttempts: 2 } } });
  await f.dispatch(); assert.equal(f.state.requests, 1); assert.equal(f.job().status, 'SUCCESS');
  assert.equal(f.job().execution.attemptCount, 2);
});
for (const responseStatus of [200, 500]) {
  test(`legacy final attempt preserves consumed count after worker ${responseStatus}`, async () => {
    const f = harness({ status: 'LEASED', responseStatus, patch: { execution: {}, attempts: 2, maxAttempts: 3 } });
    await f.dispatch(); assert.equal(f.state.requests, 1);
    assert.equal(f.job().execution.attemptCount, 3);
    if (responseStatus === 200) assert.equal(f.job().status, 'SUCCESS');
    else assertDead(f);
  });
}
for (const mutation of ['queue-lease', 'queue-status', 'missing-queue']) {
  test(`dispatcher cannot overwrite ${mutation} while the master retains an old LEASED token`, async () => {
    const f = harness({ status: 'LEASED' });
    if (mutation === 'queue-lease') f.queue().lease.leaseToken = 'synthetic-new-lease';
    if (mutation === 'queue-status') f.queue().status = 'CANCELLED';
    if (mutation === 'missing-queue') f.state.docs.delete(f.queuePath);
    const before = structuredClone([...f.state.docs]);
    await f.dispatch(); assert.equal(f.state.requests, 0);
    assert.deepEqual([...f.state.docs], before); assert.equal(f.state.transactionWrites, 0);
  });
}
for (const responseStatus of [200, 202, 500]) {
  test(`late ${responseStatus} worker response cannot change a newer master lease`, async () => {
    const f = harness({ status: 'LEASED', responseStatus, afterDispatch(state) {
      state.docs.get('jobs/synthetic-recovery-job').lease.leaseToken = 'synthetic-new-lease';
      state.docs.get('jobQueue/synthetic-recovery-job').lease.leaseToken = 'synthetic-new-lease';
    } });
    await f.dispatch(); assert.equal(f.state.requests, 1); assert.equal(f.job().status, 'RUNNING');
    assert.equal(f.job().lease.leaseToken, 'synthetic-new-lease');
    assert.equal(f.queue().lease.leaseToken, 'synthetic-new-lease');
    assert.equal(f.job().result, undefined); assert.equal(f.job().output, undefined);
    assert.equal(f.job().retryCount, 0);
  });
  test(`late ${responseStatus} worker response cannot overwrite a queue-only replacement lease`, async () => {
    const f = harness({ status: 'LEASED', responseStatus, afterDispatch(state) {
      state.docs.get('jobQueue/synthetic-recovery-job').lease.leaseToken = 'synthetic-new-queue-lease';
    } });
    await f.dispatch(); assert.equal(f.state.requests, 1); assert.equal(f.job().status, 'RUNNING');
    assert.equal(f.job().lease.leaseToken, f.token);
    assert.equal(f.queue().lease.leaseToken, 'synthetic-new-queue-lease');
    assert.equal(f.job().result, undefined); assert.equal(f.job().output, undefined);
    assert.equal(f.job().retryCount, 0);
    if (responseStatus === 202) assert.equal(f.state.logs.some(log => log.message.startsWith('Worker accepted asynchronous')), false);
  });
}
