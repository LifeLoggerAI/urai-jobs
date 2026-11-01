import assert from 'node:assert/strict';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import vm from 'node:vm';

// This suite exercises the actual TypeScript functions with local in-memory
// substitutes. It is not a Firestore, Storage, or Functions emulator test.
const deleted = { __fieldDelete: true };
const FieldValue = { delete: () => deleted, serverTimestamp: () => 'synthetic-time' };
const clone = value => value === undefined ? undefined : structuredClone(value);
// The source implementation fingerprints job type plus the full stable payload.
const stableValue = value => Array.isArray(value) ? value.map(stableValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stableValue(nested)]))
    : value;
const fingerprint = (jobType, payload) => createHash('sha256')
  .update(JSON.stringify(stableValue({ jobType, payload }))).digest('hex');

function fakeDatabase() {
  const docs = new Map();
  const ref = (collection, id) => ({
    id, path: `${collection}/${id}`,
    collection: sub => ({ doc: name => ref(`${collection}/${id}/${sub}`, name) }),
    async get() { return snapshot(this); },
    async set(value, options) { write(this, value, options?.merge); },
  });
  function snapshot(r) {
    const value = clone(docs.get(r.path));
    return { id: r.id, ref: r, exists: value !== undefined, data: () => clone(value) };
  }
  function write(r, data, merge = false) {
    const target = merge ? (clone(docs.get(r.path)) ?? {}) : {};
    for (const [path, value] of Object.entries(data)) {
      const parts = path.split('.');
      let cursor = target;
      for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
      if (value?.__fieldDelete) delete cursor[parts.at(-1)];
      else cursor[parts.at(-1)] = clone(value);
    }
    docs.set(r.path, target);
  }
  const db = {
    docs,
    collection(name) {
      return {
        doc: id => ref(name, id),
        where(field, _op, expected) { return { async get() {
          const all = [...docs.keys()].filter(path => path.startsWith(`${name}/`) && path.split('/').length === 2)
            .map(path => ref(name, path.split('/')[1])).map(snapshot).filter(s => s.data()?.[field] === expected);
          return { docs: all, size: all.length };
        } }; },
      };
    },
    async getAll(...refs) { return refs.map(snapshot); },
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async r => snapshot(r), getAll: async (...refs) => refs.map(snapshot),
        update: (r, value) => writes.push(() => write(r, value, true)),
        set: (r, value, options) => writes.push(() => write(r, value, options?.merge)),
        create: (r, value) => writes.push(() => write(r, value)),
      };
      const result = await fn(tx);
      for (const operation of writes) operation();
      return result;
    },
    batch() {
      const operations = [];
      return { update: (r, data) => operations.push(() => write(r, data, true)),
        async commit() { operations.forEach(operation => operation()); } };
    },
  };
  return db;
}

function fakeStorage() {
  const objects = new Map();
  const state = { objects, onDelete: undefined, onAfterDelete: undefined };
  state.bucket = bucket => ({ file: (path, options) => ({
    async getSignedUrl() { return ['https://fixture.invalid/signed-movie']; },
    async getMetadata() {
      const generation = objects.get(`${bucket}/${path}`);
      if (!generation) throw Object.assign(new Error('missing'), { code: 404 });
      return [{ generation }];
    },
    async delete() {
      if (state.onDelete) await state.onDelete(bucket, path);
      const key = `${bucket}/${path}`, generation = objects.get(key);
      if (!generation) throw Object.assign(new Error('missing'), { code: 404 });
      if (options?.preconditionOpts?.ifGenerationMatch !== undefined
          && String(options.preconditionOpts.ifGenerationMatch) !== String(generation)) {
        throw Object.assign(new Error('precondition'), { code: 412 });
      }
      objects.delete(key);
      if (state.onAfterDelete) await state.onAfterDelete(bucket, path);
    },
  }) });
  return state;
}

const schema = new Proxy(() => schema, { get: (_target, key) =>
  key === 'safeParse' ? value => ({ success: true, data: value }) : () => schema });
const z = new Proxy({}, { get: () => () => schema });
const moduleSources = {
  short: '../../functions/src/jobs/studioLifeMovieBridge.ts',
  long: '../../functions/src/jobs/studioLifeMovieLongformBridge.ts',
  revocation: '../../functions/src/privacy/lifeMovieDerivativeRevocation.ts',
};
async function environment() {
  const db = fakeDatabase(), storage = fakeStorage();
  const ctx = vm.createContext({ Buffer, console, Date, Error, Object, Promise, Set, Map,
    process: { env: { GCS_BUCKET_NAME: 'private-bucket', FUNCTIONS_EMULATOR: 'true' } } });
  const stubs = {
    'node:crypto': { createHash, timingSafeEqual },
    'node:util': { isDeepStrictEqual },
    'firebase-admin/firestore': { FieldValue, getFirestore: () => db },
    'firebase-admin/storage': { getStorage: () => storage },
    'firebase-functions/params': { defineSecret: () => ({ value: () => '' }) },
    'firebase-functions/v2/https': { onRequest: (_options, handler) => handler },
    ulid: { ulid: () => 'synthetic-ulid' }, zod: { z },
    '../core/firestore-paths.js': {
      jobDoc: id => db.collection('jobs').doc(id),
      jobQueueEntryDoc: id => db.collection('jobQueue').doc(id),
    },
    '../core/jobsReliability.js': { bindingMatches() {}, buildIdempotencyBindingId() {}, buildRequestFingerprint: fingerprint },
    './studioLifeMovieContract.js': { StudioLifeMovieCreateRequestSchema: schema, LifeMovieConsentReferenceSchema: schema,
      assertLifeMovieTenantPaths() {}, assertStudioLifeMovieRenderPlanDigest: value => value },
    './studioLifeMovieLongformContract.js': { StudioLifeMovieLongformPayloadSchema: schema,
      assertLifeMovieLongformTenantPaths() {}, assertStudioLifeMovieLongformPlanDigest: value => value,
      planLifeMovieLongformSegments() {} },
    './sceneTruthReceipt.js': { assertSceneTruthReceiptValue() {} },
    '../privacy/consentBlocks.js': { consentBlockRef: () => db.collection('blocks').doc('block'), isConsentContext: () => true },
    '../privacy/lifeMovieConsentGate.js': { LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE: 'closed', lifeMovieConsentAuthorityAvailable: () => false },
    './consentBlocks.js': { consentEventReceiptRef: id => db.collection('receipts').doc(id) },
  };
  async function load(name, extraExports) {
    const url = new URL(moduleSources[name], import.meta.url);
    const expose = name === 'revocation' ? '' : `\nexport { ${extraExports} };\n`;
    const source = stripTypeScriptTypes(readFileSync(url, 'utf8') + expose, { mode: 'strip' });
    const mod = new vm.SourceTextModule(source, { context: ctx, identifier: url.href });
    await mod.link(async specifier => {
      const helpers = {
        './lifeMovieOwnerDeletion.js': '../../functions/src/jobs/lifeMovieOwnerDeletion.ts',
        './lifeMovieArtifactRefs.js': '../../functions/src/privacy/lifeMovieArtifactRefs.ts',
        '../privacy/lifeMovieArtifactRefs.js': '../../functions/src/privacy/lifeMovieArtifactRefs.ts',
        '../privacy/lifeMovieOutputGeneration.js': '../../functions/src/privacy/lifeMovieOutputGeneration.ts',
      };
      if (helpers[specifier]) {
        const file = new URL(helpers[specifier], import.meta.url);
        return new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' }),
          { context: ctx, identifier: file.href });
      }
      const values = stubs[specifier];
      if (!values) throw new Error(`Missing test substitute: ${specifier}`);
      return new vm.SyntheticModule(Object.keys(values), function() {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context: ctx });
    });
    await mod.evaluate();
    return mod.namespace;
  }
  return { db, storage, load };
}

const tenant = 'tenant-a', owner = 'owner-a', project = 'project-a';
const path = (p, file) => `tenants/${tenant}/life-movies/${p}/${file}`;
const ref = p => `gs://private-bucket/${p}`;
const output = p => ({ outputs: [{ kind: 'mp4', ref: ref(p) }] });
const shortJob = (extra = {}) => ({ jobId: 'job-1234567890', tenantId: tenant, ownerUid: owner,
  sourceSystem: 'urai-studio', jobType: 'studio.render.video', status: 'SUCCESS',
  payload: { projectId: project, outputPrefix: path(project, '') }, ...extra });
const put = (env, id, job) => env.db.collection('jobs').doc(id).set(job);

test('short-form signed playback requires exact source output and owner project binding', async () => {
  const env = await environment();
  const clip = path(project, 'renders/clip.mp4');
  const digest = 'a'.repeat(64), truth = 'b'.repeat(64), receipt = 'scene-truth-receipt';
  const payload = {
    projectId: project, outputPrefix: path(project, 'renders/'),
    renderPlanDigest: digest, sceneTruthDigest: truth, sceneTruthReceiptRef: receipt,
  };
  const movieOutput = {
    renderPlanDigest: digest, sceneTruthDigest: truth, sceneTruthReceiptRef: receipt,
    outputs: [{ kind: 'mp4', ref: ref(clip), mimeType: 'video/mp4', generation: '1793378565000001' }],
  };
  const original = shortJob({ payload, output: movieOutput,
    consent: { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'c'.repeat(64) } });
  await put(env, original.jobId, original);
  const { signedMovieAccess } = await env.load('short', 'signedMovieAccess');
  const result = await signedMovieAccess(tenant, owner, original.jobId, 'inline');
  assert.equal(result.video.url, 'https://fixture.invalid/signed-movie');
  for (const invalid of [
    { payload: { ...payload, projectId: 'another-project' } },
    { payload: { ...payload, renderPlanDigest: 'd'.repeat(64) } },
    { payload: { ...payload, sceneTruthDigest: 'd'.repeat(64) } },
    { output: { ...movieOutput, sceneTruthReceiptRef: 'other-receipt' } },
    { output: { ...movieOutput, outputs: [{ kind: 'mp4', ref: ref(path('project-b', 'movie.mp4')) }] } },
    { output: { ...movieOutput, unknownDerivative: ref(clip) } },
    { outputDeletionInFlightUnresolved: true },
  ]) {
    await put(env, original.jobId, { ...original, ...invalid });
    await assert.rejects(signedMovieAccess(tenant, owner, original.jobId, 'inline'));
  }
});

test('short-form deletion cannot delete another project', async () => {
  const env = await environment();
  const other = path('project-b', 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(other) }));
  env.storage.objects.set(`private-bucket/${other}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'));
  assert.ok(env.storage.objects.has(`private-bucket/${other}`));
});

test('short-form deletion handles output and distinct result artifacts', async () => {
  const env = await environment();
  const first = path(project, 'one.mp4'), second = path(project, 'two.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(first), result: output(second) }));
  env.storage.objects.set(`private-bucket/${first}`, '1');
  env.storage.objects.set(`private-bucket/${second}`, '2');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await deleteBoundMovieOutput(tenant, owner, 'job-1234567890');
  assert.equal(env.storage.objects.size, 0);
});

test('short-form deletion preserves a concurrently changed reference', async () => {
  const env = await environment();
  const first = path(project, 'old.mp4'), second = path(project, 'new.mp4');
  const job = env.db.collection('jobs').doc('job-1234567890');
  await job.set(shortJob({ output: output(first) }));
  env.storage.objects.set(`private-bucket/${first}`, '1');
  env.storage.onDelete = async () => { await job.set({ output: output(second) }, { merge: true }); };
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'));
  assert.deepEqual((await job.get()).data().output, output(second));
});

test('long-form cancellation cannot cancel a different owner’s child', async () => {
  const env = await environment();
  const planId = 'lmp_01234567890123456789';
  const childId = `lms_${createHash('sha256').update(`${planId}:0000`).digest('hex').slice(0, 32)}_0000`;
  await env.db.collection('studioLifeMovieLongformPlans').doc(planId).set({ planId, tenantId: tenant, ownerUid: owner,
    projectId: project, status: 'PENDING', childJobIds: [childId], segments: [{ jobId: childId, index: 0 }] });
  await put(env, childId, shortJob({ jobId: childId, ownerUid: 'other-owner', status: 'RUNNING', execution: { parentJobId: planId, rootJobId: planId } }));
  const { cancelPlan } = await env.load('long', 'cancelPlan');
  await assert.rejects(cancelPlan(planId, tenant, owner));
  assert.equal((await env.db.collection('jobs').doc(childId).get()).data().status, 'RUNNING');
});

test('revocation does not acknowledge a previously cancelled running worker', async () => {
  const env = await environment();
  await put(env, 'job-1234567890', shortJob({ status: 'RUNNING' }));
  const { cancelBoundJob } = await env.load('short', 'cancelBoundJob');
  await cancelBoundJob(tenant, owner, 'job-1234567890');
  const { invalidateLifeMovieDerivativesForConsent } = await env.load('revocation', 'invalidateLifeMovieDerivativesForConsent');
  await assert.rejects(invalidateLifeMovieDerivativesForConsent({ eventId: 'event-a', ownerUid: owner,
    purpose: 'life-movie.render', revokedAt: '2026-10-29T00:00:00Z' }));
});

test('a replacement generation is preserved across an owner deletion retry', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(p) }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  env.storage.onDelete = () => env.storage.objects.set(`private-bucket/${p}`, '2');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_changed/);
  env.storage.onDelete = undefined;
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_changed/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '2');
  assert.deepEqual((await env.db.collection('jobs').doc('job-1234567890').get()).data().output, output(p));
});

test('an unknown derivative field blocks deletion and leaves references intact', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  const value = { ...output(p), unknownDerivative: ref(path(project, 'other.mp4')) };
  await put(env, 'job-1234567890', shortJob({ output: value }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /ref_invalid/);
  assert.equal(env.storage.objects.size, 1);
  assert.deepEqual((await env.db.collection('jobs').doc('job-1234567890').get()).data().output, value);
});

test('an unknown artifact field blocks deletion', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: { outputs: [{ kind: 'mp4', ref: ref(p),
    extraRef: ref(path(project, 'unknown.mp4')) }] } }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /ref_invalid/);
  assert.equal(env.storage.objects.size, 1);
});

test('a replacement appearing after deletion prevents success', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(p) }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  env.storage.onAfterDelete = () => env.storage.objects.set(`private-bucket/${p}`, '2');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_changed/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '2');
  assert.ok((await env.db.collection('jobs').doc('job-1234567890').get()).data().output);
});

test('duplicate refs are deleted once and missing objects are not counted', async () => {
  const env = await environment(), p = path(project, 'movie.mp4'), missing = path(project, 'missing.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(p),
    result: { outputs: [{ kind: 'mp4', ref: ref(p) }, { kind: 'srt', ref: ref(missing) }] } }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  const result = await deleteBoundMovieOutput(tenant, owner, 'job-1234567890');
  assert.equal(result.deletedObjectCount, 1);
  const job = (await env.db.collection('jobs').doc('job-1234567890').get()).data();
  assert.equal(job.output, undefined);
  assert.equal(job.result, undefined);
});

test('active and unresolved jobs cannot be acknowledged as deleted', async () => {
  const env = await environment();
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  for (const fields of [{ status: 'RUNNING' }, { status: 'LEASED' },
    { status: 'CANCELLED', outputDeletionInFlightUnresolved: true },
    { status: 'CANCELLED', consentRevocationInFlightUnresolved: true }]) {
    await put(env, 'job-1234567890', shortJob(fields));
    await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /inflight_unresolved/);
  }
});

function planFixture() {
  const planId = 'lmp_01234567890123456789';
  const childId = `lms_${createHash('sha256').update(`${planId}:0000`).digest('hex').slice(0, 32)}_0000`;
  return { planId, childId, plan: { planId, tenantId: tenant, ownerUid: owner, projectId: project,
    status: 'CANCELLED', childJobIds: [childId], segments: [{ jobId: childId, index: 0 }] } };
}
const planChild = (planId, childId, fields = {}) => shortJob({ jobId: childId,
  execution: { parentJobId: planId, rootJobId: planId }, ...fields });

test('long-form deletion handles the bound child output and result', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  const first = path(project, 'segments/0000/first.mp4'), second = path(project, 'segments/0000/second.srt');
  await env.db.collection('studioLifeMovieLongformPlans').doc(planId).set(plan);
  await put(env, childId, planChild(planId, childId, { payload: { projectId: project, outputPrefix: path(project, 'segments/0000/') },
    output: output(first), result: output(second) }));
  env.storage.objects.set(`private-bucket/${first}`, '1');
  env.storage.objects.set(`private-bucket/${second}`, '2');
  const { deletePlanOutputs } = await env.load('long', 'deletePlanOutputs');
  const result = await deletePlanOutputs(planId, tenant, owner);
  assert.equal(result.deletedObjectCount, 2);
  assert.equal(env.storage.objects.size, 0);
  assert.equal((await env.db.collection('jobs').doc(childId).get()).data().output, undefined);
  assert.equal((await env.db.collection('studioLifeMovieLongformPlans').doc(planId).get()).data().outputDeletedBy, owner);
});

test('long-form deletion requires cancellation and rejects a foreign child before deletion', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  const p = path(project, 'segments/0000/movie.mp4');
  const planRef = env.db.collection('studioLifeMovieLongformPlans').doc(planId);
  await planRef.set({ ...plan, status: 'PENDING' });
  await put(env, childId, planChild(planId, childId, { ownerUid: 'other-owner', output: output(p) }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deletePlanOutputs } = await env.load('long', 'deletePlanOutputs');
  await assert.rejects(deletePlanOutputs(planId, tenant, owner), /cancel_required/);
  await planRef.set({ status: 'CANCELLED' }, { merge: true });
  await assert.rejects(deletePlanOutputs(planId, tenant, owner), /boundary_mismatch/);
  assert.equal(env.storage.objects.size, 1);
});

test('long-form deletion cannot use another segment’s declared output prefix', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  const p = path(project, 'segments/0001/other.mp4');
  await env.db.collection('studioLifeMovieLongformPlans').doc(planId).set(plan);
  await put(env, childId, planChild(planId, childId, {
    payload: { projectId: project, outputPrefix: path(project, 'segments/0001/') }, output: output(p) }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deletePlanOutputs } = await env.load('long', 'deletePlanOutputs');
  await assert.rejects(deletePlanOutputs(planId, tenant, owner), /boundary_mismatch/);
  assert.equal(env.storage.objects.size, 1);
});

test('a child cannot change its output prefix after long-form preflight', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  const ours = path(project, 'segments/0000/ours.mp4'), other = path(project, 'segments/0001/other.mp4');
  await env.db.collection('studioLifeMovieLongformPlans').doc(planId).set(plan);
  const child = env.db.collection('jobs').doc(childId);
  await child.set(planChild(planId, childId, {
    payload: { projectId: project, outputPrefix: path(project, 'segments/0000/') }, output: output(ours) }));
  env.storage.objects.set(`private-bucket/${ours}`, '1');
  env.storage.objects.set(`private-bucket/${other}`, '2');
  const originalGetAll = env.db.getAll;
  env.db.getAll = async (...refs) => {
    const snapshots = await originalGetAll(...refs);
    await child.set({ payload: { projectId: project, outputPrefix: path(project, 'segments/0001/') },
      output: output(other) }, { merge: true });
    return snapshots;
  };
  const { deletePlanOutputs } = await env.load('long', 'deletePlanOutputs');
  await assert.rejects(deletePlanOutputs(planId, tenant, owner), /boundary_mismatch/);
  assert.ok(env.storage.objects.has(`private-bucket/${other}`));
});

test('a changed plan cannot be acknowledged after partial deletion', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  const p = path(project, 'segments/0000/movie.mp4');
  const planRef = env.db.collection('studioLifeMovieLongformPlans').doc(planId);
  await planRef.set(plan);
  await put(env, childId, planChild(planId, childId, {
    payload: { projectId: project, outputPrefix: path(project, 'segments/0000/') }, output: output(p) }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  env.storage.onDelete = async () => planRef.set({ projectId: 'another-project' }, { merge: true });
  const { deletePlanOutputs } = await env.load('long', 'deletePlanOutputs');
  await assert.rejects(deletePlanOutputs(planId, tenant, owner), /plan_changed/);
  assert.equal((await planRef.get()).data().outputDeletedBy, undefined);
});

test('long-form cancellation marks a running child for later reconciliation', async () => {
  const env = await environment(), { planId, childId, plan } = planFixture();
  await env.db.collection('studioLifeMovieLongformPlans').doc(planId).set({ ...plan, status: 'PENDING' });
  await put(env, childId, planChild(planId, childId, { status: 'RUNNING' }));
  const { cancelPlan } = await env.load('long', 'cancelPlan');
  await cancelPlan(planId, tenant, owner);
  const child = (await env.db.collection('jobs').doc(childId).get()).data();
  assert.equal(child.status, 'CANCELLED');
  assert.equal(child.outputDeletionInFlightUnresolved, true);
});

test('a malformed extra output field also blocks consent revocation acknowledgement', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: { ...output(p), unknownDerivative: ref(p) } }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { invalidateLifeMovieDerivativesForConsent } = await env.load('revocation', 'invalidateLifeMovieDerivativesForConsent');
  await assert.rejects(invalidateLifeMovieDerivativesForConsent({ eventId: 'event-a', ownerUid: owner,
    purpose: 'life-movie.render', revokedAt: '2026-10-29T00:00:00Z' }), /ref_invalid/);
  assert.equal(env.storage.objects.size, 1);
});

test('bridge responses do not leak storage or database exception text', async () => {
  const env = await environment(), p = path(project, 'movie.mp4');
  await put(env, 'job-1234567890', shortJob({ output: output(p) }));
  env.storage.bucket = () => ({ file: () => ({ getMetadata: async () => { throw new Error('private synthetic storage detail'); } }) });
  const { studioLifeMovieBridge } = await env.load('short', 'deleteBoundMovieOutput');
  let status, body;
  await studioLifeMovieBridge({ method: 'POST', body: { action: 'delete-output', tenantId: tenant, userId: owner, jobId: 'job-1234567890' },
    get: () => '' }, { set() {}, status(value) { status = value; return this; }, json(value) { body = value; } });
  assert.equal(status, 500);
  assert.equal(body.error, 'bridge_failed');
  assert.doesNotMatch(JSON.stringify(body), /private synthetic/);
});


test('long-form assembled and delivered media binds every child to owner, digest, consent and segment prefix', async () => {
  const env = await environment(), { planId, childId } = planFixture();
  const truth = 'b'.repeat(64), parentDigest = 'c'.repeat(64);
  const checksum = createHash('sha256')
    .update('urai-life-movie-longform-segment-v1\n' + parentDigest + '\n0\n0\n1000')
    .digest('hex');
  const consent = { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'd'.repeat(64) };
  const segmentPrefix = path(project, 'segments/0000/');
  const segmentFiles = [path(project, 'segments/0000/movie.mp4'), path(project, 'segments/0000/captions.srt')];
  const artifacts = { outputs: [
    { kind: 'mp4', ref: ref(segmentFiles[0]), checksum },
    { kind: 'srt', ref: ref(segmentFiles[1]), checksum },
  ], renderPlanDigest: checksum, sceneTruthDigest: truth };
  const plan = {
    planId, tenantId: tenant, ownerUid: owner, projectId: project,
    renderPlanDigest: parentDigest, sceneTruthDigest: truth, consent,
    status: 'PENDING', childJobIds: [childId],
    segments: [{ jobId: childId, index: 0, childDigest: checksum, startMs: 0, endMs: 1000 }],
  };
  const valid = planChild(planId, childId, { payload: {
    projectId: project, outputPrefix: segmentPrefix, renderPlanDigest: checksum, sceneTruthDigest: truth,
  }, consent, output: artifacts });
  plan.segments[0].childPayloadFingerprint = fingerprint('studio.render.video', valid.payload);
  const { assertBoundSegmentForUse } = await env.load('long', 'assertBoundSegmentForUse');
  assert.doesNotThrow(() => assertBoundSegmentForUse(plan, valid, 0));
  for (const [mutation, error] of [
    [{ ownerUid: 'other-owner' }, /boundary_mismatch/],
    [{ tenantId: 'another-tenant' }, /boundary_mismatch/],
    [{ execution: { rootJobId: 'other-plan', parentJobId: 'other-plan' } }, /boundary_mismatch/],
    [{ payload: { ...valid.payload, outputPrefix: path(project, 'segments/0001/') } }, /boundary_mismatch/],
    [{ payload: { ...valid.payload, renderPlanDigest: '0'.repeat(64) } }, /segment_binding_mismatch/],
    [{ payload: { ...valid.payload, sources: [{ id: 'foreign-source', generation: '2' }] } }, /segment_binding_mismatch/],
    [{ payload: { ...valid.payload, timeline: [{ sourceId: 'alternate', startMs: 0, endMs: 1000 }] } }, /segment_binding_mismatch/],
    [{ output: { ...artifacts, sceneTruthDigest: '0'.repeat(64) } }, /segment_binding_mismatch/],
    [{ output: { ...artifacts, renderPlanDigest: '0'.repeat(64) } }, /segment_binding_mismatch/],
    [{ consent: { ...consent, decisionReceiptId: 'e'.repeat(64) } }, /segment_binding_mismatch/],
    [{ output: { ...artifacts, outputs: [{ kind: 'mp4', ref: ref(path(project, 'segments/0001/other.mp4')), checksum }] } }, /boundary_mismatch/],
  ]) assert.throws(() => assertBoundSegmentForUse(plan, { ...valid, ...mutation }, 0), error);
  assert.throws(() => assertBoundSegmentForUse({
    ...plan, segments: [{ ...plan.segments[0], childDigest: '0'.repeat(64) }]
  }, valid, 0), /segment_binding_mismatch/);
});

test('long-form final assembly is owner-and-parent bound before playback', async () => {
  const env = await environment(), { planId } = planFixture();
  const jobId = 'lma_' + createHash('sha256').update(planId + ':assembly-v1').digest('hex').slice(0, 40);
  const digest = 'f'.repeat(64), truth = 'e'.repeat(64);
  const consent = { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'd'.repeat(64) };
  const plan = { planId, tenantId: tenant, ownerUid: owner, projectId: project,
    assemblyJobId: jobId, renderPlanDigest: digest, sceneTruthDigest: truth, consent };
  const movie = path(project, 'final/movie.mp4');
  const valid = planChild(planId, jobId, {
    jobType: 'studio.assemble.video',
    payload: { projectId: project, outputPrefix: path(project, 'final/'),
      renderPlanDigest: digest, sceneTruthDigest: truth },
    output: { renderPlanDigest: digest, sceneTruthDigest: truth, outputs: [
      { kind: 'mp4', ref: ref(movie), checksum: 'a'.repeat(64) },
    ] }, consent,
  });
  const { assertBoundAssemblyForUse } = await env.load('long', 'assertBoundAssemblyForUse');
  assert.doesNotThrow(() => assertBoundAssemblyForUse(plan, valid));
  assert.throws(() => assertBoundAssemblyForUse(plan, { ...valid, ownerUid: 'other-owner' }), /boundary_mismatch/);
  assert.throws(() => assertBoundAssemblyForUse(plan, { ...valid,
    payload: { ...valid.payload, renderPlanDigest: '0'.repeat(64) } }), /assembly_binding_mismatch/);
  assert.throws(() => assertBoundAssemblyForUse(plan, { ...valid,
    output: { ...valid.output, outputs: [{ kind: 'mp4', ref: ref(path(project, 'segments/0000/other.mp4')) }] } }), /boundary_mismatch/);
});


test('owner deletion refuses a media generation replaced before cleanup starts', async () => {
  const env = await environment(), p = path(project, 'pinned.mp4');
  const pinned = { outputs: [{ kind: 'mp4', ref: ref(p), generation: '1' }] };
  await put(env, 'job-1234567890', shortJob({ output: pinned }));
  env.storage.objects.set(`private-bucket/${p}`, '2');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_changed/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '2');
  assert.deepEqual((await env.db.collection('jobs').doc('job-1234567890').get()).data().output, pinned);
});

test('owner deletion accepts a matching pinned output generation', async () => {
  const env = await environment(), p = path(project, 'pinned.mp4');
  await put(env, 'job-1234567890', shortJob({ output: { outputs: [
    { kind: 'mp4', ref: ref(p), generation: '1' },
  ] } }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  assert.equal((await deleteBoundMovieOutput(tenant, owner, 'job-1234567890')).deletedObjectCount, 1);
  assert.equal(env.storage.objects.has(`private-bucket/${p}`), false);
});

test('owner deletion refuses conflicting pinned generations for a duplicate path', async () => {
  const env = await environment(), p = path(project, 'pinned.mp4');
  await put(env, 'job-1234567890', shortJob({
    output: { outputs: [{ kind: 'mp4', ref: ref(p), generation: '1' }] },
    result: { outputs: [{ kind: 'mp4', ref: ref(p), generation: '2' }] },
  }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_invalid/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '1');
});

test('revocation refuses a media generation replaced before cleanup starts', async () => {
  const env = await environment(), p = path(project, 'pinned.mp4');
  const pinned = { outputs: [{ kind: 'mp4', ref: ref(p), generation: '1' }] };
  await put(env, 'job-1234567890', shortJob({ output: pinned }));
  env.storage.objects.set(`private-bucket/${p}`, '2');
  const { invalidateLifeMovieDerivativesForConsent } = await env.load('revocation', 'invalidateLifeMovieDerivativesForConsent');
  await assert.rejects(invalidateLifeMovieDerivativesForConsent({ eventId: 'event-a', ownerUid: owner,
    purpose: 'life-movie.render', revokedAt: '2026-10-29T00:00:00Z' }), /generation_changed/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '2');
  assert.deepEqual((await env.db.collection('jobs').doc('job-1234567890').get()).data().output, pinned);
});

test('malformed pinned generation remains unresolved instead of deleting a movie', async () => {
  const env = await environment(), p = path(project, 'pinned.mp4');
  await put(env, 'job-1234567890', shortJob({ output: { outputs: [
    { kind: 'mp4', ref: ref(p), generation: '9007199254740992' },
  ] } }));
  env.storage.objects.set(`private-bucket/${p}`, '1');
  const { deleteBoundMovieOutput } = await env.load('short', 'deleteBoundMovieOutput');
  await assert.rejects(deleteBoundMovieOutput(tenant, owner, 'job-1234567890'), /generation_invalid/);
  assert.equal(env.storage.objects.get(`private-bucket/${p}`), '1');
});
