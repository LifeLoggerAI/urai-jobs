import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const projectId = 'demo-urai-jobs-cleanup';
const bucketName = 'demo-urai-jobs-cleanup.appspot.com';
const run = `synthetic-${Date.now()}`;
const docs = [];
const files = [];
const logs = [];
let app, db, bucket, invalidate, onDelete, onTransactionRead, blocks, ingest;
const token = 'synthetic-event-token';

function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../../functions/src/${relativePath}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const storage = { bucket(name) {
    assert.equal(name, bucketName);
    return { file(path, fileOptions) { return { getMetadata: () => bucket.file(path).getMetadata(), async delete(options) {
      if (onDelete) await onDelete(path);
      // The Firebase Storage emulator ignores GCS generation preconditions.
      // Model that one condition here while still storing bytes in the emulator.
      const expected = fileOptions?.preconditionOpts?.ifGenerationMatch;
      if (expected !== undefined) {
        let actual = '0';
        try { [actual] = [(await bucket.file(path).getMetadata())[0].generation.toString()]; }
        catch (error) { if (error.code !== 404) throw error; }
        if (actual !== String(expected)) {
          const error = new Error('synthetic generation precondition failure');
          error.code = 412;
          throw error;
        }
      }
      return bucket.file(path, fileOptions).delete(options);
    } }; } };
  } };
  const adapter = { collection: (...args) => db.collection(...args), batch: () => db.batch(),
    runTransaction: callback => db.runTransaction(transaction => {
      const wrapped = new Proxy(transaction, { get(target, property) {
        if (property === 'get') return async ref => {
          if (onTransactionRead) await onTransactionRead(ref);
          return target.get(ref);
        };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      return Promise.resolve(callback(wrapped));
    }) };
  const capturedConsole = { ...console, error: (...args) => { logs.push(args); } };
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, Error, Promise, console: capturedConsole,
    process: { env: { GCS_BUCKET_NAME: bucketName } }, require(id) {
      if (id === 'node:util' || id === 'node:crypto' || id === 'zod') return require(id);
      if (Object.hasOwn(imports, id)) return imports[id];
      if (id === 'firebase-admin/firestore') return { FieldValue, getFirestore: () => adapter };
      if (id === 'firebase-admin/storage') return { getStorage: () => storage };
      if (id === '../core/firestore-paths.js') return { jobQueueEntryDoc: jobId => db.collection('jobQueue').doc(jobId) };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return module.exports;
}

before(() => {
  const localHost = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/;
  if (!localHost.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    || !localHost.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '')) {
    throw new Error('Local Firestore and Storage emulators are required');
  }
  if (process.env.STORAGE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST !== `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`) {
    throw new Error('Storage emulator host must match the local emulator');
  }
  app = initializeApp({ projectId, storageBucket: bucketName }, `cleanup-${Date.now()}`);
  db = getFirestore(app);
  bucket = getStorage(app).bucket(bucketName);
  blocks = load('privacy/consentBlocks.ts');
  const invalidateActual = load('privacy/lifeMovieDerivativeRevocation.ts', {
    './consentBlocks.js': blocks,
    './lifeMovieArtifactRefs.js': load('privacy/lifeMovieArtifactRefs.ts'),
  }).invalidateLifeMovieDerivativesForConsent;
  invalidate = async event => {
    const receipt = blocks.consentEventReceiptRef(event.eventId);
    if (!(await receipt.get()).exists) {
      docs.push(receipt);
      await receipt.set({ eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose, status: 'blocked' });
    }
    return invalidateActual(event);
  };
  ingest = load('privacy/consentRevocation.ts', {
    'firebase-functions/params': { defineSecret: () => ({ value: () => token }) },
    'firebase-functions/v2/https': { onRequest: (_options, handler) => handler },
    './consentBlocks.js': blocks,
    './lifeMovieDerivativeRevocation.js': { invalidateLifeMovieDerivativesForConsent: invalidate },
  }).ingestConsentRevocation;
});

after(async () => {
  onDelete = undefined;
  onTransactionRead = undefined;
  await Promise.all(files.map(path => bucket.file(path).delete({ ignoreNotFound: true })));
  await Promise.all(docs.map(ref => ref.delete()));
  if (app) await deleteApp(app);
});

function doc(collection, name) {
  const ref = db.collection(collection).doc(`${run}-${name}`);
  docs.push(ref);
  if (collection === 'jobs') docs.push(db.collection('jobQueue').doc(ref.id));
  return ref;
}
async function object(path) {
  files.push(path);
  await bucket.file(path).save('synthetic test data', { resumable: false });
  return `gs://${bucketName}/${path}`;
}
function event(ownerUid) {
  return { eventId: `${run}-event-${ownerUid}`, ownerUid, purpose: 'life-movie.render', revokedAt: '2026-10-28T21:00:00.000Z' };
}
function makeJob(ownerUid, project, output) {
  return { ownerUid, sourceSystem: 'urai-studio', tenantId: `${run}-tenant`, jobType: 'studio.render.video',
    payload: { projectId: project }, consent: { purpose: 'life-movie.render' }, status: 'PENDING',
    lease: { leaseToken: 'synthetic-lease' }, execution: { leaseToken: 'synthetic-lease' }, ...(output ? { output, result: output } : {}) };
}
const outputFor = ref => ({ outputs: [{ kind: 'mp4', ref }] });
const codeIs = code => error => error?.message === code;

test('deletes only the owner’s project outputs and cancels its job, queue, and plan', async () => {
  const owner = `${run}-baseline-owner`, tenant = `${run}-tenant`;
  const ours = `tenants/${tenant}/life-movies/project-a/attempt-1/ours.mp4`;
  const theirs = `tenants/${tenant}/life-movies/project-b/attempt-1/theirs.mp4`;
  const ourRef = await object(ours);
  const theirRef = await object(theirs);
  const job = doc('jobs', 'baseline'), other = doc('jobs', 'other'), queue = db.collection('jobQueue').doc(job.id), plan = doc('studioLifeMovieLongformPlans', 'baseline');
  docs.push(queue);
  await job.set(makeJob(owner, 'project-a', outputFor(ourRef)));
  await other.set(makeJob(`${run}-other-owner`, 'project-b', outputFor(theirRef)));
  await queue.set({ status: 'LEASED', lease: { leaseToken: 'synthetic-lease' } });
  await plan.set({ ownerUid: owner, consent: { purpose: 'life-movie.render' }, status: 'RUNNING' });
  const result = await invalidate(event(owner));
  assert.equal(result.jobsInvalidated, 1);
  assert.equal(result.plansInvalidated, 1);
  assert.equal(result.storageObjectsDeleted, 1);
  const value = (await job.get()).data();
  assert.equal(value.status, 'CANCELLED');
  assert.equal(value.derivativeAccessState, 'REVOKED');
  assert.equal(value.output, undefined);
  assert.equal(value.result, undefined);
  assert.equal(value.execution.leaseToken, undefined);
  assert.equal((await queue.get()).get('status'), 'CANCELLED');
  assert.equal((await plan.get()).get('status'), 'CANCELLED');
  assert.equal((await bucket.file(ours).exists())[0], false);
  assert.equal((await bucket.file(theirs).exists())[0], true);
  assert.equal((await other.get()).get('status'), 'PENDING');
});

test('refuses malformed output metadata without losing its evidence', async () => {
  const owner = `${run}-malformed-owner`, job = doc('jobs', 'malformed');
  await job.set(makeJob(owner, 'project-a', outputFor('https://example.invalid/private.mp4')));
  await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_ref_invalid'));
  const value = (await job.get()).data();
  assert.equal(value.output.outputs[0].ref, 'https://example.invalid/private.mp4');
  assert.equal(value.result.outputs[0].ref, 'https://example.invalid/private.mp4');
});

test('rejects a different project’s object in the same tenant', async () => {
  const owner = `${run}-boundary-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'boundary');
  const path = `tenants/${tenant}/life-movies/project-b/attempt-1/private.mp4`;
  const ref = await object(path);
  await job.set(makeJob(owner, 'project-a', outputFor(ref)));
  await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_boundary_mismatch'));
  assert.equal((await bucket.file(path).exists())[0], true);
  assert.equal((await job.get()).get('output').outputs[0].ref, ref);
});

test('fences a pending job before deleting and preserves a concurrently changed output for retry', async () => {
  const owner = `${run}-race-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'race');
  const oldPath = `tenants/${tenant}/life-movies/project-race/attempt-1/old.mp4`;
  const newPath = `tenants/${tenant}/life-movies/project-race/attempt-2/new.mp4`;
  const oldRef = await object(oldPath), newRef = await object(newPath);
  await job.set(makeJob(owner, 'project-race', outputFor(oldRef)));
  let observedStatus;
  onDelete = async () => {
    onDelete = undefined;
    observedStatus = (await job.get()).get('status');
    await job.update({ output: outputFor(newRef), result: outputFor(newRef) });
  };
  await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_changed'));
  assert.equal(observedStatus, 'CANCELLED');
  assert.equal((await job.get()).get('output').outputs[0].ref, newRef);
  assert.equal((await bucket.file(newPath).exists())[0], true);
  await invalidate(event(owner));
  assert.equal((await bucket.file(newPath).exists())[0], false);
  assert.equal((await job.get()).get('output'), undefined);
});

test('does not delete a newer object written at the same output path during cleanup', async () => {
  const owner = `${run}-generation-race-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'generation-race');
  const path = `tenants/${tenant}/life-movies/project-generation-race/attempt-1/output.mp4`;
  const ref = await object(path);
  const [before] = await bucket.file(path).getMetadata();
  await job.set(makeJob(owner, 'project-generation-race', outputFor(ref)));
  let replaced = false;
  onDelete = async requestedPath => {
    if (requestedPath !== path || replaced) return;
    replaced = true;
    onDelete = undefined;
    await bucket.file(path).save('synthetic replacement', { resumable: false });
    const [after] = await bucket.file(path).getMetadata();
    assert.notEqual(String(after.generation), String(before.generation));
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_generation_changed'));
    }
    assert.equal(replaced, true);
    assert.equal((await bucket.file(path).download())[0].toString(), 'synthetic replacement');
    const current = (await job.get()).data();
    assert.equal(current.output.outputs[0].ref, ref);
    assert.equal(current.outputDeletedAt, undefined);
  } finally { onDelete = undefined; }
});

test('does not delete an object created at a previously absent output path', async () => {
  const owner = `${run}-absent-race-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'absent-race');
  const path = `tenants/${tenant}/life-movies/project-absent-race/attempt-1/output.mp4`;
  const ref = `gs://${bucketName}/${path}`;
  files.push(path);
  await job.set(makeJob(owner, 'project-absent-race', outputFor(ref)));
  let created = false;
  onDelete = async requestedPath => {
    if (requestedPath !== path || created) return;
    created = true;
    onDelete = undefined;
    await bucket.file(path).save('synthetic replacement', { resumable: false });
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_generation_changed'));
    }
    assert.equal((await bucket.file(path).download())[0].toString(), 'synthetic replacement');
    assert.equal((await job.get()).get('output').outputs[0].ref, ref);
  } finally { onDelete = undefined; }
});

test('retries safely when the recorded generation was deleted before finalization failed', async () => {
  const owner = `${run}-generation-retry-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'generation-retry');
  const path = `tenants/${tenant}/life-movies/project-generation-retry/attempt-1/output.mp4`;
  const ref = await object(path);
  await job.set(makeJob(owner, 'project-generation-retry', outputFor(ref)));
  let jobReads = 0;
  onTransactionRead = async candidate => {
    if (candidate.id !== job.id) return;
    jobReads += 1;
    if (jobReads === 2) { onTransactionRead = undefined; throw new Error('synthetic-finalization-failure'); }
  };
  try {
    await assert.rejects(invalidate(event(owner)), codeIs('synthetic-finalization-failure'));
    assert.equal((await bucket.file(path).exists())[0], false);
    assert.equal((await job.get()).get('output').outputs[0].ref, ref);
    const result = await invalidate(event(owner));
    assert.equal(result.storageObjectsDeleted, 0);
    assert.equal((await job.get()).get('output'), undefined);
  } finally { onTransactionRead = undefined; }
});

test('refuses to anchor a generation on another owner’s revocation receipt', async () => {
  const owner = `${run}-receipt-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'receipt-owner');
  const path = `tenants/${tenant}/life-movies/project-receipt/attempt-1/output.mp4`;
  const ref = await object(path);
  const revocation = event(owner);
  const receipt = blocks.consentEventReceiptRef(revocation.eventId);
  docs.push(receipt);
  await receipt.set({ eventId: revocation.eventId, ownerUid: `${run}-other-owner`, purpose: revocation.purpose, status: 'blocked' });
  await job.set(makeJob(owner, 'project-receipt', outputFor(ref)));
  await assert.rejects(invalidate(revocation), codeIs('life_movie_revocation_receipt_invalid'));
  assert.equal((await bucket.file(path).exists())[0], true);
  assert.equal((await job.get()).get('output').outputs[0].ref, ref);
});


test('a running attempt is fenced but never acknowledged as fully cleaned without reconciliation', async () => {
  const owner = `${run}-inflight-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'inflight');
  const path = `tenants/${tenant}/life-movies/project-live/attempt-1/known.mp4`;
  const ref = await object(path);
  await job.set({ ...makeJob(owner, 'project-live', outputFor(ref)), status: 'RUNNING' });
  const queue = db.collection('jobQueue').doc(job.id);
  docs.push(queue);
  await queue.set({ status: 'RUNNING', lease: { leaseToken: 'synthetic-lease' } });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_inflight_unresolved'));
    const current = (await job.get()).data();
    assert.equal(current.status, 'CANCELLED');
    assert.equal(current.consentRevocationInFlightUnresolved, true);
    assert.equal(current.output.outputs[0].ref, ref);
    assert.equal(current.outputDeletedAt, undefined);
    assert.equal((await queue.get()).get('status'), 'CANCELLED');
  }
  assert.equal((await bucket.file(path).exists())[0], false, 'known output is deleted even while unknown in-flight files need reconciliation');
});

test('a Storage error preserves references and a later retry can finish', async () => {
  const owner = `${run}-storage-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'storage');
  const path = `tenants/${tenant}/life-movies/project-storage/attempt-1/file.mp4`;
  const ref = await object(path);
  await job.set(makeJob(owner, 'project-storage', outputFor(ref)));
  onDelete = async () => { onDelete = undefined; throw new Error('synthetic-storage-failure'); };
  await assert.rejects(invalidate(event(owner)), codeIs('synthetic-storage-failure'));
  assert.equal((await job.get()).get('output').outputs[0].ref, ref);
  assert.equal((await bucket.file(path).exists())[0], true);
  const summary = await invalidate(event(owner));
  assert.equal(summary.storageObjectsDeleted, 1);
  assert.equal((await job.get()).get('output'), undefined);
});

test('already absent files are not counted as deleted', async () => {
  const owner = `${run}-absent-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'absent');
  const path = `tenants/${tenant}/life-movies/project-absent/attempt-1/file.mp4`;
  await job.set(makeJob(owner, 'project-absent', outputFor(`gs://${bucketName}/${path}`)));
  const summary = await invalidate(event(owner));
  assert.equal(summary.storageObjectsDeleted, 0);
  assert.equal((await job.get()).get('output'), undefined);
});

test('legacy jobs and plans with missing or mislabeled consent still get fenced', async () => {
  const owner = `${run}-legacy-owner`, job = doc('jobs', 'legacy'), plan = doc('studioLifeMovieLongformPlans', 'legacy');
  await job.set({ ...makeJob(owner, 'project-legacy'), consent: { purpose: 'wrong-purpose' } });
  await plan.set({ ownerUid: owner, status: 'PENDING' });
  const summary = await invalidate(event(owner));
  assert.equal(summary.jobsInvalidated, 1);
  assert.equal(summary.plansInvalidated, 1);
  assert.equal((await job.get()).get('status'), 'CANCELLED');
  assert.equal((await plan.get()).get('status'), 'CANCELLED');
});


test('unknown or malformed output shapes remain available for reconciliation', async () => {
  const samples = [
    { outputs: [] }, { outputs: {} }, { outputs: [null] }, { outputs: [{ kind: 'mp4' }] },
    { artifactUrl: 7 }, { unexpected: 'opaque legacy output' }, 'unexpected output',
  ];
  for (let index = 0; index < samples.length; index++) {
    const owner = `${run}-shape-${index}`, job = doc('jobs', `shape-${index}`);
    await job.set({ ...makeJob(owner, 'project-shape'), output: samples[index] });
    await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_ref_invalid'));
    assert.deepEqual((await job.get()).get('output'), samples[index]);
  }
});

test('legacy output aliases are validated and deleted, including a separate result alias', async () => {
  const owner = `${run}-alias-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'aliases');
  const first = `tenants/${tenant}/life-movies/project-alias/attempt-1/first.mp4`;
  const second = `tenants/${tenant}/life-movies/project-alias/attempt-1/manifest.json`;
  const firstRef = await object(first), secondRef = await object(second);
  await job.set({ ...makeJob(owner, 'project-alias'), output: { artifactUrl: firstRef }, result: { manifestUrl: secondRef } });
  const summary = await invalidate(event(owner));
  assert.equal(summary.storageObjectsDeleted, 2);
  assert.equal((await bucket.file(first).exists())[0], false);
  assert.equal((await bucket.file(second).exists())[0], false);
});

test('all references are validated before any authorized object is deleted', async () => {
  const owner = `${run}-prevalidate-owner`, tenant = `${run}-tenant`;
  const first = doc('jobs', 'prevalidate-good'), second = doc('jobs', 'prevalidate-bad');
  const path = `tenants/${tenant}/life-movies/project-good/attempt-1/good.mp4`;
  const ref = await object(path);
  await first.set(makeJob(owner, 'project-good', outputFor(ref)));
  await second.set(makeJob(owner, 'project-bad', outputFor('https://example.invalid/unknown')));
  await assert.rejects(invalidate(event(owner)), codeIs('life_movie_revocation_output_ref_invalid'));
  assert.equal((await bucket.file(path).exists())[0], true);
  assert.equal((await first.get()).get('output').outputs[0].ref, ref);
});

async function sendRevocation(owner, suffix) {
  const item = { ...event(owner), type: 'consent.revoked.v1', eventId: `${run}-ingest-${suffix}`,
    policyVersion: 'synthetic-policy', decisionReceiptId: 'synthetic-receipt', correlationId: 'synthetic-correlation' };
  const block = blocks.consentBlockRef(owner, item.purpose), receipt = blocks.consentEventReceiptRef(item.eventId);
  docs.push(block, receipt);
  const call = async () => {
    let status, body;
    await ingest({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: item }, {
      status(value) { status = value; return this; }, json(value) { body = value; return this; },
    });
    return { status, body };
  };
  return { item, block, receipt, call };
}

test('actual revocation endpoint acknowledges only after real emulator Storage cleanup', async () => {
  const owner = `${run}-endpoint-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'endpoint');
  const path = `tenants/${tenant}/life-movies/project-endpoint/attempt-1/file.mp4`;
  const ref = await object(path);
  await job.set(makeJob(owner, 'project-endpoint', outputFor(ref)));
  const request = await sendRevocation(owner, 'success');
  const result = await request.call();
  assert.equal(result.status, 200);
  assert.equal(result.body.acknowledgement.derivativeInvalidation.storageObjectsDeleted, 1);
  assert.equal((await request.block.get()).get('active'), true);
  assert.ok((await request.receipt.get()).get('derivativeInvalidationCompletedAt'));
  assert.equal((await bucket.file(path).exists())[0], false);
  assert.equal(Object.keys((await request.receipt.get()).get('storageGenerationFences')).length, 1);
  const repeated = await request.call();
  assert.equal(repeated.status, 200);
  assert.equal(Object.hasOwn(repeated.body.acknowledgement, 'storageGenerationFences'), false);
});

test('actual endpoint rejects and does not acknowledge an unresolved in-flight cleanup', async () => {
  const owner = `${run}-endpoint-inflight-owner`, job = doc('jobs', 'endpoint-inflight');
  await job.set({ ...makeJob(owner, 'project-endpoint'), status: 'RUNNING' });
  const request = await sendRevocation(owner, 'inflight');
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await request.call();
    assert.equal(result.status, 500);
    assert.equal(result.body.error, 'derivative-invalidation-failed');
    assert.equal((await request.block.get()).get('active'), true);
    assert.equal((await request.receipt.get()).get('derivativeInvalidationCompletedAt'), undefined);
    assert.equal((await job.get()).get('consentRevocationInFlightUnresolved'), true);
  }
});


test('endpoint logs a bounded failure code without private Storage exception details', async () => {
  const owner = `${run}-logs-owner`, tenant = `${run}-tenant`, job = doc('jobs', 'logs');
  const path = `tenants/${tenant}/life-movies/project-logs/attempt-1/private.mp4`;
  const ref = await object(path);
  await job.set(makeJob(owner, 'project-logs', outputFor(ref)));
  const request = await sendRevocation(owner, 'logs');
  const beforeLogs = logs.length;
  onDelete = async () => { onDelete = undefined; throw new Error('synthetic-private-storage-detail'); };
  const result = await request.call();
  assert.equal(result.status, 500);
  assert.equal((await request.block.get()).get('active'), true);
  const added = logs.slice(beforeLogs);
  assert.equal(added.length, 1);
  assert.equal(added[0][1].errorCode, 'storage_or_firestore_failure');
  assert.equal(JSON.stringify(added).includes('synthetic-private-storage-detail'), false);
  assert.equal((await job.get()).get('output').outputs[0].ref, ref);
});


test('Firestore cleanup runs independent jobs concurrently with a fixed bound', async () => {
  const owner = `${run}-parallel-owner`, batch = db.batch();
  const refs = Array.from({ length: 24 }, (_, index) => doc('jobs', `parallel-${index}`));
  for (const ref of refs) batch.create(ref, makeJob(owner, 'project-parallel'));
  await batch.commit();
  let active = 0, peak = 0;
  onTransactionRead = async ref => {
    if (!ref.id.startsWith(`${run}-parallel-`)) return;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 25));
    active -= 1;
  };
  try {
    const summary = await invalidate(event(owner));
    assert.equal(summary.jobsInvalidated, refs.length);
    assert.ok(peak > 1, 'independent Firestore transactions should overlap');
    assert.ok(peak <= 8, `Firestore concurrency must be bounded; observed ${peak}`);
    assert.equal(active, 0);
  } finally { onTransactionRead = undefined; }
});

test('a failed transaction waits for the rest of its batch before returning', async () => {
  const owner = `${run}-batch-failure-owner`, tenant = `${run}-tenant`;
  const first = doc('jobs', 'failure-a'), second = doc('jobs', 'failure-b');
  const path = `tenants/${tenant}/life-movies/project-failure/attempt-1/keep.mp4`;
  const ref = await object(path);
  await first.set(makeJob(owner, 'project-failure', outputFor(ref)));
  await second.set(makeJob(owner, 'project-failure', outputFor(ref)));
  let signalStarted, delayedFinished = false;
  const delayedStarted = new Promise(resolveStarted => { signalStarted = resolveStarted; });
  onTransactionRead = async docRef => {
    if (docRef.id === first.id) { await delayedStarted; throw new Error('synthetic-fence-failure'); }
    if (docRef.id === second.id) {
      signalStarted();
      await new Promise(resolveDelay => setTimeout(resolveDelay, 150));
      delayedFinished = true;
    }
  };
  try {
    await assert.rejects(invalidate(event(owner)), codeIs('synthetic-fence-failure'));
    assert.equal(delayedFinished, true);
    assert.equal((await second.get()).get('status'), 'CANCELLED', 'the remaining transaction must finish before failure returns');
    assert.equal((await bucket.file(path).exists())[0], true, 'no Storage delete may begin after a fence failure');
    assert.equal((await first.get()).get('output').outputs[0].ref, ref);
    assert.equal((await second.get()).get('output').outputs[0].ref, ref);
  } finally { onTransactionRead = undefined; }
});
