import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
function compile(relative, imports, extra = '', environment = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), 'utf8') + extra;
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(output, {
    exports, require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected source dependency: ${name}`);
      return imports[name];
    },
    process: { env: environment }, Date, Set, Promise,
    console: { log() {}, warn() {}, error() {} },
  });
  return exports;
}

// The two production handlers execute unchanged. This local adapter models
// pessimistic document locks and forces their first reads to overlap; it does
// not import Firebase, send network requests, or claim emulator/cloud proof.
function fixture() {
  const jobId = 'synthetic-contention-job', token = 'synthetic-current-lease';
  const jobPath = `jobs/${jobId}`, queuePath = `jobQueue/${jobId}`;
  const docs = new Map([
    [jobPath, {
      jobId, type: 'narrator.tts', jobType: 'narrator.tts', ownerUid: 'synthetic-owner',
      status: 'LEASED', retryCount: 0, lease: { leaseToken: token },
      execution: { attemptCount: 0, maxAttempts: 3 }, payload: { text: 'Synthetic queue input.' },
    }],
    [queuePath, { jobId, status: 'LEASED', retryCount: 0, lease: { leaseToken: token } }],
  ]);
  const deletion = Symbol('local-delete'), owners = new Map(), waitingFor = new Map(), waiters = new Map();
  let transactionId = 0, firstReaders = 0, openFirstReads, workerRequests = 0;
  const firstReads = new Promise(resolve => { openFirstReads = resolve; });
  const snapshot = key => ({ exists: docs.has(key), data: () => structuredClone(docs.get(key)) });
  const reference = key => ({ path: key, get: async () => snapshot(key), collection: () => ({ add: async () => {} }) });
  function release(id) {
    waitingFor.delete(id);
    for (const [key, owner] of owners) {
      if (owner !== id) continue;
      owners.delete(key);
      for (const resume of waiters.get(key) || []) resume();
      waiters.delete(key);
    }
  }
  async function acquire(id, key) {
    while (owners.has(key) && owners.get(key) !== id) {
      waitingFor.set(id, owners.get(key));
      let other = owners.get(key);
      const visited = new Set();
      while (other !== undefined && !visited.has(other)) {
        assert.notEqual(other, id, 'Synthetic pessimistic transaction lock cycle');
        visited.add(other); other = waitingFor.get(other);
      }
      await new Promise(resolve => {
        const pending = waiters.get(key) || [];
        pending.push(resolve); waiters.set(key, pending);
      });
    }
    waitingFor.delete(id); owners.set(key, id);
  }
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
    doc: reference,
    async runTransaction(run) {
      const id = ++transactionId, writes = [];
      let reads = 0;
      try {
        const result = await run({
          async get(ref) {
            assert.equal(writes.length, 0, 'Reads must precede transaction writes');
            const index = reads++;
            if (id <= 2 && index === 0) {
              firstReaders++;
              if (firstReaders === 2) openFirstReads();
            } else if (id <= 2) await firstReads;
            await acquire(id, ref.path);
            if (id <= 2 && index === 0) await firstReads;
            return snapshot(ref.path);
          },
          update(ref, values) { writes.push(() => apply(ref, values)); },
          set(ref, values, options) { writes.push(() => apply(ref, values, options?.merge)); },
        });
        for (const write of writes) write();
        return result;
      } finally { release(id); }
    },
  };
  const guards = compile('functions/src/jobs/executionGuards.ts', {});
  const routing = compile('functions/src/core/runtimeJobTypes.ts', {});
  const imports = {
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: {
      serverTimestamp: () => new Date(), delete: () => deletion, increment: amount => ({ increment: amount }),
    }, Timestamp: { now: () => new Date(), fromMillis: value => new Date(value) } },
    'firebase-functions/v2/scheduler': { onSchedule: (_options, run) => run },
    'firebase-functions/v2/pubsub': { onMessagePublished: (_options, run) => run },
    'firebase-functions/params': { defineSecret: () => ({ value: () => 'synthetic-worker-token' }) },
    '@google-cloud/pubsub': { PubSub: class {} },
    ulid: { ulid: () => 'synthetic-tick' }, zod: require('zod'),
    axios: { async post() { workerRequests++; return { status: 200, data: { ok: true, fixture: true } }; } },
    '../core/firestore-paths.js': { jobDoc: id => reference(`jobs/${id}`), jobQueueEntryDoc: id => reference(`jobQueue/${id}`) },
    './executionGuards.js': guards, '../core/runtimeJobTypes.js': routing,
    '../privacy/consentBlocks.js': { isConsentContext: () => false, consentBlockRef() { throw new Error('No consent fixture'); } },
    '../providers/tinyfish.js': { isTinyFishJobType: () => false, tinyFishApiKeySecret: {}, executeTinyFishJob() { throw new Error('Provider execution prohibited'); } },
    '../privacy/privateLifeModelDataRights.js': { canFinalizePrivateSource() { throw new Error('Private source execution prohibited'); } },
    'node:crypto': require('node:crypto'),
  };
  const tick = compile('functions/src/jobs/processQueueTick.ts', imports, '\nexport { recordDispatchPublished };');
  const executor = compile('functions/src/jobs/executeJob.ts', imports, '', {
    URAI_ENV: 'staging', URAI_JOBS_WORKER_TOKEN: 'synthetic-worker-token',
    NARRATOR_WORKER_URL: 'https://synthetic-worker.invalid',
  });
  return {
    receipt: () => tick.recordDispatchPublished(db, jobId, token),
    execute: () => executor.executeJob({ data: { message: { json: { jobId, leaseToken: token } } } }),
    job: () => docs.get(jobPath), queue: () => docs.get(queuePath),
    requests: () => workerRequests, locks: () => owners.size,
  };
}

for (const first of ['receipt', 'execute']) {
  test(`publication receipt and execution overlap (${first} first) without a lock cycle or duplicate attempt`, async () => {
    const f = fixture();
    const second = first === 'receipt' ? 'execute' : 'receipt';
    await assert.doesNotReject(Promise.all([f[first](), f[second]() ]));
    assert.equal(f.job().status, 'SUCCESS');
    assert.equal(f.queue().status, 'DONE');
    assert.equal(f.job().execution.attemptCount, 1);
    assert.equal(f.requests(), 1);
    assert.equal(f.locks(), 0);
  });
}
