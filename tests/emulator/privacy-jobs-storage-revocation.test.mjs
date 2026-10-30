import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import vm from 'node:vm';

const privacyRoot = process.env.URAI_PRIVACY_SOURCE_ROOT;
if (!privacyRoot) throw new Error('URAI_PRIVACY_SOURCE_ROOT must point to an installed Privacy source checkout');
const jobsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
const privacyRequire = createRequire(resolve(privacyRoot, 'functions/package.json'));
const ts = jobsRequire('typescript');
const { initializeApp, deleteApp } = jobsRequire('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = jobsRequire('firebase-admin/firestore');
const { getStorage } = jobsRequire('firebase-admin/storage');
const bucketName = 'demo-urai-jobs-cleanup.appspot.com';
const run = `synthetic-combined-${Date.now()}`;
const token = 'synthetic-combined-event-token';
const actor = { uid: 'synthetic-jobs-service', token: { system: true, consumerId: 'urai-jobs' } };
const env = { NODE_ENV: 'test', FUNCTIONS_EMULATOR: 'true', GCS_BUCKET_NAME: bucketName,
  URAI_JOBS_REVOCATION_ENDPOINT: '', URAI_JOBS_REVOCATION_ALLOWED_ORIGIN: '' };
const fixtures = [], pendingReceivers = new Set();
let jobsTransactionLatencyMs = 0;
let app, jobsApp, db, jobsDb, bucket, privacy, dispatcher, blocks, receiver, server;
class TestHttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }

function load(file, req, imports = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const cjs = { exports: {} };
  vm.runInNewContext(code, { module: cjs, exports: cjs.exports, Buffer, Date, Error, Promise, URL, AbortController, fetch,
    setTimeout, clearTimeout, console, process: { env }, require(id) {
      if (Object.hasOwn(imports, id)) return imports[id];
      if (['node:crypto', 'node:net', 'node:util', 'zod'].includes(id)) return req(id);
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return cjs.exports;
}
const privacyFile = path => resolve(privacyRoot, 'functions/src', path);
const jobsFile = path => new URL(`../../functions/src/${path}`, import.meta.url);
const adapter = db => ({ collection: (...args) => db.collection(...args),
  async runTransaction(callback) {
    if (db === jobsDb && jobsTransactionLatencyMs) {
      await new Promise(resolveDelay => setTimeout(resolveDelay, jobsTransactionLatencyMs));
    }
    return db.runTransaction(transaction => Promise.resolve(callback(transaction)));
  } });

before(async () => {
  const localHost = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/;
  if (!localHost.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    || !localHost.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '')) {
    throw new Error('Local Firestore and Storage emulators are required');
  }
  if (process.env.STORAGE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST !== `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`) {
    throw new Error('Storage emulator host must match the local emulator');
  }
  app = initializeApp({ projectId: 'demo-urai-privacy-storage' }, `combined-privacy-${Date.now()}`);
  jobsApp = initializeApp({ projectId: 'demo-urai-jobs-cleanup', storageBucket: bucketName }, `combined-jobs-${Date.now()}`);
  db = getFirestore(app); jobsDb = getFirestore(jobsApp); bucket = getStorage(jobsApp).bucket(bucketName);
  const privacyDb = adapter(db), jobDb = adapter(jobsDb);
  const transition = load(privacyFile('consent-revocation-transition.ts'), privacyRequire);
  const projector = load(privacyFile('consent-jobs-delivery.ts'), privacyRequire);
  const transport = load(privacyFile('consent-jobs-http.ts'), privacyRequire);
  const https = { HttpsError: TestHttpsError, onCall: (...args) => args.at(-1), onRequest: (_options, handler) => handler };
  privacy = load(privacyFile('consent-revocation.ts'), privacyRequire, {
    'firebase-admin/firestore': { FieldValue, getFirestore: () => privacyDb },
    'firebase-functions/v2/firestore': { onDocumentWritten: (_path, handler) => handler },
    'firebase-functions/v2/https': https,
    './consent-revocation-transition': transition, './consent-jobs-delivery': projector,
  });
  dispatcher = load(privacyFile('consent-jobs-dispatch.ts'), privacyRequire, {
    'firebase-admin/firestore': { FieldValue, Timestamp, getFirestore: () => privacyDb },
    'firebase-functions/params': { defineSecret: () => ({ value: () => token }) },
    'firebase-functions/v2/https': https,
    './consent-jobs-delivery': projector, './consent-jobs-http': transport,
  }).deliverJobsConsentRevocation;
  blocks = load(jobsFile('privacy/consentBlocks.ts'), jobsRequire, {
    'firebase-admin/firestore': { getFirestore: () => jobDb },
  });
  const cleanup = load(jobsFile('privacy/lifeMovieDerivativeRevocation.ts'), jobsRequire, {
    'firebase-admin/firestore': { FieldValue, getFirestore: () => jobDb },
    'firebase-admin/storage': { getStorage: () => getStorage(jobsApp) },
    '../core/firestore-paths.js': { jobQueueEntryDoc: jobId => jobsDb.collection('jobQueue').doc(jobId) },
    './consentBlocks.js': blocks,
    './lifeMovieArtifactRefs.js': load(jobsFile('privacy/lifeMovieArtifactRefs.ts'), jobsRequire),
  });
  receiver = load(jobsFile('privacy/consentRevocation.ts'), jobsRequire, {
    'firebase-admin/firestore': { FieldValue, getFirestore: () => jobDb },
    'firebase-functions/params': { defineSecret: () => ({ value: () => token }) },
    'firebase-functions/v2/https': https, './consentBlocks.js': blocks,
    './lifeMovieDerivativeRevocation.js': cleanup,
  }).ingestConsentRevocation;
  server = createServer((request, reply) => {
    let text = '';
    request.setEncoding('utf8'); request.on('data', chunk => { text += chunk; });
    request.on('end', () => {
      const task = (async () => {
        await receiver({ method: request.method, headers: request.headers, body: JSON.parse(text) }, {
          status(value) { reply.statusCode = value; return this; },
          json(value) { reply.setHeader('content-type', 'application/json'); reply.end(JSON.stringify(value)); return this; },
        });
      })().catch(() => { if (!reply.headersSent) reply.writeHead(500); reply.end('{}'); });
      pendingReceivers.add(task);
      void task.finally(() => pendingReceivers.delete(task));
    });
  });
  await new Promise((resolveListen, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${server.address().port}`;
  env.URAI_JOBS_REVOCATION_ENDPOINT = `${origin}/ingest`;
  env.URAI_JOBS_REVOCATION_ALLOWED_ORIGIN = origin;
});

after(async () => {
  await Promise.allSettled([...pendingReceivers]);
  if (server) { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); }
  for (const fixture of fixtures) {
    await bucket.file(fixture.path).delete({ ignoreNotFound: true });
    await fixture.job.delete(); await fixture.queue.delete(); await fixture.record.delete();
    if (fixture.extraDocs?.length) {
      const batch = jobsDb.batch();
      for (const ref of fixture.extraDocs) batch.delete(ref);
      await batch.commit();
    }
    if (fixture.outboxRef) await db.recursiveDelete(fixture.outboxRef);
    if (fixture.eventId) await blocks.consentEventReceiptRef(fixture.eventId).delete();
    await blocks.consentBlockRef(fixture.owner, 'life-movie.render').delete();
    const audits = await db.collection('auditLogs').where('targetUid', '==', fixture.owner).get();
    for (const row of audits.docs) await row.ref.delete();
  }
  if (jobsApp) await deleteApp(jobsApp);
  if (app) await deleteApp(app);
});

async function makeFixture(label, status) {
  const owner = `${run}-${label}`, tenant = `${run}-tenant`, project = `project-${label}`;
  const record = db.doc(`consentRecords/${run}-${label}`), job = jobsDb.doc(`jobs/${run}-${label}`);
  const queue = jobsDb.doc(`jobQueue/${job.id}`);
  const path = `tenants/${tenant}/life-movies/${project}/attempt-1/file.mp4`;
  const fixture = { owner, record, job, queue, path, outboxRef: null, eventId: '' };
  fixtures.push(fixture);
  await bucket.file(path).save('synthetic combined fixture', { resumable: false });
  const output = { outputs: [{ kind: 'mp4', ref: `gs://${bucketName}/${path}` }] };
  await job.set({ ownerUid: owner, tenantId: tenant, sourceSystem: 'urai-studio', jobType: 'studio.render.video',
    status, payload: { projectId: project }, consent: { purpose: 'life-movie.render' }, output, result: output,
    execution: { leaseToken: 'synthetic-lease' } });
  await queue.set({ status, lease: { leaseToken: 'synthetic-lease' } });
  // Synthetic trigger fixtures are inserted directly. Privacy does not register
  // this purpose, and this is not a grant or a real-user authorization.
  const granted = { uid: owner, purpose: 'life-movie.render', consentTier: 'C1', policyVersion: '1.0.0',
    receiptHash: 'a'.repeat(64), status: 'granted' };
  await record.set(granted); const beforeSnapshot = await record.get();
  await record.set({ ...granted, status: 'revoked', receiptHash: 'b'.repeat(64) }); const afterSnapshot = await record.get();
  await privacy.publishConsentRevocation({ time: '2026-10-28T21:00:00.000Z', params: { recordId: record.id },
    data: { before: beforeSnapshot, after: afterSnapshot } });
  const outbox = await db.collection('consentRevocationOutbox').where('consentRecordId', '==', record.id).get();
  assert.equal(outbox.size, 1);
  fixture.outboxRef = outbox.docs[0].ref; fixture.eventId = outbox.docs[0].id;
  return fixture;
}
const deliver = eventId => dispatcher({ auth: actor, data: { eventId } });

test('Privacy-to-Jobs delivery deletes a referenced object before acknowledging', async () => {
  const fixture = await makeFixture('pending', 'PENDING');
  const result = await deliver(fixture.eventId);
  assert.equal(result.status, 'applied');
  assert.equal((await fixture.outboxRef.collection('acknowledgements').doc('urai-jobs').get()).get('status'), 'applied');
  assert.equal((await blocks.consentBlockRef(fixture.owner, 'life-movie.render').get()).get('active'), true);
  assert.equal((await blocks.consentEventReceiptRef(fixture.eventId).get()).get('derivativeInvalidation.storageObjectsDeleted'), 1);
  assert.equal((await fixture.job.get()).get('output'), undefined);
  assert.equal((await fixture.queue.get()).get('status'), 'CANCELLED');
  assert.equal((await bucket.file(fixture.path).exists())[0], false);
});

test('Privacy refuses an acknowledgement while an in-flight Jobs attempt is unresolved', async () => {
  const fixture = await makeFixture('running', 'RUNNING');
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(deliver(fixture.eventId), error => error.code === 'unavailable');
    assert.equal((await fixture.outboxRef.collection('acknowledgements').doc('urai-jobs').get()).exists, false);
    assert.equal((await blocks.consentBlockRef(fixture.owner, 'life-movie.render').get()).get('active'), true);
    assert.equal((await fixture.job.get()).get('consentRevocationInFlightUnresolved'), true);
    await fixture.outboxRef.update({ 'jobsDeliveryLease.expiresAt': Timestamp.fromMillis(Date.now() - 1000) });
  }
  assert.equal((await bucket.file(fixture.path).exists())[0], false);
  assert.equal((await fixture.job.get()).get('output').outputs.length, 1);
});


test('a larger synthetic account completes delivery despite modeled per-transaction latency', async () => {
  const fixture = await makeFixture('scale', 'PENDING');
  const jobsCount = 110, plansCount = 30;
  fixture.extraDocs = [];
  const batch = jobsDb.batch();
  const template = (await fixture.job.get()).data();
  for (let index = 1; index < jobsCount; index++) {
    const job = jobsDb.doc(`jobs/${run}-scale-${index}`);
    const queue = jobsDb.doc(`jobQueue/${job.id}`);
    fixture.extraDocs.push(job, queue);
    batch.create(job, template);
  }
  for (let index = 0; index < plansCount; index++) {
    const plan = jobsDb.doc(`studioLifeMovieLongformPlans/${run}-scale-${index}`);
    fixture.extraDocs.push(plan);
    batch.create(plan, { ownerUid: fixture.owner, status: 'PENDING' });
  }
  await batch.commit();
  jobsTransactionLatencyMs = 85;
  const started = Date.now();
  let result, failure;
  try { result = await deliver(fixture.eventId); } catch (error) { failure = error; }
  const firstElapsed = Date.now() - started;
  // A timed-out HTTP request may still be running remotely; wait before cleanup.
  await Promise.allSettled([...pendingReceivers]);
  let secondElapsed;
  if (failure) {
    assert.equal((await fixture.outboxRef.collection('acknowledgements').doc('urai-jobs').get()).exists, false);
    assert.equal((await blocks.consentBlockRef(fixture.owner, 'life-movie.render').get()).get('active'), true);
    await fixture.outboxRef.update({ 'jobsDeliveryLease.expiresAt': Timestamp.fromMillis(Date.now() - 1000) });
    const retryStarted = Date.now();
    try { await deliver(fixture.eventId); } catch { /* The assertion below reports the first failure. */ }
    secondElapsed = Date.now() - retryStarted;
    await Promise.allSettled([...pendingReceivers]);
  }
  jobsTransactionLatencyMs = 0;
  console.log(`Synthetic scale: ${jobsCount} jobs, ${plansCount} plans, 85 ms modeled per Jobs transaction; first ${firstElapsed} ms${secondElapsed === undefined ? '' : `, retry ${secondElapsed} ms`}`);
  assert.equal(failure, undefined, 'delivery must finish within the actual 20-second HTTP timeout');
  assert.equal(result.status, 'applied');
  const receipt = await blocks.consentEventReceiptRef(fixture.eventId).get();
  assert.equal(receipt.get('derivativeInvalidation.jobsInvalidated'), jobsCount);
  assert.equal(receipt.get('derivativeInvalidation.plansInvalidated'), plansCount);
  assert.equal(receipt.get('derivativeInvalidation.storageObjectsDeleted'), 1);
  assert.equal((await bucket.file(fixture.path).exists())[0], false);
  const jobs = await jobsDb.collection('jobs').where('ownerUid', '==', fixture.owner).get();
  assert.equal(jobs.size, jobsCount);
  for (const snapshot of jobs.docs) {
    assert.equal(snapshot.get('status'), 'CANCELLED');
    assert.equal(snapshot.get('output'), undefined);
  }
});
