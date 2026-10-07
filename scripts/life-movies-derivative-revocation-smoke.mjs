import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const clone = (value) => structuredClone(value);
const bucket = 'private-synthetic-fixture';
const consent = { purpose: 'life-movie.render', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-consent' };
const sourceArg = process.argv.indexOf('--source-ref');
const sourceRef = sourceArg < 0 ? null : process.argv[sourceArg + 1];
if (sourceArg >= 0) assert.match(sourceRef || '', /^[a-f0-9]{40}$/);
const emulator = process.argv.includes('--emulator');
let realDb, realFields, emulatorApp;
if (emulator) {
  // Never attach these synthetic fixtures to a real database.
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):[0-9]+$/);
  assert.match(process.env.GCLOUD_PROJECT || '', /^demo-/);
  const { initializeApp } = require('firebase-admin/app');
  const firestore = require('firebase-admin/firestore');
  emulatorApp = initializeApp({ projectId: process.env.GCLOUD_PROJECT }, `movie-revocation-${crypto.randomUUID()}`);
  realDb = firestore.getFirestore(emulatorApp); realFields = firestore;
}

const harnesses = [];
async function harness({ jobs = 1, plans = 1 } = {}) {
  const ownerUid = `fixture-${crypto.randomUUID()}`, tenantId = 'synthetic-tenant', projectId = 'synthetic-project';
  const documents = new Map(), objects = new Map(), versions = new Map();
  const state = { transactions: [], queries: [], storageCalls: 0, activeDeletes: 0, maxActiveDeletes: 0,
    storageFailure: false, failTransaction: 0, beforeTransaction: null, beforeStorage: null,
    afterStorage: null, fenceObserved: false };
  const ownedPaths = new Set();
  const event = { eventId: `event-${crypto.randomUUID()}`, ownerUid, purpose: consent.purpose, revokedAt: '2026-10-07T00:00:00.000Z' };
  const artifact = (id, role = 'segments') => ({ ref: `gs://${bucket}/tenants/${tenantId}/life-movies/${projectId}/${role}/${id}.mp4` });
  const ref = (path) => realDb ? realDb.doc(path) : { path, id: path.split('/').at(-1), get: async () => snapshot(ref(path)),
    collection: (name) => ({ add: async (value) => set(`${path}/${name}/${crypto.randomUUID()}`, value) }) };
  const snapshot = (reference) => { const value = clone(documents.get(reference.path)); return {
    ref: reference, id: reference.id, exists: value !== undefined, data: () => clone(value),
  }; };
  const get = async (path) => (await ref(path).get()).data();
  function patch(reference, values, merge = true) {
    const data = merge ? clone(documents.get(reference.path) || {}) : {};
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split('.'); let at = data;
      for (const part of parts.slice(0, -1)) at = at[part] ||= {};
      if (value === '__DELETE__') delete at[parts.at(-1)]; else at[parts.at(-1)] = clone(value);
    }
    documents.set(reference.path, data); versions.set(reference.path, (versions.get(reference.path) || 0) + 1);
  }
  async function set(path, value) {
    ownedPaths.add(path);
    if (realDb) await ref(path).set(value); else patch(ref(path), value, false);
  }
  async function seed(entries) {
    for (const [path] of entries) ownedPaths.add(path);
    if (!realDb) { for (const [path, value] of entries) patch(ref(path), value, false); return; }
    for (let offset = 0; offset < entries.length; offset += 100) {
      const batch = realDb.batch();
      for (const [path, value] of entries.slice(offset, offset + 100)) batch.set(ref(path), value);
      await batch.commit();
    }
  }
  const childIds = Array.from({ length: jobs }, (_, i) => `${ownerUid}-child-${String(i).padStart(4, '0')}`);
  const planIds = Array.from({ length: plans }, (_, i) => `${ownerUid}-plan-${String(i).padStart(4, '0')}`);
  const makeJob = (id, status = 'RUNNING') => ({ jobId: id, jobType: 'studio.render.video', sourceSystem: 'urai-studio',
    ownerUid, tenantId, status, consent, payload: { projectId }, lease: { token: 'fixture-lease' },
    execution: { leaseToken: 'fixture-lease', asyncCallbackPending: true, callbackTokenHash: 'fixture-hash',
      callbackLeaseToken: 'fixture-lease', callbackDeadlineAt: 'fixture-deadline' },
    output: { outputs: [artifact(id)] } });
  const entries = childIds.flatMap((id) => [[`jobs/${id}`, makeJob(id)], [`jobQueue/${id}`, { jobId: id, status: 'RUNNING', lease: { token: 'fixture-lease' } }]]);
  entries.push(...planIds.map((id) => [`studioLifeMovieLongformPlans/${id}`, { ownerUid, tenantId, projectId, consent, status: 'PENDING' }]));
  await seed(entries);
  for (const id of childIds) objects.set(artifact(id).ref, Buffer.from('synthetic-test-derivative'));
  const FieldValue = realFields?.FieldValue || { delete: () => '__DELETE__', serverTimestamp: () => 'fixture-timestamp' };
  const FieldPath = realFields?.FieldPath || { documentId: () => '__name__' };
  function query(collection, filters = [], cursor = null, limit = Infinity) {
    return {
      doc: (id) => ref(`${collection}/${id}`),
      where: (field, op, value) => { assert.equal(op, '=='); return query(collection, [...filters, [field, value]], cursor, limit); },
      orderBy: () => query(collection, filters, cursor, limit),
      limit: (n) => query(collection, filters, cursor, n),
      startAfter: (last) => query(collection, filters, last.id, limit),
      async get() {
        state.queries.push({ collection, limit });
        const docs = [...documents].filter(([path, value]) => path.startsWith(`${collection}/`) && path.split('/').length === 2
          && filters.every(([field, expected]) => value[field] === expected) && (!cursor || path.split('/')[1] > cursor))
          .sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([path]) => snapshot(ref(path)));
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  const db = {
    collection(name) {
      if (!realDb) return query(name);
      const wrap = (q) => new Proxy(q, { get(target, key) {
        if (key === 'get') return async () => { state.queries.push({ collection: name }); return target.get(); };
        if (['where', 'orderBy', 'limit', 'startAfter'].includes(key)) return (...args) => {
          if (key === 'limit') state.queries.push({ collection: name, limit: args[0] });
          return wrap(target[key](...args));
        };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
      } });
      return wrap(realDb.collection(name));
    },
    async runTransaction(callback) {
      const ordinal = state.transactions.length + 1;
      const hook = state.beforeTransaction; state.beforeTransaction = null; await hook?.(ordinal);
      if (state.failTransaction === ordinal) throw new Error('fixture_database_failure');
      const receipt = { writes: 0, paths: [] }; state.transactions.push(receipt);
      const execute = async (transaction) => {
        receipt.writes = 0; receipt.paths = [];
        const wrapped = new Proxy(transaction, { get(target, key) {
          if (['set', 'update'].includes(key)) return (reference, ...args) => {
            receipt.writes++; receipt.paths.push(reference.path); ownedPaths.add(reference.path);
            return target[key](reference, ...args);
          };
          const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
        } });
        return callback(wrapped);
      };
      if (realDb) return realDb.runTransaction(execute);
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(), writes = [];
        const transaction = {
          get: async (reference) => { reads.set(reference.path, versions.get(reference.path) || 0); return snapshot(reference); },
          getAll: async (...references) => Promise.all(references.map((reference) => transaction.get(reference))),
          update: (reference, values) => writes.push(() => { assert.ok(documents.has(reference.path)); patch(reference, values); }),
          set: (reference, values, options) => writes.push(() => patch(reference, values, options?.merge)),
        };
        const result = await execute(transaction);
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
        for (const write of writes) write(); return result;
      }
      throw new Error('fixture_transaction_conflict');
    },
    // Baseline compatibility imposes no invented 500-write service ceiling.
    batch() {
      const batch = realDb?.batch(), writes = [];
      return {
        update: (reference, values) => batch ? batch.update(reference, values) : writes.push(() => patch(reference, values)),
        set: (reference, values, options) => batch ? batch.set(reference, values, options) : writes.push(() => patch(reference, values, options?.merge)),
        commit: async () => { if (batch) await batch.commit(); else for (const write of writes) write(); },
      };
    },
  };
  const assertFence = async () => {
    for (const id of childIds) {
      const job = await get(`jobs/${id}`), queue = await get(`jobQueue/${id}`);
      assert.equal(job.status, 'CANCELLED', 'revocation must cancel live jobs before Storage I/O');
      assert.equal(job.derivativeAccessState, 'REVOKED');
      assert.equal(job.lease, undefined); assert.equal(job.execution.leaseToken, undefined);
      assert.equal(job.execution.asyncCallbackPending, false); assert.equal(job.execution.callbackTokenHash, undefined);
      assert.equal(job.execution.callbackLeaseToken, undefined); assert.equal(job.execution.callbackDeadlineAt, undefined);
      assert.equal(queue.status, 'CANCELLED'); assert.equal(queue.lease, undefined);
    }
    for (const id of planIds) {
      const plan = await get(`studioLifeMovieLongformPlans/${id}`);
      assert.equal(plan.status, 'CANCELLED'); assert.equal(plan.derivativeAccessState, 'REVOKED');
    }
  };
  const storage = { bucket: (name) => ({ file: (path) => ({ async delete(options) {
    assert.equal(options.ignoreNotFound, true); state.storageCalls++; state.activeDeletes++;
    state.maxActiveDeletes = Math.max(state.maxActiveDeletes, state.activeDeletes);
    try {
      await state.beforeStorage?.();
      if (state.storageFailure === true || (typeof state.storageFailure === 'function' && state.storageFailure(path))) throw new Error('fixture_storage_failure');
      objects.delete(`gs://${name}/${path}`); await state.afterStorage?.();
    } finally { state.activeDeletes--; }
  } }) }) };
  const exports = {};
  const filename = 'functions/src/privacy/lifeMovieDerivativeRevocation.ts';
  let source;
  if (sourceRef) {
    const baseline = spawnSync('git', ['show', `${sourceRef}:${filename}`], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
    assert.equal(baseline.status, 0, baseline.stderr); source = baseline.stdout;
  } else source = fs.readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, process: { env: { GCS_BUCKET_NAME: bucket } },
    require(name) {
      if (name === 'firebase-admin/firestore') return { FieldValue, FieldPath, getFirestore: () => db };
      if (name === 'firebase-admin/storage') return { getStorage: () => storage };
      if (name.endsWith('/firestore-paths.js')) return { jobQueueEntryDoc: (id) => ref(`jobQueue/${id}`) };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  function adminRetry(filename, name) {
    const adminExports = {};
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const code = fs.readFileSync(new URL(`../functions/src/jobs/${filename}`, import.meta.url), 'utf8');
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports: adminExports,
      require(importName) {
        if (importName === 'firebase-admin/firestore') return { FieldValue, getFirestore: () => db };
        if (importName === 'firebase-admin/app') return { getApps: () => [{}] };
        if (importName === 'firebase-functions/v1') return { https: { HttpsError, onCall: (handler) => handler } };
        if (importName === 'firebase-functions/v2/https') return { HttpsError, onCall: (_options, handler) => handler };
        throw new Error(`Unexpected admin import: ${importName}`);
      },
    });
    const auth = { uid: 'synthetic-operator', token: { role: 'operator' } };
    return (jobId) => filename === 'admin.ts'
      ? adminExports[name]({ jobId }, { auth }) : adminExports[name]({ data: { jobId }, auth });
  }
  const h = { state, event, db, get, set, seed, objects, artifact, childIds, planIds, makeJob, assertFence,
    invalidate: () => exports.invalidateLifeMovieDerivativesForConsent(event), ownedPaths,
    retryV1: adminRetry('admin.ts', 'retryJob'), retryV2: adminRetry('admin-v2.ts', 'retryJobV2') };
  harnesses.push(h); return h;
}

try {
  if (process.argv.includes('--reproduce-legacy-retry')) {
    assert.ok(sourceRef, 'unsafe retry reproduction requires an exact predecessor SHA');
    const legacy = await harness(), id = legacy.childIds[0], job = await legacy.get(`jobs/${id}`);
    job.status = 'FAILED'; delete job.consent; await legacy.set(`jobs/${id}`, job); await legacy.invalidate();
    await legacy.retryV1(id);
    assert.equal((await legacy.get(`jobs/${id}`)).status, 'PENDING');
    assert.equal((await legacy.get(`jobQueue/${id}`)).status, 'PENDING');
    const again = await legacy.get(`jobs/${id}`); again.status = 'FAILED'; await legacy.set(`jobs/${id}`, again);
    await legacy.retryV2(id);
    assert.equal((await legacy.get(`jobs/${id}`)).status, 'PENDING');
    assert.equal((await legacy.get(`jobQueue/${id}`)).status, 'PENDING');
    console.log(`[REPRODUCED] Exact predecessor ${sourceRef}: admin v1/v2 retry requeues a consent-revoked legacy FAILED render`);
  } else {
    const failed = await harness(); failed.state.storageFailure = true;
    await assert.rejects(failed.invalidate(), /fixture_storage_failure/); await failed.assertFence();
    assert.equal(failed.state.activeDeletes, 0);
    assert.equal((await failed.get(`jobs/${failed.childIds[0]}`)).outputDeletionState, 'PENDING');
    assert.ok((await failed.get(`jobs/${failed.childIds[0]}`)).output);
    failed.state.storageFailure = false; await failed.invalidate(); assert.equal(failed.objects.size, 0);
    assert.equal((await failed.get(`jobs/${failed.childIds[0]}`)).outputDeletionState, 'COMPLETE');
    console.log('[PASS] Storage failure leaves durable job/queue/plan fences and retryable output references');

    const partiallyDeleted = await harness({ jobs: 12 });
    partiallyDeleted.state.storageFailure = (path) => path.endsWith(`${partiallyDeleted.childIds[2]}.mp4`);
    await assert.rejects(partiallyDeleted.invalidate(), /fixture_storage_failure/); await partiallyDeleted.assertFence();
    assert.equal(partiallyDeleted.objects.size, 5); assert.equal(partiallyDeleted.state.activeDeletes, 0);
    assert.ok((await partiallyDeleted.get(`jobs/${partiallyDeleted.childIds[0]}`)).output);
    partiallyDeleted.state.storageFailure = false; await partiallyDeleted.invalidate(); assert.equal(partiallyDeleted.objects.size, 0);
    console.log('[PASS] A partially failed Storage group settles every in-flight request and retains all aliases for replay');

    const large = await harness({ jobs: 251, plans: 203 }); let observation;
    large.state.beforeStorage = () => observation ||= large.assertFence().then(() => { large.state.fenceObserved = true; });
    const summary = await large.invalidate();
    assert.equal(summary.jobsInvalidated, 251); assert.equal(summary.plansInvalidated, 203);
    assert.equal(summary.storageObjectsDeleted, 251); assert.equal(large.objects.size, 0);
    assert.equal(large.state.transactions.reduce((n, entry) => n + entry.writes, 0), 1159);
    assert.ok(large.state.transactions.every((entry) => entry.writes <= 200));
    assert.ok(large.state.queries.filter((entry) => entry.limit !== undefined).every((entry) => entry.limit <= 100));
    assert.ok(large.state.fenceObserved); assert.ok(large.state.maxActiveDeletes <= 8);
    console.log(`[PASS] ${emulator ? 'Firestore emulator' : 'Transaction adapter'}: 251 jobs + 203 plans, 1159 handler writes, bounded requests and Storage concurrency`);

    const aliases = await harness(), id = aliases.childIds[0], job = await aliases.get(`jobs/${id}`);
    job.result = job.output; delete job.output; await aliases.set(`jobs/${id}`, job);
    const terminalId = `${aliases.event.ownerUid}-terminal`, terminal = aliases.makeJob(terminalId, 'SUCCESS');
    terminal.completedAt = 'original-generation-completion'; terminal.output = terminal.result = { outputs: [aliases.artifact(terminalId)] };
    const legacyId = `${aliases.event.ownerUid}-legacy`, legacy = aliases.makeJob(legacyId); delete legacy.consent;
    const otherPurpose = aliases.makeJob(`${aliases.event.ownerUid}-other-purpose`); otherPurpose.consent = { ...consent, purpose: 'other-purpose' };
    const otherOwner = aliases.makeJob(`${aliases.event.ownerUid}-other-owner`); otherOwner.ownerUid += '-other';
    const otherType = aliases.makeJob(`${aliases.event.ownerUid}-other-type`); otherType.jobType = 'private.source.transcribe';
    const noConsentAssembly = aliases.makeJob(`${aliases.event.ownerUid}-assembly`); noConsentAssembly.jobType = 'studio.assemble.video'; delete noConsentAssembly.consent;
    await aliases.seed([terminal, legacy, otherPurpose, otherOwner, otherType, noConsentAssembly].map((value) => [`jobs/${value.jobId}`, value]));
    for (const value of [terminal, legacy]) aliases.objects.set(value.output.outputs[0].ref, Buffer.from('synthetic'));
    const aliasSummary = await aliases.invalidate(); assert.equal(aliasSummary.jobsInvalidated, 3); assert.equal(aliasSummary.storageObjectsDeleted, 3);
    const finished = await aliases.get(`jobs/${terminalId}`);
    assert.equal(finished.status, 'CANCELLED'); assert.equal(finished.completedAt, terminal.completedAt);
    assert.equal(finished.outputDeletionPreviousStatus, 'SUCCESS');
    assert.equal(finished.output, undefined); assert.equal(finished.result, undefined); assert.equal(finished.lease, undefined);
    for (const value of [otherPurpose, otherOwner, otherType, noConsentAssembly]) assert.equal((await aliases.get(`jobs/${value.jobId}`)).status, 'RUNNING');
    console.log('[PASS] Result-only aliases, duplicate references, legacy revocation and terminal history; other owners/purposes/types untouched');

    const validIds = await harness(), validJob = await validIds.get(`jobs/${validIds.childIds[0]}`);
    validJob.jobType = 'studio.assemble.video'; validJob.tenantId = 'tenant.with:namespace'; validJob.payload.projectId = 'project.with:era';
    const validRef = `gs://${bucket}/tenants/${validJob.tenantId}/life-movies/${validJob.payload.projectId}/final/a.mp4`;
    validJob.output = { outputs: [{ ref: validRef }] }; await validIds.set(`jobs/${validJob.jobId}`, validJob);
    validIds.objects.clear(); validIds.objects.set(validRef, Buffer.from('synthetic-assembly'));
    await validIds.invalidate(); await validIds.assertFence(); assert.equal(validIds.objects.size, 0);
    console.log('[PASS] Canonical dotted/colon tenant/project identifiers and an owned assembly remain supported');

    const partial = await harness({ jobs: 251, plans: 2 }); partial.state.failTransaction = 3;
    await assert.rejects(partial.invalidate(), /fixture_database_failure/); assert.equal(partial.state.storageCalls, 0);
    assert.equal((await partial.get(`jobs/${partial.childIds[0]}`)).status, 'CANCELLED');
    assert.equal((await partial.get(`jobs/${partial.childIds[150]}`)).status, 'RUNNING');
    partial.state.failTransaction = 0; await partial.invalidate(); await partial.assertFence(); assert.equal(partial.objects.size, 0);
    console.log('[PASS] Mid-fence database failure performs no Storage removal; event retry converges remaining jobs and plans');

    const cleanup = await harness({ jobs: 251, plans: 1 }); cleanup.state.failTransaction = 6;
    await assert.rejects(cleanup.invalidate(), /fixture_database_failure/); assert.equal(cleanup.objects.size, 0); await cleanup.assertFence();
    assert.equal((await cleanup.get(`jobs/${cleanup.childIds[0]}`)).output, undefined);
    assert.ok((await cleanup.get(`jobs/${cleanup.childIds[150]}`)).output);
    cleanup.state.failTransaction = 0; await cleanup.invalidate(); assert.equal((await cleanup.get(`jobs/${cleanup.childIds[250]}`)).output, undefined);
    console.log('[PASS] Partial metadata cleanup retains unswept references; replay finishes after physical deletion');

    const late = await harness();
    late.state.beforeTransaction = async (ordinal) => {
      if (ordinal === 1) late.state.beforeTransaction = async () => {
        const current = await late.get(`jobs/${late.childIds[0]}`), newArtifact = late.artifact('published-after-query');
        current.result = { outputs: [newArtifact] }; await late.set(`jobs/${late.childIds[0]}`, current);
        late.objects.set(newArtifact.ref, Buffer.from('synthetic-late-result'));
      };
    };
    assert.equal((await late.invalidate()).storageObjectsDeleted, 2); assert.equal(late.objects.size, 0);
    console.log('[PASS] Transaction re-read captures a worker result published after the owner query');

    const changed = await harness(); let changedOnce = false;
    changed.state.afterStorage = async () => {
      if (changedOnce) return; changedOnce = true;
      const current = await changed.get(`jobs/${changed.childIds[0]}`), newArtifact = changed.artifact('unexpected-late-output');
      current.result = { outputs: [newArtifact] }; await changed.set(`jobs/${changed.childIds[0]}`, current);
      changed.objects.set(newArtifact.ref, Buffer.from('synthetic-unexpected-output'));
    };
    await assert.rejects(changed.invalidate(), /life_movie_revocation_outputs_changed_retry/);
    assert.ok((await changed.get(`jobs/${changed.childIds[0]}`)).result); await changed.invalidate(); assert.equal(changed.objects.size, 0);
    console.log('[PASS] Outputs changed during cleanup retain aliases and force retry rather than lose the new object location');

    for (const invalid of ['gs://unallowed-bucket/tenants/synthetic-tenant/life-movies/synthetic-project/a.mp4',
      `gs://${bucket}/tenants/other-tenant/life-movies/synthetic-project/a.mp4`,
      `gs://${bucket}/tenants/synthetic-tenant/life-movies/other-project/a.mp4`,
      `gs://${bucket}/tenants/synthetic-tenant/life-movies/synthetic-project/../a.mp4`,
      `gs://${bucket}/tenants/synthetic-tenant/life-movies/synthetic-project/a\\b.mp4`]) {
      const boundary = await harness(), current = await boundary.get(`jobs/${boundary.childIds[0]}`);
      current.output = { outputs: [{ ref: invalid }] }; await boundary.set(`jobs/${boundary.childIds[0]}`, current);
      await assert.rejects(boundary.invalidate(), /life_movie_revocation_output_boundary_mismatch/);
      await boundary.assertFence(); assert.equal(boundary.state.storageCalls, 0);
      assert.ok((await boundary.get(`jobs/${boundary.childIds[0]}`)).output);
    }
    console.log('[PASS] Invalid bucket/tenant/project/traversal paths cannot prevent cancellation and never reach Storage');

    const replay = await harness(); await replay.invalidate();
    const before = await replay.get(`jobs/${replay.childIds[0]}`), callsBefore = replay.state.storageCalls;
    await replay.invalidate(); const after = await replay.get(`jobs/${replay.childIds[0]}`);
    assert.deepEqual(after.completedAt, before.completedAt); assert.deepEqual(after.outputDeletedAt, before.outputDeletedAt);
    assert.equal(replay.state.storageCalls, callsBefore);
    replay.event.purpose = 'other-purpose'; const noOp = await replay.invalidate();
    assert.equal(noOp.jobsInvalidated, 0); assert.equal(noOp.plansInvalidated, 0);
    console.log('[PASS] Replay preserves completion history with no duplicate Storage work; unrelated purpose is a no-op');

    const legacyFailure = await harness(), failureId = legacyFailure.childIds[0];
    const legacyFailedJob = await legacyFailure.get(`jobs/${failureId}`);
    legacyFailedJob.status = 'FAILED'; legacyFailedJob.completedAt = 'original-failed-generation-time'; delete legacyFailedJob.consent;
    await legacyFailure.set(`jobs/${failureId}`, legacyFailedJob); await legacyFailure.invalidate();
    await assert.rejects(legacyFailure.retryV1(failureId), /cannot be retried from status CANCELLED/);
    await assert.rejects(legacyFailure.retryV2(failureId), /cannot be retried from status CANCELLED/);
    assert.equal((await legacyFailure.get(`jobs/${failureId}`)).completedAt, legacyFailedJob.completedAt);
    assert.equal((await legacyFailure.get(`jobs/${failureId}`)).outputDeletionPreviousStatus, 'FAILED');
    console.log('[PASS] Actual admin v1/v2 retry callables cannot reopen a revoked legacy FAILED render; original completion/status retained');
  }
} finally {
  if (realDb) {
    const paths = [...new Set(harnesses.flatMap((h) => [...h.ownedPaths]))];
    for (let offset = 0; offset < paths.length; offset += 100) {
      const batch = realDb.batch(); for (const path of paths.slice(offset, offset + 100)) batch.delete(realDb.doc(path));
      await batch.commit();
    }
    const { deleteApp } = require('firebase-admin/app'); await deleteApp(emulatorApp);
  }
}
