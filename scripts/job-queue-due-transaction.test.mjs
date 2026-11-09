import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = (name) => fs.readFileSync(new URL('../functions/src/jobs/' + name, import.meta.url), 'utf8');
function load(name, imports) {
  const code = ts.transpileModule(source(name), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(key) {
      assert.ok(Object.hasOwn(imports, key), 'Unexpected original source dependency: ' + key);
      return imports[key];
    },
    process: { env: {} }, Date, Promise,
    console: { log() {}, warn() {}, error() {} },
  }, { filename: name });
  return exports;
}
function fixture(mode) {
  const id = 'synthetic-due-owner-job', other = 'synthetic-due-other-job';
  const due = new Date(Date.now() - 30_000), future = new Date(Date.now() + 3_600_000);
  const documents = new Map([
    ['jobs/' + id, { jobId: id, ownerUid: 'synthetic-owner', status: 'PENDING' }],
    ['jobQueue/' + id, { jobId: id, status: 'PENDING', availableAt: due }],
    ['jobs/' + other, { jobId: other, ownerUid: 'synthetic-owner', status: 'PENDING' }],
    ['jobQueue/' + other, { jobId: other, status: 'PENDING', availableAt: due }],
  ]);
  let published = 0, transactions = 0, reads = 0;
  const ref = (path) => ({ path });
  const snapshot = (path) => ({
    exists: documents.has(path), id: path.split('/').at(-1),
    data: () => ({ ...documents.get(path) }),
  });
  const db = {
    collection(collection) {
      assert.equal(collection, 'jobQueue');
      return {
        where() { return this; }, orderBy() { return this; }, limit() { return this; },
        async get() {
          reads++;
          const selected = { ...documents.get('jobQueue/' + id) };
          // Query matched an old due row. Another transaction changes current
          // authority before either dispatcher attempts its lease.
          if (mode === 'deferred') documents.get('jobQueue/' + id).availableAt = future;
          if (mode === 'missing') delete documents.get('jobQueue/' + id).availableAt;
          if (mode === 'malformed') documents.get('jobQueue/' + id).availableAt = 'tomorrow';
          if (mode === 'bad-timestamp') documents.get('jobQueue/' + id).availableAt = { toMillis() { throw Error('bad Firestore timestamp'); } };
          if (mode === 'timestamp') documents.get('jobQueue/' + id).availableAt = { toMillis: () => due.getTime() };
          if (mode === 'foreign-query-row') selected.jobId = other;
          if (mode === 'foreign-current-row') documents.get('jobQueue/' + id).jobId = other;
          return { empty: false, size: 1, docs: [{ id, data: () => selected }] };
        },
      };
    },
    async runTransaction(operation) {
      transactions++;
      const writes = [];
      const result = await operation({
        get: async (reference) => snapshot(reference.path),
        update(reference, data) { writes.push([reference.path, data]); },
        set(reference, data) { writes.push([reference.path, data]); },
      });
      for (const [path, data] of writes) documents.set(path, { ...documents.get(path), ...data });
      return result;
    },
  };
  const firestore = {
    getFirestore: () => db,
    FieldValue: {
      serverTimestamp: () => new Date(),
      delete: () => null,
      increment: (amount) => amount,
    },
    Timestamp: { now: () => new Date(), fromMillis: (ms) => new Date(ms) },
  };
  const PubSub = class {
    topic() { return { async publishMessage() { published++; return 'synthetic-message'; } }; }
  };
  const guard = load('executionGuards.ts', {});
  const common = {
    'firebase-admin/firestore': firestore,
    '@google-cloud/pubsub': { PubSub },
    'ulid': { ulid: () => 'synthetic-ulid' },
    '../core/firestore-paths.js': { jobDoc: (jobId) => ref('jobs/' + jobId),
      jobQueueEntryDoc: (jobId) => ref('jobQueue/' + jobId) },
    '../privacy/consentBlocks.js': { isConsentContext: () => false,
      consentBlockRef: () => { throw Error('Unapproved consent fixture'); } },
    './executionGuards.js': guard,
  };
  const manual = load('processQueueNow.ts', {
    ...common,
    'firebase-functions/v2/https': { onCall: (_opts, handler) => handler },
    '../core/dispatchRecovery.js': {
      returnLeaseAfterPublishFailure: () => { throw Error('Not a publish failure test'); },
    },
    '../core/currentJobActor.js': {
      currentJobActor: async () => ({ uid: 'synthetic-operator' }),
      requireJobOperator: () => {},
    },
  }).processQueueNow;
  const scheduled = load('processQueueTick.ts', {
    ...common,
    'firebase-functions/v2/scheduler': { onSchedule: (_opts, handler) => handler },
  }).processQueueTick;
  return {
    manual, scheduled,
    metrics: () => ({ published, transactions, reads,
      queue: documents.get('jobQueue/' + id).status,
      foreignQueue: documents.get('jobQueue/' + other).status,
      master: documents.get('jobs/' + id).status,
      foreignMaster: documents.get('jobs/' + other).status }),
  };
}

const cases = [
  ['deferred', false],
  ['foreign-query-row', false],
  ['foreign-current-row', false],
  ['malformed', false],
  ['missing', false],
  ['bad-timestamp', false],
  ['still-due', true],
  ['timestamp', true],
];
for (const dispatch of ['manual', 'scheduled']) {
  for (const [mode, allowed] of cases) {
    test(dispatch + ' original handler ' + mode + ' enforces current queue due-time and identity', async () => {
      const f = fixture(mode);
      if (dispatch === 'manual') await f.manual({ data: { limit: 10 } });
      else await f.scheduled({});
      const m = f.metrics();
      assert.equal(m.reads, 1, 'one original Firestore due-work query was exercised');
      assert.equal(m.published, allowed ? 1 : 0, 'no early or foreign Pub/Sub message');
      assert.equal(m.queue, allowed ? 'LEASED' : 'PENDING', 'no unauthorized queue lease');
      assert.equal(m.master, allowed ? 'LEASED' : 'PENDING', 'no unauthorized master lease');
      assert.equal(m.foreignQueue, 'PENDING', 'foreign queue remains untouched');
      assert.equal(m.foreignMaster, 'PENDING', 'foreign job remains untouched');
    });
  }
}
test('current due guard rejects absent, malformed, and future authority', () => {
  const { isCurrentDueQueueEntry } = load('executionGuards.ts', {});
  const id = 'synthetic-current-job', now = Date.now();
  assert.equal(isCurrentDueQueueEntry({ jobId: id, status: 'PENDING', availableAt: new Date(now - 1) }, id, now), true);
  assert.equal(isCurrentDueQueueEntry({ jobId: id, status: 'PENDING', availableAt: { toMillis: () => now - 1 } }, id, now), true);
  for (const row of [null, { jobId: 'foreign', status: 'PENDING', availableAt: new Date(now - 1) },
    { jobId: id, status: 'LEASED', availableAt: new Date(now - 1) },
    { jobId: id, status: 'PENDING', availableAt: new Date(now + 1) },
    { jobId: id, status: 'PENDING', availableAt: 'yesterday' },
    { jobId: id, status: 'PENDING' },
    { jobId: id, status: 'PENDING', availableAt: { toMillis() { throw Error('malformed'); } } }]) {
    assert.equal(isCurrentDueQueueEntry(row, id, now), false);
  }
});
