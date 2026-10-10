import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Exercise the actual HTTP bridges. Every identity, document, Storage object
// and signed URL below is synthetic; no provider or production account is used.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript'), { z } = require('zod');
const sourceArg = process.argv.indexOf('--source-dir');
const sourceDir = sourceArg < 0 ? fileURLToPath(new URL('../', import.meta.url)) : path.resolve(process.argv[sourceArg + 1]);
const baseline = process.argv.includes('--prove-baseline');
const clone = (value) => structuredClone(value);
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const tenantId = 'synthetic-tenant', userId = 'synthetic-owner', projectId = 'synthetic-project';
const planId = `lmp_${'a'.repeat(24)}`, childIds = ['synthetic-child-0001', 'synthetic-child-0002'];
const assemblyId = 'synthetic-assembly-0001', bucket = 'synthetic-private-bucket';
const consent = { purpose: 'life-movie.render', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-receipt' };
const prefix = `tenants/${tenantId}/life-movies/${projectId}`;

export function harness() {
  const documents = new Map(), versions = new Map(), objects = new Map();
  const state = { signs: [], metadataReads: [], downloads: 0, storageDeletes: 0, onObservation: null, onDownload: null, beforeTransaction: null, token: 'synthetic-token', now: Date.now() };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return state.now; }
  }
  const ref = (name) => ({ path: name, id: name.split('/').at(-1), get: async () => snapshot(ref(name)),
    collection: (name2) => ({ doc: (id) => ref(`${name}/${name2}/${id}`) }) });
  const snapshot = (reference) => {
    const value = clone(documents.get(reference.path));
    return { ref: reference, id: reference.id, exists: value !== undefined, data: () => clone(value) };
  };
  function set(name, value) {
    documents.set(name, clone(value)); versions.set(name, (versions.get(name) || 0) + 1);
  }
  function patch(reference, values, merge = true) {
    const value = merge ? clone(documents.get(reference.path) || {}) : {};
    for (const [key, entry] of Object.entries(values)) {
      const keys = key.split('.'); let at = value;
      for (const field of keys.slice(0, -1)) at = at[field] ||= {};
      if (entry === '__DELETE__') delete at[keys.at(-1)]; else at[keys.at(-1)] = clone(entry);
    }
    set(reference.path, value);
  }
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    getAll: async (...refs) => refs.map(snapshot),
    async runTransaction(callback) {
      const hook = state.beforeTransaction; state.beforeTransaction = null; await hook?.();
      for (let attempt = 0; attempt < 6; attempt++) {
        const reads = new Map(), writes = [];
        const transaction = {
          get: async (reference) => { reads.set(reference.path, versions.get(reference.path) || 0); return snapshot(reference); },
          getAll: async (...refs) => Promise.all(refs.map((reference) => transaction.get(reference))),
          update: (reference, value) => writes.push(() => patch(reference, value)),
          set: (reference, value, options) => writes.push(() => patch(reference, value, options?.merge)),
          create: (reference, value) => writes.push(() => { assert.equal(documents.has(reference.path), false); patch(reference, value, false); }),
        };
        const result = await callback(transaction);
        if ([...reads].some(([name, version]) => versions.get(name) !== version && (versions.get(name) || 0) !== version)) continue;
        for (const write of writes) write(); return result;
      }
      throw new Error('synthetic_transaction_conflict');
    },
    batch() { const writes = []; return {
      update: (reference, value) => writes.push(() => patch(reference, value)),
      set: (reference, value, options) => writes.push(() => patch(reference, value, options?.merge)),
      commit: async () => { for (const write of writes) write(); },
    }; },
  };
  function artifact(kind, role, id) {
    const value = { kind, ref: `gs://${bucket}/${prefix}/${role}/${id}.${kind}`,
      mimeType: kind === 'mp4' ? 'video/mp4' : 'application/x-subrip', checksum: crypto.createHash('sha256').update(kind === 'srt' ? '1\n00:00:00,000 --> 00:00:01,000\nSynthetic caption\n' : 'synthetic-video').digest('hex') };
    objects.set(value.ref, Buffer.from(kind === 'srt' ? '1\n00:00:00,000 --> 00:00:01,000\nSynthetic caption\n' : 'synthetic-video'));
    return value;
  }
  function job(id, type, role) {
    return { jobId: id, type, jobType: type, sourceSystem: 'urai-studio', tenantId, ownerUid: userId, status: 'SUCCESS',
      consent: clone(consent), payload: { projectId }, execution: { rootJobId: planId, parentJobId: planId },
      output: { renderPlanDigest: 'b'.repeat(64), sceneTruthDigest: 'c'.repeat(64), publicReleaseAuthorized: false,
        outputs: [artifact('mp4', role, id), artifact('srt', role, id)] } };
  }
  for (const id of childIds) set(`jobs/${id}`, job(id, 'studio.render.video', 'segments'));
  set(`jobs/${assemblyId}`, job(assemblyId, 'studio.assemble.video', 'final'));
  set(`studioLifeMovieLongformPlans/${planId}`, { planId, schemaVersion: 'urai-life-movie-longform-plan-v1',
    sourceSystem: 'urai-studio', tenantId, ownerUid: userId, projectId, status: 'PENDING', consent: clone(consent),
    renderPlanDigest: 'b'.repeat(64), sceneTruthDigest: 'c'.repeat(64), sceneTruthReceiptRef: 'synthetic-receipt',
    width: 320, height: 320, fps: 30, assemblyJobId: assemblyId, childJobIds: clone(childIds),
    segments: childIds.map((id, index) => ({ index, startMs: index * 15000, endMs: (index + 1) * 15000,
      childDigest: 'd'.repeat(64), jobId: id })) });
  const narratorId = 'synthetic-narrator-0001', sessionId = 'synthetic-session', narratorScriptId = 'synthetic-script';
  const narratorRef = `gs://${bucket}/storytime/${userId}/${sessionId}/${narratorScriptId}/audio.mp3`;
  objects.set(narratorRef, Buffer.from('synthetic-audio'));
  set(`jobs/${narratorId}`, { jobId: narratorId, type: 'narrator.tts', jobType: 'narrator.tts', status: 'SUCCESS', ownerUid: userId, sourceSystem: 'urai-storytime', sourceSessionId: sessionId, sourceNarratorScriptId: narratorScriptId, consent: { ...consent, purpose: 'storytime.voiceover' }, payload: { text: 'synthetic story' }, output: { artifactPath: narratorRef, mimeType: 'audio/mpeg', size: 15 } });
  const storage = { bucket: (bucketName) => ({ file: (objectPath, options) => ({
    async getMetadata() {
      if (options?.generation && options.generation !== '1') throw new Error('private_media_missing');
      state.metadataReads.push(`gs://${bucketName}/${objectPath}`);
      await state.onObservation?.(state.metadataReads.length);
      const body = objects.get(`gs://${bucketName}/${objectPath}`);
      if (!body) throw new Error('private_media_missing');
      return [{ generation: options?.generation || '1', size: body.length }];
    },
    async getSignedUrl(options) {
      state.signs.push({ ref: `gs://${bucketName}/${objectPath}`, options });
      await state.onObservation?.(state.signs.length);
      return [`https://fixture.invalid/private/${state.signs.length}`];
    },
    createReadStream() {
      const body = objects.get(`gs://${bucketName}/${objectPath}`);
      if (!body) throw new Error('private_media_missing');
      return Readable.from((function* () { for (let i = 0; i < body.length; i += 64 * 1024) yield body.subarray(i, i + 64 * 1024); })(), { objectMode: false });
    },
    async download() { state.downloads++; await state.onDownload?.(); return [objects.get(`gs://${bucketName}/${objectPath}`) || Buffer.from('')]; },
    async delete() { state.storageDeletes++; objects.delete(`gs://${bucketName}/${objectPath}`); },
  }) }) };
  const FieldValue = { delete: () => '__DELETE__', serverTimestamp: () => 'synthetic-timestamp' };
  function load(filename, exported) {
    const exports = {};
    const source = fs.readFileSync(path.join(sourceDir, 'functions/src/jobs', filename), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Buffer, console, Date: FixtureDate, setTimeout, clearTimeout, AbortController, process: { env: { GCS_BUCKET_NAME: bucket, URAI_ENV: 'test' } },
      require(name) {
        if (name === 'firebase-admin/firestore') return { FieldValue, getFirestore: () => db };
        if (name === 'firebase-admin/storage') return { getStorage: () => storage };
        if (name === 'firebase-functions/params') return { defineSecret: () => ({ value: () => state.token }) };
        if (name === 'firebase-functions/v2/https') return { onRequest: (_options, handler) => handler };
        if (name === 'ulid') return { ulid: () => 'synthetic-unused-id' };
        if (name.endsWith('/firestore-paths.js')) return { jobDoc: (id) => ref(`jobs/${id}`), jobQueueEntryDoc: (id) => ref(`jobQueue/${id}`) };
        if (name.endsWith('/consentBlocks.js')) return { consentBlockRef: () => ref('jobConsentBlocks/synthetic'),
          isConsentContext: (value) => !!value && ['purpose', 'policyVersion', 'decisionReceiptId'].every((key) => typeof value[key] === 'string' && value[key].length > 0) };
        if (name.endsWith('/jobsReliability.js')) return { bindingMatches: () => false,
          buildIdempotencyBindingId: digest, buildRequestFingerprint: (_type, value) => digest(value) };
        if (name.endsWith('/sceneTruthReceipt.js')) return { assertSceneTruthReceiptValue() {} };
        if (name.endsWith('/studioLifeMovieLongformContract.js')) return { StudioLifeMovieLongformPayloadSchema: z.any(), LIFE_MOVIE_LONGFORM_BUDGET: { maxSegments: 180 } };
        if (name.endsWith('/privateMediaDelivery.js')) return load('privateMediaDelivery.ts');
        if (name.endsWith('/studioLifeMovieContract.js')) return { StudioLifeMovieRenderPayloadSchema: z.any() };
        return require(name);
      },
    });
    return exported ? exports[exported] : exports;
  }
  const bridges = { short: load('studioLifeMovieBridge.ts', 'studioLifeMovieBridge'),
    long: load('studioLifeMovieLongformBridge.ts', 'studioLifeMovieLongformBridge'),
    narrator: load('storytimeNarratorBridge.ts', 'storytimeNarratorBridge') };
  async function invoke(form, action) {
    const req = { method: 'POST', get: () => 'Bearer synthetic-token',
      body: { action, tenantId, userId, ...(form === 'short' ? { jobId: childIds[0] } : { planId }) } };
    const response = { statusCode: 200, body: null,
      set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await bridges[form](req, response); return response;
  }
  function change(name, update) { const value = clone(documents.get(name)); update(value); set(name, value); }
  return { state, invoke, change, set, bridges, objects, identities: { tenantId, userId, projectId, planId, childIds, assemblyId, narratorId, sessionId, narratorScriptId, narratorRef }, get: (name) => clone(documents.get(name)) };
}

let groups = 0, baselineLeaks = 0;
function denied(result, label) {
  if (baseline) {
    if (result.statusCode === 200) baselineLeaks++;
    return;
  }
  assert.notEqual(result.statusCode, 200, label);
  assert.equal(result.body?.ok, false, label);
  assert.equal(result.body?.playback, undefined, label);
  assert.equal(result.body?.download, undefined, label);
  assert.equal(JSON.stringify(result.body).includes('fixture.invalid'), false, label);
}
for (const form of ['short', 'long']) for (const action of ['playback', 'download']) {
  const h = harness(), result = await h.invoke(form, action);
  assert.equal(result.statusCode, 200);
  assert.ok(result.body[action === 'playback' ? 'playback' : 'download']);
  if (!baseline) {
    assert.equal(h.state.signs.length, 0);
    assert.equal(JSON.stringify(result.body).includes('requiresAuthorization'), true);
    assert.equal(JSON.stringify(result.body).includes('gs://'), false);
  }
  groups++;
}
console.log('[PASS] Ordinary owner playback and attachment export retain private deliveries on both bridges');

for (const form of ['short', 'long']) {
  const result = await harness().invoke(form, 'status');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body?.ok, true);
  assert.equal(JSON.stringify(result.body).includes('gs://'), false);
  assert.equal(JSON.stringify(result.body).includes('fixture.invalid'), false);
  groups++;
}
console.log('[PASS] Owner status projections contain neither raw object references nor signed URLs');

for (const form of ['short', 'long']) for (const action of ['playback', 'download']) {
  const h = harness();
  h.state.onObservation = async () => {
    h.state.onObservation = null;
    const deleted = await h.invoke(form, 'delete-output'); assert.equal(deleted.statusCode, 200);
  };
  denied(await h.invoke(form, action), `${form} ${action} must not deliver after awaited owner deletion`);
  groups++;
}
console.log(baseline ? '[REPRODUCED] Storage signing can overlap owner output deletion at predecessor' : '[PASS] Actual owner-deletion handlers suppress every in-flight playback/export response');

for (const form of ['short', 'long']) for (const action of ['playback', 'download']) {
  const h = harness();
  h.state.onObservation = async () => { h.state.onObservation = null; h.set('jobConsentBlocks/synthetic', { active: true }); };
  denied(await h.invoke(form, action), `${form} ${action} must not deliver after canonical consent block`);
  groups++;
}
console.log(baseline ? '[REPRODUCED] Canonical consent revocation during signing can return predecessor media' : '[PASS] Canonical consent revocation during metadata observation suppresses playback and export');

for (const action of ['playback', 'download']) {
  const h = harness();
  h.state.onDownload = async () => { h.state.onDownload = null; h.set('jobConsentBlocks/synthetic', { active: true }); };
  denied(await h.invoke('short', action), 'short subtitle await must not disclose stale captions or media');
  groups++;
}
console.log(baseline ? '[REPRODUCED] Subtitle download can return stale captions after revocation' : '[PASS] Subtitle-download authority changes are checked before responding');

for (const form of ['short', 'long']) for (const mutate of [
  (job) => { job.ownerUid = 'foreign-owner'; },
  (job) => { job.output.outputs[0].checksum = 'f'.repeat(64); },
  (job) => { job.consent.decisionReceiptId = 'changed-receipt'; },
  (job) => { job.payload.sourceCorrectionRevision = 'changed-source'; },
  (job) => { job.derivativeAccessState = 'REVOKED'; },
  (job) => { job.outputDeletionState = 'PENDING'; },
]) {
  const h = harness(); h.state.onObservation = async () => {
    h.state.onObservation = null; h.change(`jobs/${form === 'short' ? childIds[0] : assemblyId}`, mutate);
  };
  denied(await h.invoke(form, 'playback'), `${form} changed output or authority must reject stale delivery`);
  groups++;
}
console.log(baseline ? '[REPRODUCED] Changed output and access authority can return predecessor media' : '[PASS] Current owner, consent receipt, output checksum and permanent access fences stay bound');

for (const mutate of [
  (plan) => { plan.assemblyJobId = 'changed-assembly-id'; },
  (plan) => { plan.segments[0].endMs = 14000; },
  (plan) => { plan.derivativeAccessState = 'DELETED'; },
]) {
  const h = harness(); h.state.onObservation = async () => { h.state.onObservation = null; h.change(`studioLifeMovieLongformPlans/${planId}`, mutate); };
  denied(await h.invoke('long', 'download'), 'changed parent authority cannot return a previous export');
  groups++;
}
console.log(baseline ? '[REPRODUCED] Changed parent identity can return predecessor export' : '[PASS] Long-form parent output, timeline and deletion identity are revalidated');

for (const form of ['short', 'long']) {
  const h = harness();
  h.change(`jobs/${childIds[0]}`, (job) => { job.output.outputs[0].ref = `gs://${bucket}/tenants/${tenantId}/life-movies/foreign-project/segments/private.mp4`; });
  const result = await h.invoke(form, 'playback'); denied(result, 'same-tenant foreign-project artifact must not be signed');
  if (!baseline) assert.equal(h.state.metadataReads.length, 0, 'validate all output locations before Storage observation');
  groups++;
}
for (const field of ['ownerUid', 'parentJobId', 'rootJobId']) {
  const h = harness();
  h.change(`jobs/${childIds[1]}`, (job) => { if (field === 'ownerUid') job[field] = 'foreign-owner'; else job.execution[field] = 'foreign-parent'; });
  denied(await h.invoke('long', 'playback'), 'foreign long-form child must not be delivered');
  if (!baseline) assert.equal(h.state.signs.length, 0);
  groups++;
}
console.log(baseline ? '[REPRODUCED] Same-tenant foreign project or foreign child can be delivered' : '[PASS] Initial project, owner and parent validation precedes Storage observation');

for (const form of ['short', 'long']) {
  const h = harness(); h.state.onObservation = async () => { h.state.onObservation = null; h.state.now += 5 * 60 * 1000 + 1; };
  denied(await h.invoke(form, 'download'), 'expired delivery must not return unusable credentials'); groups++;
}
console.log(baseline ? '[REPRODUCED] Slow signing can return expired predecessor URLs' : '[PASS] Slow metadata observation cannot return expired delivery descriptors');

if (baseline) {
  assert.ok(baselineLeaks >= 10, `expected concrete predecessor leaks, saw ${baselineLeaks}`);
  console.log(`Reproduced ${baselineLeaks} stale/foreign deliveries against predecessor HTTP source using synthetic adapters.`);
} else console.log(`Life Movie delivery authority passed ${groups} actual HTTP-handler cases with synthetic transactional Firestore and Storage; no Storage signing; live deployment and real private playback remain unproven.`);
