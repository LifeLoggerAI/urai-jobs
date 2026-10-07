import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// Execute the actual request handler. All owners, bytes, credentials, Firestore
// and Storage below are explicit synthetic adapters; no provider is contacted.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const filename = process.env.CR_PUBLISHER_SOURCE || 'functions/src/jobs/capturedRealityRuntimePublisher.ts';
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const digest = value => createHash('sha256').update(value).digest('hex');
const ownerUid = 'synthetic_owner_cr';
const jobId = 'synthetic_cr_job_01';
const assetId = 'synthetic-cr-asset';
const bytes = Buffer.from('synthetic 32-byte splat fixture'.padEnd(64, '.'));
const runtimeSha256 = digest(bytes);
const objectPath = `private-captured-reality/${ownerUid}/${assetId}/runtime/${runtimeSha256}.splat`;
const receiptPath = `capturedRealityRuntimeAdmissions/${digest(`${jobId}\n${assetId}`)}`;
const ownerFencePath = `uraiPrivateLifeModelOwnerFences/${digest(ownerUid)}`;
const cleanupRequestId = 'synthetic_cr_delete_01';
const blockPath = purpose => `jobConsentBlocks/${digest(`${ownerUid}\n${purpose}`)}`;
const clone = value => value === undefined ? undefined : structuredClone(value);

function fixture(hooks = {}) {
  const records = new Map();
  const versions = new Map();
  const storage = new Map();
  const calls = { fetch: 0, save: 0, delete: 0, metadata: 0, transaction: 0, retries: 0 };
  let generation = 0;
  const put = (path, value) => { records.set(path, clone(value)); versions.set(path, (versions.get(path) || 0) + 1); };
  const snapshot = ref => {
    const data = clone(records.get(ref.path));
    return { ref, id: ref.id, exists: data !== undefined, data: () => clone(data), get: key => clone(data?.[key]) };
  };
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(ref(path)),
    set: async (value, options) => put(path, options?.merge ? { ...records.get(path), ...value } : value),
    collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ doc: id => ref(`${path}/${id}`),
    where: (field, operator, value) => {
      let limit = 1000, after;
      const query = { orderBy() { return this; }, limit(value) { limit = value; return this; },
        startAfter(value) { after = typeof value === 'string' ? `${path}/${value}` : value.ref.path; return this; }, get: async () => {
          assert.equal(operator, '==');
          const docs = [...records].filter(([key, data]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/')
            && data[field] === value && (!after || key > after)).sort(([a], [b]) => a.localeCompare(b))
            .slice(0, limit).map(([key]) => snapshot(ref(key)));
          return { docs, size: docs.length };
        } };
      return query;
    },
  });
  const db = {
    collection,
    async runTransaction(callback) {
      calls.transaction++;
      await hooks.beforeTransaction?.({ records, put, calls, storage });
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map();
        const writes = [];
        const tx = {
          get: async document => { reads.set(document.path, versions.get(document.path) || 0); return snapshot(document); },
          create: (document, value) => writes.push({ document, value, create: true }),
          set: (document, value, options) => writes.push({ document, value, options }),
          delete: document => writes.push({ document, remove: true }),
        };
        const result = await callback(tx);
        await hooks.beforeCommit?.({ records, put, calls, storage, reads, writes, attempt });
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) { calls.retries++; continue; }
        for (const write of writes) {
          if (write.create && records.has(write.document.path)) throw new Error('synthetic_create_conflict');
          if (write.remove) { records.delete(write.document.path); versions.set(write.document.path, (versions.get(write.document.path) || 0) + 1); }
          else put(write.document.path, write.options?.merge ? { ...records.get(write.document.path), ...write.value } : write.value);
        }
        return result;
      }
      throw new Error('synthetic_transaction_retry_exhausted');
    },
  };
  const storageApi = { bucket: bucket => ({ file: (path, fileOptions) => ({
    async save(content, options) {
      calls.save++;
      if (storage.has(path)) { const error = new Error('synthetic_precondition'); error.code = 412; throw error; }
      const value = { bytes: Buffer.from(content), metadata: options.metadata, generation: String(++generation), bucket };
      storage.set(path, value);
      await hooks.afterSave?.({ records, put, calls, storage });
    },
    async getMetadata() {
      calls.metadata++;
      if (hooks.metadataFails) throw new Error('synthetic_metadata_unavailable');
      const object = storage.get(path);
      if (!object) { const error = new Error('synthetic_missing_object'); error.code = 404; throw error; }
      const result = { ...object.metadata, generation: object.generation, size: String(object.bytes.length) };
      await hooks.afterGetMetadata?.({ records, put, calls, storage, path });
      return [result];
    },
    async delete(options) {
      calls.delete++;
      if (hooks.deleteFails || hooks.deleteFailPath === path) throw new Error('synthetic_storage_cleanup_unavailable');
      const object = storage.get(path);
      const expectedGeneration = fileOptions?.generation || options?.ifGenerationMatch;
      if (object && expectedGeneration && String(expectedGeneration) !== object.generation) {
        const error = new Error('synthetic_generation_conflict'); error.code = 412; throw error;
      }
      storage.delete(path);
      await hooks.afterDelete?.({ records, put, calls, storage, path });
    },
  }) }) };
  const job = {
    jobType: 'memory.private-source.reconstruct-place', ownerUid, status: 'SUCCESS',
    payload: { spatialAuthorityHead: 'a'.repeat(40), reconstructionMethod: '3dgs' },
    output: { runtime: { ref: `cr-artifact:${digest(jobId)}:${runtimeSha256}`, sha256: runtimeSha256, byteSize: bytes.length } },
    execution: { capturedRealityAcceptedCallbackHash: 'b'.repeat(64) },
  };
  put(`jobs/${jobId}`, job);
  put(`dataRightsRequests/${cleanupRequestId}`, { ownerUid, requestType: 'DELETE', status: 'IN_REVIEW', executionState: 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS' });
  const exports = {};
  const env = {
    URAI_ENV: 'staging', URAI_CAPTURED_REALITY_PUBLISHER_TOKEN: 'synthetic-publisher-token',
    CAPTURED_REALITY_ENGINE_TOKEN: 'synthetic-engine-token', CAPTURED_REALITY_ENGINE_URL: 'https://synthetic-engine.invalid',
    CAPTURED_REALITY_RUNTIME_BUCKET: 'synthetic-private-cr-bucket',
  };
  const context = {
    exports, Buffer, URL, Uint8Array, AbortSignal, Date: hooks.clock ? { now: hooks.clock } : Date, process: { env },
    console: { error() {} },
    fetch: async () => { calls.fetch++; return new Response(hooks.artifactBytes || bytes); },
    require: name => name === 'firebase-admin/app' ? { getApps: () => [true], initializeApp() {} }
      : name === 'firebase-admin/firestore' ? { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { delete: () => undefined, serverTimestamp: () => 'synthetic_timestamp' } }
      : name === 'firebase-admin/storage' ? { getStorage: () => storageApi }
      : name === 'firebase-functions/params' ? { defineSecret: key => ({ value: () => env[key] }) }
      : name === 'firebase-functions/v2/https' ? { onRequest: (_options, handler) => handler }
      : name === '../privacy/consentBlocks.js' ? { consentBlockRef: (_owner, purpose) => ref(blockPath(purpose)) }
      : require(name),
  };
  vm.runInNewContext(code, context);
  const cleanupExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('functions/src/privacy/capturedRealityDerivativeRevocation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { ...context, exports: cleanupExports });
  const request = async () => {
    let statusCode, payload;
    const response = { status(value) { statusCode = value; return this; }, json(value) { payload = value; return this; } };
    await exports.publishCapturedRealityRuntime({ method: 'POST', headers: { authorization: 'Bearer synthetic-publisher-token' },
      body: { jobId, assetId, expectedRuntimeSha256: runtimeSha256 } }, response);
    return { statusCode, payload };
  };
  return { request, calls, records, storage, put, job, receiptPath, objectPath,
    cleanupConsent: event => cleanupExports.deleteCapturedRealityPublishedRuntimeForOwner(ownerUid, event),
    cleanup: () => { put(ownerFencePath, { ...records.get(ownerFencePath), deleted: true, requestId: cleanupRequestId }); return cleanupExports.deleteCapturedRealityPublishedRuntimeForOwner(ownerUid); } };
}

const successfulReceipt = () => ({
  schemaVersion: 'urai-captured-reality-runtime-admission-v1', ownerUid, jobId, assetId,
  runtimeSha256, runtimeByteSize: bytes.length, storageBucket: 'synthetic-private-cr-bucket', runtimeObject: objectPath,
  storageGeneration: '1', spatialAuthorityHead: 'a'.repeat(40), reviewState: 'technical-unreviewed', releaseState: 'hard-off',
  runtimeAuthorityHash: digest(JSON.stringify({ ownerUid, runtimeSha: runtimeSha256, byteSize: bytes.length,
    artifactRef: `cr-artifact:${digest(jobId)}:${runtimeSha256}`, spatialAuthorityHead: 'a'.repeat(40),
    acceptedCallbackHash: 'b'.repeat(64), reconstructionMethod: '3dgs' })),
  candidateAcceptance: false, publicReleaseAuthorized: false,
});

{
  const f = fixture({ beforeTransaction({ calls, put }) { if (calls.save) put(blockPath('location.context'), { active: true }); } });
  const result = await f.request();
  assert.equal(result.statusCode, 409, 'revocation between final consent check and receipt transaction must reject');
  assert.equal(f.records.get(receiptPath)?.revokedAt || f.records.has(receiptPath), false, 'blocked publication creates no usable receipt');
  assert.equal(f.storage.size, 0, 'the exact rejected runtime object must be cleaned up');
  console.log('[PASS] actual CR publisher rejects final-transaction consent revocation and removes its exact output');
}
{
  const f = fixture(); f.put(ownerFencePath, { deleted: true });
  assert.equal((await f.request()).statusCode, 409, 'deleted owner cannot publish a retained successful job');
  assert.equal(f.calls.fetch, 0); assert.equal(f.calls.save, 0);
  console.log('[PASS] canonical owner deletion blocks retained-job artifact redemption');
}
{
  const f = fixture({ afterSave({ put }) { put(ownerFencePath, { deleted: true }); } });
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.storage.size, 0);
  console.log('[PASS] owner deletion during private Storage write cannot produce an admission');
}
{
  let injected = false;
  const f = fixture({ beforeCommit({ put, calls, reads }) {
    if (!injected && calls.save && reads.has(blockPath('memory.storage'))) { injected = true; put(blockPath('memory.storage'), { active: true }); }
  } });
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.calls.retries, 1); assert.equal(f.storage.size, 0);
  console.log('[PASS] Firestore conflict retry revalidates current consent instead of committing across revocation');
}
for (const [label, alter] of [
  ['callback identity', job => { job.execution.capturedRealityAcceptedCallbackHash = 'c'.repeat(64); }],
  ['opaque artifact identity', job => { job.output.runtime.ref = `cr-artifact:${'d'.repeat(64)}:${runtimeSha256}`; }],
  ['artifact byte count', job => { job.output.runtime.byteSize++; }],
  ['Spatial source authority', job => { job.payload.spatialAuthorityHead = 'e'.repeat(40); }],
]) {
  const f = fixture({ afterSave({ records, put }) { const job = clone(records.get(`jobs/${jobId}`)); alter(job); put(`jobs/${jobId}`, job); } });
  assert.equal((await f.request()).statusCode, 409, `changed ${label} cannot retain old runtime authority`);
  assert.equal(f.storage.size, 0);
  console.log(`[PASS] final admission rejects changed ${label}`);
}
{
  const f = fixture(); assert.equal((await f.request()).statusCode, 200);
  const result = await f.request(); assert.equal(result.statusCode, 200); assert.equal(result.payload.replayed, true);
  assert.equal(f.calls.fetch, 1); assert.equal(f.calls.save, 1); assert.equal(f.calls.delete, 0);
  const receipt = f.records.get(receiptPath);
  assert.equal(receipt.reviewState, 'technical-unreviewed'); assert.equal(receipt.releaseState, 'hard-off');
  assert.equal(receipt.candidateAcceptance, false); assert.equal(receipt.publicReleaseAuthorized, false);
  console.log('[PASS] successful publication and idempotent replay retain hard-off technical-unreviewed boundaries');
}
{
  const f = fixture({ afterSave({ put }) { put(receiptPath, successfulReceipt()); } });
  const result = await f.request(); assert.equal(result.statusCode, 200); assert.equal(result.payload.replayed, true);
  assert.equal(f.calls.delete, 0); assert.equal(f.storage.size, 1);
  console.log('[PASS] identical concurrent publication replays the winning receipt without deleting its object');
}
{
  const f = fixture(); f.put(receiptPath, { ...successfulReceipt(), revokedAt: 'synthetic_revoked' });
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.calls.fetch, 0);
  console.log('[PASS] revoked admission cannot be replayed');
}
{
  const f = fixture(); assert.equal((await f.request()).statusCode, 200);
  const changed = clone(f.records.get(`jobs/${jobId}`)); changed.execution.capturedRealityAcceptedCallbackHash = 'e'.repeat(64);
  f.put(`jobs/${jobId}`, changed);
  assert.equal((await f.request()).statusCode, 409, 'replayed receipt cannot transfer authority across a changed callback identity');
  assert.equal(f.calls.fetch, 1);
  console.log('[PASS] replay requires retained callback/artifact/size/source authority hash');
}
{
  const f = fixture({ artifactBytes: Buffer.alloc(bytes.length, 7) });
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.calls.save, 0);
  console.log('[PASS] hash-correct binding cannot accept changed artifact bytes');
}
{
  const hooks = { deleteFails: true, afterSave({ put }) { put(ownerFencePath, { deleted: true }); } };
  const f = fixture(hooks);
  assert.equal((await f.request()).statusCode, 409);
  assert.equal(f.records.has(receiptPath), false);
  const pending = [...f.records].find(([path]) => path.startsWith('capturedRealityRuntimeCleanup/'));
  assert.ok(pending, 'failed compensation must retain an owner-bound durable cleanup target');
  assert.equal(pending[1].cleanupPending, true); assert.equal(f.storage.size, 1);
  hooks.deleteFails = false;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1);
  assert.equal(f.storage.size, 0); assert.equal(f.records.get(pending[0]).cleanupPending, false);
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 0);
  console.log('[PASS] failed Storage compensation remains a durable non-admission target and canonical owner cleanup retries it');
}
{
  const hooks = { deleteFails: true };
  const f = fixture(hooks); assert.equal((await f.request()).statusCode, 200);
  await assert.rejects(f.cleanup(), /synthetic_storage_cleanup_unavailable/);
  assert.equal(f.records.get(receiptPath).releaseState, 'revoked');
  assert.equal(f.records.get(receiptPath).cleanupPending, true);
  assert.equal((await f.request()).statusCode, 409, 'failed cleanup must fence replay before its Storage await');
  hooks.deleteFails = false;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1);
  assert.equal(f.storage.size, 0);
  console.log('[PASS] ordinary revocation fences admission before Storage and retries an exact-generation failure');
}
{
  const f = fixture();
  for (let index = 0; index < 603; index++) {
    const id = `synthetic_paged_${String(index).padStart(4, '0')}`;
    const receipt = { ...successfulReceipt(), assetId: id, runtimeObject: `private-captured-reality/${ownerUid}/${id}/runtime/${runtimeSha256}.splat` };
    f.put(`capturedRealityRuntimeAdmissions/${id}`, receipt);
    f.storage.set(receipt.runtimeObject, { generation: '1' });
  }
  f.put('capturedRealityRuntimeAdmissions/synthetic_foreign', { ...successfulReceipt(), ownerUid: 'synthetic_other_owner' });
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 603);
  assert.equal(f.storage.size, 0);
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_foreign').revokedAt, undefined);
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 0);
  console.log('[PASS] bounded owner pages delete more than 500 admissions, preserve foreign records and replay completed cleanup');
}

function seedCleanup(f, count, collection = 'capturedRealityRuntimeAdmissions') {
  for (let index = 0; index < count; index++) {
    const id = `${collection === 'capturedRealityRuntimeCleanup' ? 'synthetic_compensation' : 'synthetic_bounded'}_${String(index).padStart(5, '0')}`;
    const receipt = { ...successfulReceipt(), assetId: id,
      schemaVersion: collection === 'capturedRealityRuntimeAdmissions' ? 'urai-captured-reality-runtime-admission-v1' : 'urai-captured-reality-runtime-cleanup-v1',
      runtimeObject: `private-captured-reality/${ownerUid}/${id}/runtime/${runtimeSha256}.splat`,
      ...(collection === 'capturedRealityRuntimeCleanup' ? { cleanupPending: true } : {}),
    };
    f.put(`${collection}/${id}`, receipt); f.storage.set(receipt.runtimeObject, { generation: '1' });
  }
}
{
  const f = fixture(); seedCleanup(f, 2203); seedCleanup(f, 603, 'capturedRealityRuntimeCleanup');
  f.put('capturedRealityRuntimeAdmissions/synthetic_foreign', { ...successfulReceipt(), ownerUid: 'synthetic_other_owner' });
  await assert.rejects(f.cleanup(), /runtime_cleanup_continuation_pending/);
  const progress = `dataRightsRequests/${cleanupRequestId}`;
  assert.equal(f.records.get(progress).capturedRealityAdmissionCleanupCursor, 'synthetic_bounded_00999');
  await assert.rejects(f.cleanup(), /runtime_cleanup_continuation_pending/);
  assert.equal(f.records.get(progress).capturedRealityAdmissionCleanupCursor, 'synthetic_bounded_01999');
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 806);
  assert.equal(f.storage.size, 0); assert.equal(f.calls.delete, 2806);
  assert.equal(f.records.get(progress).capturedRealityRuntimeCleanupState, 'COMPLETE');
  assert.equal(f.records.get(progress).capturedRealityAdmissionCleanupCursor, undefined);
  assert.equal(f.records.get(progress).capturedRealityCompensationCleanupCursor, undefined);
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_foreign').revokedAt, undefined);
  console.log('[PASS] bounded runtime cleanup deletes 2203 admissions and 603 compensation targets across three governed continuations');
}
{
  const hooks = {}, f = fixture(hooks); seedCleanup(f, 203);
  const failedPath = f.records.get('capturedRealityRuntimeAdmissions/synthetic_bounded_00150').runtimeObject;
  hooks.deleteFailPath = failedPath;
  await assert.rejects(f.cleanup(), /synthetic_storage_cleanup_unavailable/);
  assert.equal(f.records.get(`dataRightsRequests/${cleanupRequestId}`).capturedRealityAdmissionCleanupCursor, 'synthetic_bounded_00099');
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_bounded_00150').cleanupPending, true);
  hooks.deleteFailPath = undefined;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 53);
  assert.equal(f.calls.delete, 204); assert.equal(f.storage.size, 0);
  console.log('[PASS] runtime cleanup preserves previous acknowledged page and pending exact generation after a middle-page Storage failure');
}
{
  let corrected = false;
  const hooks = { afterDelete({ records, put, storage, path }) { if (!corrected) { corrected = true;
    const id = 'capturedRealityRuntimeAdmissions/synthetic_bounded_00000';
    put(id, { ...records.get(id), storageGeneration: '2' }); storage.set(path, { generation: '2' });
  } } }, f = fixture(hooks); seedCleanup(f, 1);
  await assert.rejects(f.cleanup(), /cleanup_target_changed/);
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_bounded_00000').cleanupAcknowledgedAt, undefined);
  assert.equal(f.storage.size, 1);
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1); assert.equal(f.storage.size, 0);
  console.log('[PASS] changed generation during deletion cannot transfer an old acknowledgement to its replacement and retries current target');
}
{
  const event = { eventId: 'synthetic_cleanup_consent_01', ownerUid, purpose: 'location.context', revokedAt: '2026-10-07T00:00:00.000Z' };
  const hooks = { afterDelete({ records, put }) { put(blockPath(event.purpose), { ...records.get(blockPath(event.purpose)), active: false }); } };
  const f = fixture(hooks); seedCleanup(f, 1);
  const progress = `jobConsentEventReceipts/${digest(event.eventId)}`;
  f.put(progress, { ...event, status: 'blocked' }); f.put(blockPath(event.purpose), { ...event, active: true });
  await assert.rejects(f.cleanupConsent(event), /event_authority_invalid/);
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_bounded_00000').cleanupAcknowledgedAt, undefined);
  hooks.afterDelete = undefined; f.put(blockPath(event.purpose), { ...event, active: true });
  assert.equal((await f.cleanupConsent(event)).publishedRuntimeDeletionsAcknowledged, 1);
  console.log('[PASS] changed canonical consent block during Storage await prevents stale cleanup certification and remains retryable');
}
{
  const hooks = { afterDelete({ records, put }) { const path = `dataRightsRequests/${cleanupRequestId}`; put(path, { ...records.get(path), ownerUid: 'synthetic_foreign_owner' }); } };
  const f = fixture(hooks); seedCleanup(f, 1);
  await assert.rejects(f.cleanup(), /delete_authority_invalid/);
  assert.equal(f.records.get('capturedRealityRuntimeAdmissions/synthetic_bounded_00000').cleanupAcknowledgedAt, undefined);
  const calls = f.calls.delete; await assert.rejects(f.cleanup(), /delete_authority_invalid/); assert.equal(f.calls.delete, calls);
  console.log('[PASS] DELETE request reassignment during Storage await cannot grant foreign cleanup authority or a final certificate');
}
{
  let time = 0;
  const hooks = { clock: () => time, afterDelete() { time = 21000; } }, f = fixture(hooks); seedCleanup(f, 2);
  await assert.rejects(f.cleanup(), /runtime_cleanup_continuation_pending/);
  assert.equal(f.calls.delete, 1); assert.equal(f.storage.size, 1);
  time = 0; hooks.afterDelete = undefined;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1); assert.equal(f.calls.delete, 2);
  console.log('[PASS] runtime cleanup elapsed budget retains unfinished page and resumes without repeating acknowledged generation');
}
{
  const hooks = {}, f = fixture(hooks); seedCleanup(f, 150); seedCleanup(f, 203, 'capturedRealityRuntimeCleanup');
  hooks.deleteFailPath = f.records.get('capturedRealityRuntimeCleanup/synthetic_compensation_00150').runtimeObject;
  await assert.rejects(f.cleanup(), /synthetic_storage_cleanup_unavailable/);
  const progress = `dataRightsRequests/${cleanupRequestId}`;
  assert.equal(f.records.get(progress).capturedRealityAdmissionCleanupState, 'COMPLETE');
  assert.equal(f.records.get(progress).capturedRealityCompensationCleanupCursor, 'synthetic_compensation_00099');
  assert.equal(f.records.get(progress).capturedRealityRuntimeCleanupState, 'PENDING');
  hooks.deleteFailPath = undefined; assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 53);
  assert.equal(f.calls.delete, 354); assert.equal(f.storage.size, 0);
  console.log('[PASS] distinct admission and compensation cursors resume a failed second collection without dropping remaining targets');
}
{
  const event = { eventId: 'synthetic_late_cleanup_01', ownerUid, purpose: 'memory.storage', revokedAt: '2026-10-07T00:00:00.000Z' };
  const f = fixture(); seedCleanup(f, 1);
  const progress = `jobConsentEventReceipts/${digest(event.eventId)}`;
  f.put(progress, { ...event, status: 'blocked' }); f.put(blockPath(event.purpose), { ...event, active: true });
  assert.equal((await f.cleanupConsent(event)).publishedRuntimeDeletionsAcknowledged, 1);
  seedCleanup(f, 1, 'capturedRealityRuntimeCleanup');
  assert.equal((await f.cleanupConsent(event)).publishedRuntimeDeletionsAcknowledged, 1);
  assert.equal(f.storage.size, 0);
  assert.equal((await f.cleanupConsent(event)).publishedRuntimeDeletionsAcknowledged, 0);
  console.log('[PASS] completed canonical replay freshly discovers late compensation and then replays zero remaining cleanup');
}
{
  const hooks = { metadataFails: true }, f = fixture(hooks);
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.storage.size, 1);
  assert.equal(f.records.has(receiptPath), false);
  const pending = [...f.records].find(([path]) => path.startsWith('capturedRealityRuntimeCleanup/'));
  assert.ok(pending, 'successful save followed by metadata outage must retain a pre-write cleanup intent');
  assert.equal(pending[1].cleanupPending, true); assert.equal(pending[1].publicationPending, true);
  hooks.metadataFails = false;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1); assert.equal(f.storage.size, 0);
  assert.equal(f.records.get(pending[0]).publicationPending, false);
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 0);
  console.log('[PASS] metadata outage after successful save retains non-admission intent and recovers exact generation for cleanup');
}
{
  const hooks = { metadataFails: true }, f = fixture(hooks);
  assert.equal((await f.request()).statusCode, 409); hooks.metadataFails = false;
  const object = f.storage.get(objectPath), saved = object.metadata.metadata.uraiRuntimeAuthorityHash;
  object.metadata.metadata.uraiRuntimeAuthorityHash = 'e'.repeat(64);
  await assert.rejects(f.cleanup(), /publication_identity_changed/); assert.equal(f.calls.delete, 0);
  assert.equal(f.storage.size, 1);
  object.metadata.metadata.uraiRuntimeAuthorityHash = saved;
  assert.equal((await f.cleanup()).publishedRuntimeDeletionsAcknowledged, 1);
  console.log('[PASS] unknown generation recovery refuses foreign metadata and never deletes an unbound object');
}
{
  const f = fixture({ beforeCommit({ writes, calls }) {
    if (!calls.save && writes.some(write => write.document.path.startsWith('capturedRealityRuntimeCleanup/'))) throw new Error('synthetic_intent_unavailable');
  } });
  assert.equal((await f.request()).statusCode, 409); assert.equal(f.calls.save, 0); assert.equal(f.storage.size, 0);
  console.log('[PASS] unavailable durable cleanup intent prevents every private Storage write');
}
{
  const hooks = { metadataFails: true }, f = fixture(hooks);
  assert.equal((await f.request()).statusCode, 409); hooks.metadataFails = false; f.storage.clear();
  await assert.rejects(f.cleanup(), /runtime_cleanup_continuation_pending/);
  const pending = [...f.records].find(([path]) => path.startsWith('capturedRealityRuntimeCleanup/'));
  assert.equal(pending[1].cleanupPending, true); assert.equal(pending[1].cleanupAcknowledgedAt, undefined);
  console.log('[PASS] an unresolved write with currently absent bytes cannot issue a physical cleanup acknowledgement');
}
{
  const hooks = { metadataFails: true }, f = fixture(hooks);
  assert.equal((await f.request()).statusCode, 409); hooks.metadataFails = false;
  const event = { eventId: 'synthetic_metadata_consent_01', ownerUid, purpose: 'location.context', revokedAt: '2026-10-07T00:00:00.000Z' };
  f.put(`jobConsentEventReceipts/${digest(event.eventId)}`, { ...event, status: 'blocked' });
  f.put(blockPath(event.purpose), { ...event, active: true });
  hooks.afterGetMetadata = ({ put }) => put(blockPath(event.purpose), { ...event, active: false });
  await assert.rejects(f.cleanupConsent(event), /event_authority_invalid/); assert.equal(f.calls.delete, 0); assert.equal(f.storage.size, 1);
  console.log('[PASS] generation discovery rechecks canonical authority after metadata awaits before adopting or deleting');
}
{
  const f = fixture(); assert.equal((await f.request()).statusCode, 200);
  assert.equal([...f.records].filter(([path]) => path.startsWith('capturedRealityRuntimeCleanup/')).length, 0);
  console.log('[PASS] successful admission atomically removes only its own non-admission publication intent');
}
console.log('URAI_CR_PUBLISHER_SYNTHETIC_AUTHORITY_VALIDATION: complete; no private source/provider/runtime/device acceptance');
