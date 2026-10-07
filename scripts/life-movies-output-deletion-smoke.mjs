import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const { z } = require('zod');
const tenantId = 'tenant-fixture-1', ownerUid = 'owner-fixture-1', projectId = 'project-fixture-1';
const planId = `lmp_${'a'.repeat(24)}`, childId = 'child-fixture-1', assemblyId = 'assembly-fixture-1';
const prefix = `tenants/${tenantId}/life-movies/${projectId}`;
const bucket = 'private-fixture-bucket';
const consent = { purpose: 'life-movie.render', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-consent' };
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = (value) => structuredClone(value);
const sourceArg = process.argv.indexOf('--source-ref');
const sourceRef = sourceArg < 0 ? null : process.argv[sourceArg + 1];
if (sourceArg >= 0) assert.match(sourceRef || '', /^[a-f0-9]{40}$/, 'baseline source must be an exact SHA');

function fixtures(status = 'RUNNING') {
  const artifact = (kind, role) => ({ kind, ref: `gs://${bucket}/${prefix}/${role}/attempt-fixture/${kind}`, checksum: 'a'.repeat(64) });
  const child = { jobId: childId, type: 'studio.render.video', jobType: 'studio.render.video', status,
    sourceSystem: 'urai-studio', ownerUid, tenantId, consent, lease: { token: 'lease-fixture' },
    payload: { projectId }, execution: { leaseToken: 'lease-fixture', parentJobId: planId, rootJobId: planId },
    output: { outputs: [artifact('mp4', 'segments'), artifact('srt', 'segments')] } };
  const assembly = { ...clone(child), jobId: assemblyId, type: 'studio.assemble.video', jobType: 'studio.assemble.video',
    output: { outputs: [artifact('mp4', 'final'), artifact('srt', 'final')] } };
  const plan = { planId, schemaVersion: 'urai-life-movie-longform-plan-v1', status: 'PENDING', ownerUid, tenantId,
    projectId, consent, renderPlanDigest: 'a'.repeat(64), sceneTruthDigest: 'b'.repeat(64),
    sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`, width: 320, height: 320, fps: 30,
    childJobIds: [childId], assemblyJobId: assemblyId,
    segments: [{ index: 0, startMs: 0, endMs: 15000, childDigest: 'c'.repeat(64), jobId: childId }] };
  return { child, assembly, plan };
}

function harness(status = 'RUNNING') {
  const f = fixtures(status), documents = new Map(), versions = new Map(), objects = new Map();
  const state = { documents, objects, storageCalls: 0, storageFailure: false, storageGate: null,
    beforeNextTransaction: null, storageObservations: [], signedUrls: 0 };
  const ref = (name) => ({ path: name, id: name.split('/').at(-1), get: async () => snapshot(ref(name)),
    collection: (name2) => ({ doc: (id) => ref(`${name}/${name2}/${id}`) }) });
  const snapshot = (reference) => ({ ref: reference, id: reference.id, exists: documents.has(reference.path),
    data: () => clone(documents.get(reference.path)) });
  function patch(reference, values, merge = true) {
    const data = merge ? clone(documents.get(reference.path) || {}) : {};
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split('.'); let at = data;
      for (const part of parts.slice(0, -1)) at = at[part] ||= {};
      if (value === '__FIELD_DELETE__') delete at[parts.at(-1)]; else at[parts.at(-1)] = clone(value);
    }
    documents.set(reference.path, data); versions.set(reference.path, (versions.get(reference.path) || 0) + 1);
  }
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    getAll: async (...refs) => refs.map(snapshot),
    async runTransaction(callback) {
      const before = state.beforeNextTransaction; state.beforeNextTransaction = null; await before?.();
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(), writes = [];
        const transaction = {
          get: async (reference) => { reads.set(reference.path, versions.get(reference.path) || 0); return snapshot(reference); },
          getAll: async (...refs) => Promise.all(refs.map((reference) => transaction.get(reference))),
          update: (reference, values) => writes.push(() => patch(reference, values)),
          set: (reference, values, options) => writes.push(() => patch(reference, values, options?.merge)),
          create: (reference, values) => writes.push(() => { assert.equal(documents.has(reference.path), false); patch(reference, values, false); }),
        };
        const result = await callback(transaction);
        if ([...reads].some(([name, version]) => (versions.get(name) || 0) !== version)) continue;
        for (const write of writes) write(); return result;
      }
      throw new Error('fixture_transaction_conflict');
    },
    batch() { const writes = []; return {
      update: (reference, values) => writes.push(() => patch(reference, values)),
      set: (reference, values, options) => writes.push(() => patch(reference, values, options?.merge)),
      commit: async () => { for (const write of writes) write(); },
    }; },
  };
  for (const [name, value] of [[`jobs/${childId}`, f.child], [`jobs/${assemblyId}`, f.assembly],
    [`studioLifeMovieLongformPlans/${planId}`, f.plan]]) patch(ref(name), value, false);
  for (const job of [f.child, f.assembly]) for (const artifact of job.output.outputs) objects.set(artifact.ref, Buffer.from('synthetic-derivative'));
  const storage = { bucket: (bucketName) => ({ file: (objectPath) => ({
    async delete() {
      state.storageCalls++;
      state.storageObservations.push({ child: clone(documents.get(`jobs/${childId}`)),
        assembly: clone(documents.get(`jobs/${assemblyId}`)), plan: clone(documents.get(`studioLifeMovieLongformPlans/${planId}`)) });
      await state.storageGate?.();
      if (state.storageFailure) throw new Error('fixture_storage_failure');
      objects.delete(`gs://${bucketName}/${objectPath}`);
    },
    getSignedUrl: async () => { state.signedUrls++; return ['https://fixture.invalid/private']; },
    download: async () => [Buffer.from('')],
  }) }) };
  const FieldValue = { delete: () => '__FIELD_DELETE__', serverTimestamp: () => 'fixture-timestamp' };
  function loadBridge(filename, names) {
    const exports = {};
    let source;
    if (sourceRef) {
      const baseline = spawnSync('git', ['show', `${sourceRef}:functions/src/jobs/${filename}`],
        { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
      assert.equal(baseline.status, 0, baseline.stderr); source = baseline.stdout;
    } else source = fs.readFileSync(new URL(`../functions/src/jobs/${filename}`, import.meta.url), 'utf8');
    source += `\nexport const testApi = { ${names.join(', ')} };`;
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Buffer, console, setTimeout, clearTimeout, AbortController, process: { env: { GCS_BUCKET_NAME: bucket, URAI_ENV: 'test' } },
      require(name) {
        if (name === 'firebase-admin/firestore') return { FieldValue, getFirestore: () => db };
        if (name === 'firebase-admin/storage') return { getStorage: () => storage };
        if (name === 'firebase-functions/params') return { defineSecret: () => ({ value: () => 'fixture-secret' }) };
        if (name === 'firebase-functions/v2/https') return { onRequest: (_options, handler) => handler };
        if (name.endsWith('/firestore-paths.js')) return { jobDoc: (id) => ref(`jobs/${id}`), jobQueueEntryDoc: (id) => ref(`jobQueueEntries/${id}`) };
        if (name.endsWith('/consentBlocks.js')) return { consentBlockRef: () => ref('jobConsentBlocks/fixture'), isConsentContext: value => !!value && ['purpose', 'policyVersion', 'decisionReceiptId'].every(key => typeof value[key] === 'string' && value[key].length > 0) };
        if (name.endsWith('/jobsReliability.js')) return { bindingMatches: () => false,
          buildIdempotencyBindingId: digest, buildRequestFingerprint: (_type, value) => digest(value) };
        if (name.endsWith('/sceneTruthReceipt.js')) return { assertSceneTruthReceiptValue() {} };
        if (name.endsWith('/studioLifeMovieLongformContract.js')) return { StudioLifeMovieLongformPayloadSchema: z.any() };
        if (name.endsWith('/privateMediaDelivery.js')) return loadBridge('privateMediaDelivery.ts', ['assertPrivateMediaOwnerActive', 'inspectPrivateMedia', 'privateMediaDescriptor', 'streamPrivateMedia']);
        if (name.endsWith('/studioLifeMovieContract.js')) return { StudioLifeMovieRenderPayloadSchema: z.any() };
        return require(name);
      },
    });
    return exports.testApi;
  }
  const long = loadBridge('studioLifeMovieLongformBridge.ts', ['deletePlanOutputs', 'resumePlan', 'assemblePlan', 'readPlanPlayback']);
  const short = loadBridge('studioLifeMovieBridge.ts', ['deleteBoundMovieOutput']);
  async function assertWorkerFenced(job) {
    const module = {};
    const workerCode = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
    const app = { use() {}, get() {}, post() {}, listen() {} };
    const express = Object.assign(() => app, { json: () => () => {} });
    vm.runInNewContext(workerCode + '\nmodule.exports = { createRenderControl };', {
      module, Buffer, AbortController, console: { log() {}, error() {} }, process: { env: { URAI_ENV: 'test' } },
      require(name) {
        if (name === 'express') return express;
        if (name === 'firebase-admin') return { initializeApp() {}, firestore: () => db };
        return require(name);
      },
    });
    const control = module.exports.createRenderControl({ ...clone(job), leaseToken: 'lease-fixture' });
    try { await assert.rejects(control.start(), /render_lease_revoked/); } finally { control.stop(); }
  }
  return { ...state, state, long, short, f, db, get: (name) => documents.get(name),
    set: (name, value) => patch(ref(name), value, false), assertWorkerFenced };
}
function assertFence(h) {
  for (const id of [childId, assemblyId]) {
    assert.equal(h.get(`jobs/${id}`).status, 'CANCELLED', 'deletion must cancel every owned attempt');
    assert.equal(h.get(`jobs/${id}`).execution.leaseToken, undefined, 'deletion must revoke the lease before removing storage');
  }
  assert.equal(h.get(`studioLifeMovieLongformPlans/${planId}`).status, 'CANCELLED');
}
function gate() {
  let resolve, entered;
  const blocked = new Promise((done) => { resolve = done; });
  const started = new Promise((done) => { entered = done; });
  return { resolve, started, wait: async () => { entered(); await blocked; } };
}

const live = harness();
await live.long.deletePlanOutputs(planId, tenantId, ownerUid);
assertFence(live);
assert.equal(live.objects.size, 0);
assert.ok(live.state.storageObservations.every((snapshot) => snapshot.child.status === 'CANCELLED' && snapshot.assembly.status === 'CANCELLED'));
await live.assertWorkerFenced(live.f.child);
await live.assertWorkerFenced(live.f.assembly);
console.log('[PASS] Long-form deletion fences child/assembly leases and the parent before any storage removal');

const resultOnly = harness('SUCCESS');
for (const id of [childId, assemblyId]) {
  const job = clone(resultOnly.get(`jobs/${id}`)); job.result = job.output; delete job.output;
  resultOnly.set(`jobs/${id}`, job);
}
await resultOnly.long.deletePlanOutputs(planId, tenantId, ownerUid);
assert.equal(resultOnly.objects.size, 0);
for (const id of [childId, assemblyId]) assert.equal(resultOnly.get(`jobs/${id}`).result, undefined);
for (const id of [childId, assemblyId]) assert.equal(resultOnly.get(`jobs/${id}`).outputDeletionPreviousStatus, 'SUCCESS');
console.log('[PASS] Long-form deletion removes result-only artifacts and scrubs both aliases');

const failed = harness(); failed.state.storageFailure = true;
await assert.rejects(failed.long.deletePlanOutputs(planId, tenantId, ownerUid), /fixture_storage_failure/);
assertFence(failed);
await assert.rejects(failed.long.resumePlan(planId, tenantId, ownerUid), /longform_plan_cancelled/);
failed.state.storageFailure = false;
await failed.long.deletePlanOutputs(planId, tenantId, ownerUid);
assert.equal(failed.objects.size, 0);
console.log('[PASS] Failed storage cleanup retains permanent access/lease fences and can be retried');

for (const action of ['resumePlan', 'assemblePlan']) {
  const h = harness(action === 'resumePlan' ? 'FAILED' : 'SUCCESS');
  const paused = gate(); h.state.beforeNextTransaction = paused.wait;
  const operation = h.long[action](planId, tenantId, ownerUid);
  const result = operation.then(() => ({ passed: true }), (error) => ({ error }));
  await paused.started;
  await h.long.deletePlanOutputs(planId, tenantId, ownerUid);
  paused.resolve(); const outcome = await result;
  assert.equal(outcome.passed, undefined, `stale ${action} must not resurrect deleted work`);
  assert.match(outcome.error.message, /longform_plan_cancelled/);
  assertFence(h);
}
console.log('[PASS] Resume/assembly that loaded an older parent cannot recreate jobs after deletion');

const pending = harness('SUCCESS'), stalled = gate(); pending.state.storageGate = stalled.wait;
const deletion = pending.long.deletePlanOutputs(planId, tenantId, ownerUid);
await stalled.started;
await assert.rejects(pending.long.readPlanPlayback(planId, tenantId, ownerUid), /longform_plan_not_ready_for_playback|longform_plan_cancelled/);
assert.equal(pending.state.signedUrls, 0);
stalled.resolve(); await deletion;
console.log('[PASS] In-flight deletion denies playback before storage cleanup finishes');

for (const mutate of [
  (h) => { const child = clone(h.get(`jobs/${childId}`)); child.ownerUid = 'other-owner'; h.set(`jobs/${childId}`, child); },
  (h) => { const child = clone(h.get(`jobs/${childId}`)); child.execution.parentJobId = 'other-plan'; h.set(`jobs/${childId}`, child); },
]) {
  const h = harness(); mutate(h);
  await assert.rejects(h.long.deletePlanOutputs(planId, tenantId, ownerUid), /longform_segment_binding_mismatch/);
  assert.equal(h.state.storageCalls, 0);
}
console.log('[PASS] Deletion refuses another owner or parent-bound job before storage mutation');

const short = harness(), shortJob = clone(short.get(`jobs/${childId}`));
shortJob.result = shortJob.output; delete shortJob.output; short.set(`jobs/${childId}`, shortJob);
await short.short.deleteBoundMovieOutput(tenantId, ownerUid, childId);
assert.equal(short.get(`jobs/${childId}`).status, 'CANCELLED');
assert.equal(short.get(`jobs/${childId}`).execution.leaseToken, undefined);
assert.equal(short.get(`jobs/${childId}`).result, undefined);
assert.equal(short.state.storageCalls, 2);
assert.ok(short.state.storageObservations.every((snapshot) => snapshot.child.status === 'CANCELLED'));
await short.assertWorkerFenced(shortJob);
console.log('[PASS] Short deletion fences active lease, removes result-only bytes and scrubs aliases');

const duplicate = harness('SUCCESS');
for (const id of [childId, assemblyId]) {
  const job = clone(duplicate.get(`jobs/${id}`)); job.result = job.output; duplicate.set(`jobs/${id}`, job);
}
await duplicate.long.deletePlanOutputs(planId, tenantId, ownerUid);
assert.equal(duplicate.state.storageCalls, 4);
await duplicate.long.deletePlanOutputs(planId, tenantId, ownerUid);
assert.equal(duplicate.state.storageCalls, 4, 'completed deletion must be idempotent');
for (const id of [childId, assemblyId]) assert.equal(duplicate.get(`jobs/${id}`).outputDeletionPreviousStatus, 'SUCCESS');
console.log('[PASS] Duplicate output/result aliases delete once; repeated deletion preserves completion history');

const shortFailure = harness(); shortFailure.state.storageFailure = true;
await assert.rejects(shortFailure.short.deleteBoundMovieOutput(tenantId, ownerUid, childId), /fixture_storage_failure/);
assert.equal(shortFailure.get(`jobs/${childId}`).status, 'CANCELLED');
assert.equal(shortFailure.get(`jobs/${childId}`).execution.leaseToken, undefined);
shortFailure.state.storageFailure = false;
await shortFailure.short.deleteBoundMovieOutput(tenantId, ownerUid, childId);
assert.equal(shortFailure.get(`jobs/${childId}`).outputDeletionState, 'COMPLETE');
console.log('[PASS] Short cleanup failure keeps access/lease fences and exact artifact references for retry');

const foreignProject = harness();
const wrong = clone(foreignProject.get(`jobs/${childId}`));
wrong.output.outputs[0].ref = `gs://${bucket}/tenants/${tenantId}/life-movies/another-project/segments/private.mp4`;
foreignProject.set(`jobs/${childId}`, wrong);
await assert.rejects(foreignProject.short.deleteBoundMovieOutput(tenantId, ownerUid, childId), /output_delete_boundary_mismatch/);
assert.equal(foreignProject.state.storageCalls, 0);
console.log('[PASS] Short deletion rejects another project inside the same tenant');

console.log('Life Movie deletion behavior passed with explicit in-memory Firestore/private-storage adapters; no deployed runtime, provider or private-media acceptance claimed');
