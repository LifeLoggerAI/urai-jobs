import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const projectId = 'demo-urai-jobs-consent';
const prefix = `synthetic-gate-${Date.now()}`;
const ids = ['life', 'other', 'manual', 'leased', 'cancelled'].map(suffix => `${prefix}-${suffix}`);
let app, db, tick, manual, execute;
let published = 0, workerCalls = 0;

function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../../functions/src/${relativePath}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, Error, Promise, console,
    process: { env: { NODE_ENV: 'production' } }, require(id) {
      if (id === 'zod' || id === 'node:crypto') return require(id);
      if (id in imports) return imports[id];
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return module.exports;
}

before(() => {
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
    throw new Error('A local Firestore emulator is required');
  }
  app = initializeApp({ projectId }, `jobs-gate-${Date.now()}`);
  db = getFirestore(app);
  const adapter = { collection: (...args) => db.collection(...args),
    runTransaction: callback => db.runTransaction(transaction => Promise.resolve(callback(transaction))) };
  const gate = load('privacy/lifeMovieConsentGate.ts');
  const guards = load('jobs/executionGuards.ts');
  const imports = {
    'firebase-admin/firestore': { FieldValue, Timestamp, getFirestore: () => adapter },
    'firebase-functions/v2/scheduler': { onSchedule: (_options, handler) => handler },
    'firebase-functions/v2/https': { onCall: (_options, handler) => handler, HttpsError: Error },
    'firebase-functions/v2/pubsub': { onMessagePublished: (_options, handler) => handler },
    'firebase-functions/params': { defineSecret: () => ({ value: () => '' }) },
    '@google-cloud/pubsub': { PubSub: class { topic() { return { publishMessage: async () => { published++; } }; } } },
    ulid: { ulid: () => `${Date.now()}synthetictoken` },
    axios: { default: { post: async () => { workerCalls++; throw new Error('Unexpected worker dispatch'); } } },
    '../core/firestore-paths.js': { jobDoc: id => db.doc(`jobs/${id}`), jobQueueEntryDoc: id => db.doc(`jobQueue/${id}`) },
    '../core/dispatchRecovery.js': {},
    '../core/runtimeJobTypes.js': { workerEnvKeyForJobType: () => null, workerRouteForJobType: () => '/' },
    '../providers/tinyfish.js': { isTinyFishJobType: () => false, tinyFishApiKeySecret: {} },
    './executionGuards.js': guards,
    '../privacy/consentBlocks.js': { consentBlockRef: () => db.doc('synthetic/missing'), isConsentContext: () => false },
    '../privacy/lifeMovieConsentGate.js': gate,
  };
  tick = load('jobs/processQueueTick.ts', imports).processQueueTick;
  manual = load('jobs/processQueueNow.ts', imports).processQueueNow;
  execute = load('jobs/executeJob.ts', imports).executeJob;
});

after(async () => {
  if (!db) return;
  for (const id of ids) {
    await db.recursiveDelete(db.doc(`jobs/${id}`));
    await db.doc(`jobQueue/${id}`).delete();
  }
  await deleteApp(app);
});

async function queue(id, type) {
  await db.doc(`jobs/${id}`).set({ jobId: id, status: 'PENDING', type, ownerUid: 'synthetic-owner' });
  await db.doc(`jobQueue/${id}`).set({ jobId: id, status: 'PENDING', availableAt: new Date(Date.now() - 1000) });
}
async function assertDeferred(id) {
  const [job, queued] = await Promise.all([db.doc(`jobs/${id}`).get(), db.doc(`jobQueue/${id}`).get()]);
  assert.equal(job.get('status'), 'PENDING');
  assert.equal(queued.get('status'), 'PENDING');
  assert.equal(queued.get('dispatch.blockedReason'), 'life_movie_consent_authority_unavailable');
  assert.ok(queued.get('availableAt').toMillis() > Date.now());
  assert.equal(job.get('execution.attemptCount'), undefined);
}

test('scheduled queue defers a render and publishes an unrelated job', async () => {
  await queue(ids[0], 'studio.render.video');
  await queue(ids[1], 'asset.render');
  await tick();
  await assertDeferred(ids[0]);
  assert.equal((await db.doc(`jobs/${ids[1]}`).get()).get('status'), 'LEASED');
  assert.equal(published, 1);
});

test('manual queue defers an assembly job', async () => {
  await queue(ids[2], 'studio.assemble.video');
  const result = await manual({ auth: { token: { role: 'operator' } }, data: { limit: 10 } });
  assert.ok(result.skipped.includes(ids[2]));
  await assertDeferred(ids[2]);
  assert.equal(published, 1);
});

test('a matching in-flight lease is safely deferred without calling a worker', async () => {
  const id = ids[3], lease = { leaseToken: 'synthetic-lease', leaseId: 'synthetic-lease-id', workerId: 'synthetic-worker' };
  await db.doc(`jobs/${id}`).set({ jobId: id, type: 'studio.render.video', status: 'LEASED', ownerUid: 'synthetic-owner', lease });
  await db.doc(`jobQueue/${id}`).set({ jobId: id, status: 'LEASED', lease });
  await execute({ data: { message: { json: { jobId: id, leaseToken: lease.leaseToken } } } });
  await assertDeferred(id);
  assert.equal((await db.doc(`jobs/${id}`).get()).get('lease'), undefined);
  assert.equal((await db.doc(`jobQueue/${id}`).get()).get('lease'), undefined);
  assert.equal(workerCalls, 0);
});

test('a cancelled queue entry is not recreated or reset', async () => {
  const id = ids[4], lease = { leaseToken: 'synthetic-lease', leaseId: 'synthetic-lease-id', workerId: 'synthetic-worker' };
  await db.doc(`jobs/${id}`).set({ jobId: id, type: 'studio.render.video', status: 'LEASED', ownerUid: 'synthetic-owner', lease });
  await db.doc(`jobQueue/${id}`).set({ jobId: id, status: 'CANCELLED' });
  await execute({ data: { message: { json: { jobId: id, leaseToken: lease.leaseToken } } } });
  assert.equal((await db.doc(`jobQueue/${id}`).get()).get('status'), 'CANCELLED');
  assert.equal((await db.doc(`jobs/${id}`).get()).get('status'), 'LEASED');
  assert.equal(workerCalls, 0);
});
