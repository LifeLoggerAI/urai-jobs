import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac, createHash } from 'node:crypto';
import vm from 'node:vm';

// Synthetic request and in-memory Firestore doubles. The real Jobs handlers,
// schemas, receipt verifier, and queue decisions are executed below.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const zod = require('zod');
const env = { NODE_ENV: 'production', URAI_LIFE_MOVIE_LONGFORM_ENABLED: 'true' };
function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../functions/src/${relativePath}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Buffer, URL, console, Error, Object, Array, process: { env },
    require(id) {
      if (id === 'zod') return zod;
      if (id === 'node:crypto' || id === 'node:util') return require(id);
      if (id in imports) return imports[id];
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return module.exports;
}

const gate = load('privacy/lifeMovieConsentGate.ts');
const contract = load('jobs/studioLifeMovieContract.ts');
const longContract = load('jobs/studioLifeMovieLongformContract.ts', { './studioLifeMovieContract.js': contract });
const receipt = load('jobs/sceneTruthReceipt.ts');
const reliability = load('core/jobsReliability.ts');
const executionGuards = load('jobs/executionGuards.ts');
const documents = new Map();
const writes = [];
let published = 0;
let workerCalls = 0;
const deleted = Symbol('delete');
const FieldValue = { serverTimestamp: () => new Date(), delete: () => deleted, increment: n => ({ increment: n }) };
function ref(path) {
  return {
    path,
    get: async () => snapshot(path),
    collection: name => ({
      doc: id => ref(`${path}/${name}/${id}`),
      add: async data => { writes.push({ path: `${path}/${name}`, data }); },
    }),
  };
}
function snapshot(path) {
  return { exists: documents.has(path), data: () => documents.get(path) };
}
function patchDocument(path, data) {
  const old = documents.get(path) || {};
  for (const [key, value] of Object.entries(data)) {
    if (key.includes('.')) continue;
    if (value === deleted) delete old[key];
    else old[key] = value;
  }
  documents.set(path, old);
  writes.push({ path, data });
}
function pendingQuery() {
  const query = {
    where: () => query, orderBy: () => query, limit: () => query,
    get: async () => {
      const rows = [...documents.entries()]
        .filter(([path, data]) => path.startsWith('jobQueue/') && data.status === 'PENDING' && data.availableAt <= new Date())
        .map(([path, data]) => ({ id: path.split('/')[1], data: () => data }));
      return { empty: rows.length === 0, size: rows.length, docs: rows };
    },
  };
  return query;
}
const db = {
  collection: name => ({ doc: id => ref(`${name}/${id}`), ...pendingQuery() }),
  runTransaction: async callback => callback({
    get: async reference => snapshot(reference.path),
    update: (reference, data) => patchDocument(reference.path, data),
    set: (reference, data) => patchDocument(reference.path, data),
    create: (reference, data) => patchDocument(reference.path, data),
  }),
};
const secret = 'synthetic-scene-truth-secret-at-least-thirty-two-bytes';
const token = 'synthetic-bridge-token';
const mocks = {
  'firebase-admin/firestore': { FieldValue, Timestamp: { now: () => new Date() }, getFirestore: () => db },
  'firebase-admin/storage': { getStorage: () => { throw new Error('Unexpected storage access'); } },
  'firebase-functions/params': { defineSecret: name => ({ value: () => name.includes('HMAC') ? secret : token }) },
  'firebase-functions/v2/https': { onRequest: (_options, handler) => handler, onCall: (_options, handler) => handler, HttpsError: Error },
  'firebase-functions/v2/pubsub': { onMessagePublished: (_options, handler) => handler },
  'firebase-functions/v2/scheduler': { onSchedule: (_options, handler) => handler },
  '@google-cloud/pubsub': { PubSub: class { topic() { return { publishMessage: async () => { published++; } }; } } },
  ulid: { ulid: () => 'syntheticjobid00001' },
  axios: { default: { post: async () => { workerCalls++; throw new Error('Unexpected worker dispatch'); } } },
  '../core/firestore-paths.js': { jobDoc: id => ref(`jobs/${id}`), jobQueueEntryDoc: id => ref(`jobQueue/${id}`) },
  '../core/jobsReliability.js': reliability,
  '../core/dispatchRecovery.js': {},
  '../core/runtimeJobTypes.js': { workerEnvKeyForJobType: () => null, workerRouteForJobType: () => '/' },
  '../providers/tinyfish.js': { isTinyFishJobType: () => false, tinyFishApiKeySecret: {} },
  './executionGuards.js': executionGuards,
  './studioLifeMovieContract.js': contract,
  './studioLifeMovieLongformContract.js': longContract,
  './sceneTruthReceipt.js': receipt,
  '../privacy/consentBlocks.js': { consentBlockRef: () => ref('synthetic-block/missing'), isConsentContext: () => false },
  '../privacy/lifeMovieConsentGate.js': gate,
  '../privacy/ownerDeletionFence.js': { assertOwnerDeletionFenceClear: () => { throw new Error('owner_deletion_state_unavailable_in_test'); } },
  '../privacy/lifeMovieCreationAdmission.js': { requireLifeMovieCreationAdmission: async () => { throw new Error('life_movie_consent_authority_unavailable'); } },
  './lifeMoviePrivateDeliveryContract.js': { parseLifeMoviePrivateDeliveryRequest: () => { throw new Error('life_movie_private_delivery_request_invalid'); } },
  '../privacy/lifeMovieOutputGeneration.js': { requirePinnedOutputGeneration: async () => { throw new Error('generation_unavailable_in_test'); }, signedMovieAccessForPinnedGeneration: async () => { throw new Error('generation_unavailable_in_test'); } },
};
// R934: Execute the ORIGINAL server-owned owner/org and current-owner helper
// implementations. The smoke fixture must not replace either with an allow-all.
const liveOwnerOrg = load('jobs/lifeMovieLongformOwnerOrg.ts');
const liveCallerAuthority = load('jobs/currentJobCallerAuthority.ts');
assert.equal(typeof liveOwnerOrg.assertLifeMoviePlanCurrentOrg, 'function');
assert.equal(typeof liveOwnerOrg.assertLifeMovieJobPlanOrg, 'function');
assert.equal(typeof liveCallerAuthority.currentJobOwnerEligibleForDispatch, 'function');
assert.throws(
  () => liveOwnerOrg.assertLifeMoviePlanCurrentOrg({ orgId: 'synthetic-org-A' }, { orgId: 'synthetic-org-B' }),
  /life_movie_owner_org_authority_unavailable/
);
assert.equal(
  liveCallerAuthority.currentJobOwnerEligibleForDispatch(
    { ownerUid: 'synthetic-owner', tenantId: 't', orgId: 'A' },
    { uid: 'synthetic-owner', role: 'user', tenantId: 't', orgId: 'B', disabled: false, deleted: false, markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: false }
  ), false, 'cross-org worker must be rejected'
);
mocks['./lifeMovieLongformOwnerOrg.js'] = liveOwnerOrg;
mocks['./currentJobCallerAuthority.js'] = liveCallerAuthority;
const artifactRefs = load('privacy/lifeMovieArtifactRefs.ts');
const ownerDeletion = load('jobs/lifeMovieOwnerDeletion.ts', {
  ...mocks,
  '../privacy/lifeMovieArtifactRefs.js': artifactRefs,
});
mocks['./lifeMovieOwnerDeletion.js'] = ownerDeletion;
mocks['./rejectedNarratorOutput.js'] = load('jobs/rejectedNarratorOutput.ts', mocks);
const short = load('jobs/studioLifeMovieBridge.ts', mocks).studioLifeMovieBridge;
const long = load('jobs/studioLifeMovieLongformBridge.ts', mocks).studioLifeMovieLongformBridge;
const tick = load('jobs/processQueueTick.ts', mocks).processQueueTick;
const manual = load('jobs/processQueueNow.ts', mocks).processQueueNow;
const execute = load('jobs/executeJob.ts', mocks).executeJob;
const owner = 'synthetic-user', projectId = 'synthetic-project', tenant = 'synthetic-tenant', digest = 'b'.repeat(64);
const receiptId = 'abcdefghijklmnopqrstuvwx', expiry = (Date.now() + 600_000).toString(36);
const signature = createHmac('sha256', secret).update(`${receiptId}\n${projectId}\n${digest}\n${owner}\n${expiry}`).digest('base64url');
const payload = {
  schemaVersion: 'urai-life-movie-render-v1', projectId, renderPlanDigest: 'a'.repeat(64),
  sceneTruthReceiptRef: `str_${receiptId}_${expiry}_${signature}`, sceneTruthDigest: digest,
  outputPrefix: `tenants/${tenant}/life-movies/${projectId}/`, width: 640, height: 480, fps: 30,
  sources: [{ id: 'source', bucket: 'synthetic-bucket', objectPath: `tenants/${tenant}/source.png`, generation: '1793378565000001',
    mimeType: 'image/png', provenance: 'original-source', sourceRefs: ['synthetic'],
    consentRef: 'unverified-source-consent', ownerOrRightsRef: 'unverified-rights' }],
  timeline: [{ sourceId: 'source', startMs: 0, endMs: 1000 }], audioCues: [], subtitleText: '',
  spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
};
// A shape-valid source selection fingerprint does not enable rendering.
const actualScope = contract.deriveStudioLifeMovieRenderScope(payload);
const sourceSelection = payload.sources.map((source) => [
  source.id, source.bucket, source.objectPath, source.generation,
  source.mimeType, source.provenance, source.sourceRefs,
  source.consentRef, source.ownerOrRightsRef,
]);
sourceSelection.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const expectedScopeDigest = createHash('sha256')
  .update('urai-life-movie-source-set-v1\n')
  .update(JSON.stringify(sourceSelection)).digest('hex');
assert.equal(actualScope.sourceSetDigest, expectedScopeDigest);
assert.equal(actualScope.projectId, payload.projectId);
assert.equal(actualScope.renderPlanDigest, payload.renderPlanDigest);
const replacedSelection = {
  ...payload, sources: payload.sources.map((source) => ({ ...source, generation: '1793378565000002' })),
};
assert.notEqual(contract.deriveStudioLifeMovieRenderScope(replacedSelection).sourceSetDigest, actualScope.sourceSetDigest);
console.log('[PASS] Versioned consent source-set fingerprint binds immutable object generations.');

const identity = { tenantId: tenant, userId: owner };
const consent = { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'a'.repeat(64) };
const create = { action: 'create', ...identity, idempotencyKey: 'synthetic-idempotency', consent, payload };
async function request(handler, body, auth = `Bearer ${token}`) {
  let status, result;
  await handler({ method: 'POST', body, get: () => auth }, {
    set() {}, status(value) { status = value; return this; }, json(value) { result = value; return this; },
  });
  return { status, result };
}
async function blocked(handler, body) {
  const output = await request(handler, body);
  assert.equal(output.status, 503);
  assert.equal(output.result.error, ['playback', 'download'].includes(body.action) ? 'life_movie_authenticated_delivery_required' : 'life_movie_consent_authority_unavailable');
}
await blocked(short, create);
await blocked(long, { ...create, payload: { ...payload, schemaVersion: 'urai-life-movie-longform-v1' } });
for (const action of ['playback', 'download']) await blocked(short, { action, ...identity, jobId: 'syntheticjobid00001' });
for (const action of ['playback', 'download', 'resume', 'assemble']) {
  await blocked(long, { action, ...identity, planId: 'lmp_abcdefghijklmnopqrst' });
}
for (const invalidConsent of [
  { ...consent, policyVersion: 'invented-policy' },
  { ...consent, policyVersion: '1.0.0' },
  { ...consent, decisionReceiptId: 'invented-receipt' },
  { ...consent, decisionReceiptId: 'A'.repeat(64) },
  { ...consent, decisionReceiptId: 'a'.repeat(63) },
]) {
  assert.equal((await request(short, { ...create, consent: invalidConsent })).status, 400);
  assert.equal((await request(long, { ...create, consent: invalidConsent, payload: { ...payload, schemaVersion: 'urai-life-movie-longform-v1' } })).status, 400);
}
assert.equal((await request(short, create)).status, 503, 'Well-formed receipt reference is not authority');
assert.equal((await request(short, create, 'Bearer invalid')).status, 401);
assert.equal((await request(short, { ...create, consent: undefined })).status, 400);
for (const action of ['status', 'cancel', 'delete-output']) {
  assert.equal((await request(short, { action, ...identity, jobId: 'missingjobid00001' })).status, 404);
  assert.equal((await request(long, { action, ...identity, planId: 'lmp_abcdefghijklmnopqrst' })).status, 404);
}
assert.equal(writes.length, 0, 'denied bridge requests must not write jobs');
console.log('[PASS] Short and long-form admission and output access reject unverified consent; status, cancel, and deletion remain reachable.');

// The original dispatcher requires current Firestore owner/operator identity.
// Supply synthetic *valid* accounts rather than disabling the production veto.
documents.set(`users/${owner}`, {
  uid: owner, role: 'user', tenantId: tenant, accountStatus: 'active',
  disabled: false, deleted: false, markedForDeletion: false,
  dataRightsDeletionPendingCentralPrivacy: false,
});
documents.set('users/synthetic-operator', {
  uid: 'synthetic-operator', role: 'operator', accountStatus: 'active',
  disabled: false, deleted: false, markedForDeletion: false,
  dataRightsDeletionPendingCentralPrivacy: false,
});
function queue(jobId, jobType) {
  documents.set(`jobs/${jobId}`, { jobId, status: 'PENDING', type: jobType, ownerUid: owner, tenantId: tenant });
  documents.set(`jobQueue/${jobId}`, { jobId, status: 'PENDING', availableAt: new Date(Date.now() - 1000) });
}
queue('life-job', 'studio.render.video');
queue('other-job', 'asset.render');
await tick();
assert.equal(documents.get('jobs/life-job').status, 'PENDING');
assert.ok(documents.get('jobQueue/life-job').availableAt.getTime() > Date.now());
assert.equal(documents.get('jobs/other-job').status, 'LEASED');
assert.equal(published, 1, 'an unrelated job must still be published');
queue('life-manual', 'studio.assemble.video');
const manualResult = await manual({ auth: { uid: 'synthetic-operator', token: { role: 'operator' } }, data: { limit: 10 } });
assert.ok(manualResult.skipped.includes('life-manual'));
assert.equal(documents.get('jobs/life-manual').status, 'PENDING');
assert.ok(documents.get('jobQueue/life-manual').availableAt.getTime() > Date.now());
assert.equal(published, 1, 'manual dispatch must not publish a Life Movie job');
console.log('[PASS] Scheduled and manual queue paths defer Life Movie jobs while publishing an unrelated job.');

const leased = 'already-leased-life';
documents.set(`jobs/${leased}`, { jobId: leased, status: 'LEASED', type: 'studio.render.video', ownerUid: owner, lease: { leaseToken: 'lease-synthetic' } });
documents.set(`jobQueue/${leased}`, { jobId: leased, status: 'LEASED', lease: { leaseToken: 'lease-synthetic' } });
await execute({ data: { message: { json: { jobId: leased, leaseToken: 'lease-synthetic' } } } });
assert.equal(documents.get(`jobs/${leased}`).status, 'PENDING');
assert.equal(documents.get(`jobQueue/${leased}`).status, 'PENDING');
assert.ok(documents.get(`jobQueue/${leased}`).availableAt.getTime() > Date.now());
assert.equal(workerCalls, 0);
assert.ok(!writes.some(({ path, data }) => path === `jobs/${leased}` && data['execution.attemptCount']));
const stale = 'cancelled-queue-life';
documents.set(`jobs/${stale}`, { jobId: stale, status: 'LEASED', type: 'studio.render.video', ownerUid: owner, lease: { leaseToken: 'lease-synthetic' } });
documents.set(`jobQueue/${stale}`, { jobId: stale, status: 'CANCELLED' });
await execute({ data: { message: { json: { jobId: stale, leaseToken: 'lease-synthetic' } } } });
assert.equal(documents.get(`jobQueue/${stale}`).status, 'CANCELLED');
assert.equal(documents.get(`jobs/${stale}`).status, 'LEASED');
console.log('[PASS] An already-leased Life Movie job returns to pending without consuming a worker attempt.');
console.log('Synthetic mocks only: this is not hosted authentication, live Firestore, or a movie render.');
