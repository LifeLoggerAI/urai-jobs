import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript'), hash = value => crypto.createHash('sha256').update(value).digest('hex');
const uid = 'fictional_owner', sourceRef = 'psr_fictional_receipt_000001', handle = 'psh_fictional_source_000001';
const sourcePath = `uraiPrivateSourceReceipts/${hash(sourceRef)}`, modelPath = `uraiPrivateLifeModel/${hash(uid + '\n' + handle).slice(0, 40)}`;
const fencePath = `uraiPrivateLifeModelOwnerFences/${hash(uid)}`, requestPath = 'dataRightsRequests/fictional_request';
const body = { requestId: 'fictional_request', retentionDecisionReceiptId: 'fictional_retention_decision', idempotencyKey: 'fictional_execution_key' };
const transcriptRef = 'private:fictional/transcript', provenanceRef = 'private:fictional/provenance';
const consent = { purpose: 'memory.storage', policyVersion: 'fictional-policy', decisionReceiptId: 'fictional-source-consent' };

function fixture(options = {}) {
  const records = new Map(), stats = { uploads: 0, exports: [], destinations: [], cleanup: [], batches: 0, recursiveDeletes: 0, runtimeCleanup: 0 };
  let versionClock = 0; const versions = new Map();
  let clock = 1_780_000_000_000, serial = Promise.resolve();
  const DELETE = '__fixture_delete_field__', clone = value => value === undefined ? undefined : structuredClone(value);
  function write(path, value, merge = false, dotted = false) {
    const result = merge ? clone(records.get(path) || {}) : {};
    for (const [key, item] of Object.entries(value)) {
      const parts = dotted ? key.split('.') : [key]; let target = result;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      if (item === DELETE) delete target[parts.at(-1)]; else target[parts.at(-1)] = clone(item);
    }
    records.set(path, result);
  }
  function version(path) { const fingerprint = JSON.stringify(records.get(path)); const old = versions.get(path);
    if (!old || old.fingerprint !== fingerprint) versions.set(path, { fingerprint, clock: ++versionClock });
    const stamp = versions.get(path).clock; return { seconds: stamp, nanoseconds: 0, isEqual: other => other?.seconds === stamp && other?.nanoseconds === 0 }; }
  function snapshot(path) { const value = clone(records.get(path)); return { id: path.split('/').at(-1), ref: document(path),
    exists: value !== undefined, updateTime: version(path), data: () => clone(value) }; }
  function document(path) { return { path, id: path.split('/').at(-1), collection: name => query(`${path}/${name}`),
    get: async () => snapshot(path), set: async (value, settings) => write(path, value, settings?.merge),
    update: async value => { assert.ok(records.has(path)); write(path, value, true, true); }, delete: async () => records.delete(path) }; }
  function query(path, filters = [], maximum = Infinity, after = '') {
    const capture = () => ({ docs: [...records.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/'))
      .filter(key => key.slice(path.length + 1) > after && filters.every(([field, value]) => records.get(key)?.[field] === value)).sort().slice(0, maximum).map(snapshot) });
    return { path, capture, doc: id => document(`${path}/${id}`),
    where: (key, operator, value) => { assert.equal(operator, '=='); return query(path, [...filters, [key, value]], maximum, after); },
    orderBy: key => { assert.equal(key, '__name__'); return query(path, filters, maximum, after); }, limit: value => query(path, filters, value, after),
    startAfter: value => query(path, filters, maximum, typeof value === 'string' ? value : value.id),
    get: async () => { const docs = [...records.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/'))
      .filter(key => key.slice(path.length + 1) > after && filters.every(([field, value]) => records.get(key)?.[field] === value)).sort().slice(0, maximum).map(snapshot);
      await options.afterQuery?.(path, records); return { docs, size: docs.length }; } }; }
  const db = { collection: name => query(name), doc: document,
    runTransaction: async callback => { const operation = serial.then(async () => { const writes = [], reads = new Map(), queries = new Map(), deletedPaths = [];
      const tx = { get: async ref => { assert.equal(writes.length, 0); if (!ref.id) { const result = await ref.get(); queries.set(ref, JSON.stringify(result.docs.map(doc => [doc.ref.path, doc.updateTime.seconds, doc.updateTime.nanoseconds]))); return result; }
          const result = snapshot(ref.path); reads.set(ref.path, result.updateTime); await options.afterTransactionRead?.(ref.path, records); return result; },
        delete: (ref, precondition) => { deletedPaths.push(ref.path); writes.push(() => { if (precondition?.lastUpdateTime) assert.equal(precondition.lastUpdateTime.isEqual(version(ref.path)), true); records.delete(ref.path); }); },
        set: (ref, value, settings) => writes.push(() => write(ref.path, value, settings?.merge)),
        create: (ref, value) => writes.push(() => { assert.equal(records.has(ref.path), false); write(ref.path, value); }),
        update: (ref, value) => writes.push(() => { assert.ok(records.has(ref.path)); write(ref.path, value, true, true); }) };
      tx.getAll = async (...refs) => Promise.all(refs.map(ref => tx.get(ref)));
      const value = await callback(tx); await options.beforeTransactionCommit?.(reads, writes, records);
      for (const [query, original] of queries) if (JSON.stringify(query.capture().docs.map(doc => [doc.ref.path, doc.updateTime.seconds, doc.updateTime.nanoseconds])) !== original) throw new Error('fictional-transaction-query-conflict');
      for (const [path, stamp] of reads) if (!stamp.isEqual(version(path))) throw new Error('fictional-transaction-read-conflict');
      assert.ok(writes.length <= 500, 'Firestore transaction exceeds 500 writes');
      if (writes.length && [...reads.keys()].some(path => /\/(state|revisions|idempotency|transcripts|transcriptionAttempts)\//.test(path))) {
        stats.batches++; if (options.failFirstBatch && stats.batches === 1) throw new Error('fictional-storage-interruption');
      }
      if (deletedPaths.some(path => path.startsWith('uraiPrivate') && path.split('/').length === 2)) {
        stats.recursiveDeletes++; if (options.failFirstDelete && stats.recursiveDeletes === 1) throw new Error('fictional-delete-interruption');
      }
      for (const write of writes) write(); await options.afterTransactionCommit?.(reads, writes, records); return value;
    }); serial = operation.catch(() => {}); return operation; },
    batch: () => { const writes = []; return { delete: ref => writes.push(() => records.delete(ref.path)),
      set: (ref, value, settings) => writes.push(() => write(ref.path, value, settings?.merge)),
      update: (ref, value) => writes.push(() => write(ref.path, value, true, true)), commit: async () => { assert.ok(writes.length <= 500, 'Firestore batch exceeds 500 writes');
        stats.batches++; if (options.failFirstBatch && stats.batches === 1) throw new Error('fictional-storage-interruption'); for (const write of writes) write(); } }; },
    recursiveDelete: async ref => { stats.recursiveDeletes++; if (options.failFirstDelete && stats.recursiveDeletes === 1) throw new Error('fictional-delete-interruption');
      for (const path of records.keys()) if (path === ref.path || path.startsWith(ref.path + '/')) records.delete(path); },
  };
  const firestore = { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { serverTimestamp: () => 'fictional-time', delete: () => DELETE } };
  const env = { URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE: 'protected-staging', GCLOUD_PROJECT: 'fictional-project',
    URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT: 'fictional-project', GCS_BUCKET_NAME: 'fictional-private-bucket', URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET: 'fictional-private-bucket', ...options.env };
  class FixtureDate extends Date { static now() { return clock; } }
  const modules = new Map();
  function load(path) { if (modules.has(path)) return modules.get(path); const exports = {}; modules.set(path, exports);
    const code = ts.transpileModule(fs.readFileSync(path === 'privacy/privateLifeModelDataRights' && process.env.JOBS_PRIVATE_RIGHTS_SOURCE ? process.env.JOBS_PRIVATE_RIGHTS_SOURCE : path === 'privacy/dataRightsExecution' && process.env.JOBS_DELETION_SOURCE ? process.env.JOBS_DELETION_SOURCE : new URL(`../functions/src/${path}.ts`, import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, Date: FixtureDate, process: { env }, require(name) {
      if (name === 'firebase-admin/firestore') return firestore;
      if (name === 'firebase-admin/auth') return { getAuth: () => ({ verifyIdToken: async (token, revoked) => { assert.equal(token, 'fictional-current-operator-token'); assert.equal(revoked, true); return { uid: 'operatorFixture' }; }, getUser: async () => ({ uid: 'operatorFixture', disabled: false }) }) };
      if (name === 'firebase-admin/storage') return { getStorage: () => ({ bucket: () => ({ getMetadata: async () => [{ iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } }],
        file: object => ({ delete: async () => { if (options.failCleanup) throw new Error('fictional-cleanup-failure'); stats.cleanup.push(object); } }) }) }) };
      if (name === 'firebase-functions/v1') return { https: { onCall: handler => handler } };
      if (name === 'node:crypto' || name === 'zod') return require(name);
      if (name === '../core/auth.js') return load('core/auth');
      if (name === './firestore-paths.js') return { userDoc: owner => db.collection('users').doc(owner) };
      if (name === '../core/errors.js' || name === './errors.js') return { httpsError: (code, message) => Object.assign(new Error(message), { code }) };
      if (name === './privateLifeModelDataRights.js') return load('privacy/privateLifeModelDataRights');
      if (name === './dataRightsContinuationPolicy.js') return load('privacy/dataRightsContinuationPolicy');
      if (name === './capturedRealityDerivativeRevocation.js') return {
        deleteCapturedRealityEngineJob: async () => { throw new Error('Reconstruction is outside these fixtures'); },
        deleteCapturedRealityPublishedRuntimeForOwner: async owner => {
          assert.equal(owner, uid); stats.runtimeCleanup++;
          assert.equal(records.get(fencePath)?.deleted, true, 'permanent owner fence precedes runtime cleanup');
          assert.equal(records.get(requestPath)?.executionState, 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS');
          if (options.runtimeCleanupFailure) throw new Error(options.runtimeCleanupFailure);
          if (stats.runtimeCleanup <= (options.runtimeContinuationCount || 0)) {
            throw new Error('captured_reality_runtime_cleanup_continuation_pending');
          }
          return { publishedRuntimeDeletionsAcknowledged: 0 };
        },
      };
      if (name === '../core/gcs.js') return { uploadToGcs: async (bytes, destination) => { const call = ++stats.uploads;
        stats.destinations.push(destination);
        if (options.failAllUploads || (options.failFirstUpload && call === 1)) throw new Error('fictional-upload-interruption');
        await options.onUpload?.(call, records); stats.exports.push(JSON.parse(Buffer.from(bytes).toString())); return `gs://fictional-private-bucket/${destination}`; } };
      throw new Error(`Unexpected rights test dependency: ${name}`);
    } }); return exports;
  }
  records.set('users/operatorFixture', { role: 'operator' }); records.set(`users/${uid}`, { role: 'candidate', privateBiography: 'Fictional owner data only' });
  records.set(requestPath, { ownerUid: uid, requestType: options.requestType || 'EXPORT', status: 'APPROVED' });
  records.set(sourcePath, { schemaVersion: 'urai-private-source-receipt-v2', ownerUid: uid, sourceReceiptRef: sourceRef, sourceHandle: handle,
    status: 'ACTIVE', synthetic: false, sourceEvidenceClass: 'SOURCE_CAPTURED', sourceRevision: 1, sourceSha256: 'a'.repeat(64), sourceFixityRef: 'private:fictional/fixity', sourceByteLength: 100, consent, purposes: ['memory-index'] });
  records.set(`${sourcePath}/transcripts/${hash(transcriptRef)}`, { schemaVersion: 'urai-private-source-transcript-v2', ownerUid: uid, sourceReceiptRef: sourceRef,
    transcriptRef, provenanceRef, requestedPurpose: 'memory-index', status: 'CURRENT', synthetic: false, sourceRevision: 1,
    sourceSha256: 'a'.repeat(64), transcriptSha256: 'b'.repeat(64), provenanceSha256: 'c'.repeat(64) });
  records.set(modelPath, { ownerUid: uid, sourceHandleHash: modelPath.split('/')[1], historicalSourceAuthority: false });
  records.set(`${modelPath}/revisions/00000001`, { schemaVersion: 'urai-life-model-v1', ownerUid: uid, jobId: 'fictional_job', sourceHandleHash: modelPath.split('/')[1],
    lineage: { schemaVersion: 'urai-private-source-receipt-v2', ownerUid: uid, jobId: 'fictional_job', sourceReceiptRef: sourceRef, sourceHandleHash: hash(handle) }, historicalSourceAuthority: false,
    extraction: { claims: [{ object: 'Fictional unreviewed claim' }] }, accessToken: 'fictional-secret' });
  records.set(`${modelPath}/state/current`, { ownerUid: uid, revision: 1 }); records.set(`${modelPath}/idempotency/key`, { ownerUid: uid, state: 'FINISHED' });
  records.set('jobs/fictional_job', { jobId: 'fictional_job', ownerUid: uid, type: 'memory.private-source.index', status: 'SUCCESS', consent,
    payload: { sourceReceiptRef: sourceRef, transcriptRef, provenanceRef, requestedPurpose: 'memory-index' }, execution: { leaseToken: 'fictional_lease' } });
  records.set('jobQueue/fictional_job', { status: 'SUCCESS' });
  const handler = load('privacy/dataRightsExecution').processDataRightsRequest, helper = load('privacy/privateLifeModelDataRights');
  return { records, stats, db, helper, advance: ms => { clock += ms; },
    execute: (data = body, context = { auth: { uid: 'operatorFixture' }, rawRequest: { get: () => 'Bearer fictional-current-operator-token' } }) => handler(data, context),
    finalize: (patch = {}) => db.runTransaction(tx => helper.canFinalizePrivateSource(db, tx, records.get('jobs/fictional_job'), { result: {
      ownerUid: uid, jobId: 'fictional_job', sourceReceiptRef: sourceRef, requestedPurpose: 'memory-index', sourceEvidenceClass: 'SOURCE_CAPTURED', sourceRevision: 1,
      sourceSha256: 'a'.repeat(64), sourceFixityRef: 'private:fictional/fixity', transcriptRef, provenanceRef,
      transcriptSha256: 'b'.repeat(64), provenanceSha256: 'c'.repeat(64), historicalSourceAuthority: false, reviewState: 'OWNER_REVIEW_REQUIRED', ...patch } })) };
}

test('actual approved export retains owned source/graph records privately and redacts credentials', async () => { const f = fixture(), out = await f.execute();
  assert.equal(out.replay, false); assert.equal(f.stats.exports[0].privateLifeModel.records.length, 6); assert.equal(JSON.stringify(f.stats.exports[0]).includes('fictional-secret'), false);
  assert.equal(f.stats.exports[0].completeEcosystemExport, false); assert.equal(f.records.get(requestPath).status, 'IN_REVIEW'); });
test('hard-off project/production/auth gates prevent owned derivative processing', async () => {
  for (const env of [{ URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE: '' }, { URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT: 'different-project' }, { URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED: 'true' }]) {
    const f = fixture({ env }); await assert.rejects(f.execute(), error => error.code === 'failed-precondition'); assert.equal(f.stats.uploads, 0); assert.equal(f.records.has(fencePath), false); }
  const f = fixture(); await assert.rejects(f.execute(body, {}), error => error.code === 'unauthenticated'); await assert.rejects(f.execute(body, { auth: { uid } }), error => error.code === 'permission-denied'); });
test('initial execution still requires a real stored approved-request state', async () => { const f = fixture(); f.records.get(requestPath).status = 'SUBMITTED';
  await assert.rejects(f.execute(), error => error.code === 'failed-precondition'); assert.equal(f.stats.uploads, 0); });
test('finished same-input execution replays without another storage write', async () => { const f = fixture(); await f.execute(); assert.equal((await f.execute()).replay, true); assert.equal(f.stats.uploads, 1); });
test('private export does not invoke runtime deletion', async () => {
  const f = fixture(); await f.execute(); assert.equal(f.stats.runtimeCleanup, 0);
});
test('published runtime deletion advances four bounded continuations without spending the failure budget', async () => {
  const f = fixture({ requestType: 'DELETE', runtimeContinuationCount: 4 });
  for (let delivery = 1; delivery <= 4; delivery++) {
    await assert.rejects(f.execute(), error => error.code === 'resource-exhausted');
    const receipt = [...f.records.values()].find(row => row.event === 'DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED');
    assert.equal(receipt.failureAttempts, 0); assert.equal(receipt.continuationDeliveries, delivery);
    assert.equal(f.records.get('jobs/fictional_job').ownerUid, uid, 'owned job remains discoverable while cleanup is pending');
    assert.equal(f.records.get(requestPath).executionState, 'PROTECTED_STAGING_EXECUTION_CONTINUATION_REQUIRED');
  }
  const completed = await f.execute(); assert.equal(completed.replay, false); assert.equal(f.stats.runtimeCleanup, 5);
  assert.equal(completed.receipt.result.capturedRealityRuntime.publishedRuntimeDeletionsAcknowledged, 0);
  assert.equal(f.records.get('jobs/fictional_job').ownerUid.startsWith('deleted:'), true);
  assert.equal(f.records.get(fencePath).deletionEpoch, 1);
  assert.equal((await f.execute()).replay, true); assert.equal(f.stats.runtimeCleanup, 5);
});
test('unknown runtime deletion failures retain the three-failure budget and permanent privacy fence', async () => {
  const f = fixture({ requestType: 'DELETE', runtimeCleanupFailure: 'fictional-runtime-storage-failure' });
  for (let failure = 1; failure <= 3; failure++) await assert.rejects(f.execute(), error => error.code === 'internal');
  await assert.rejects(f.execute(), error => error.code === 'resource-exhausted');
  assert.equal(f.stats.runtimeCleanup, 3); assert.equal(f.records.get(fencePath).deleted, true);
  assert.equal(f.records.get('jobs/fictional_job').ownerUid, uid);
  const receipt = [...f.records.values()].find(row => row.event === 'DATA_RIGHTS_EXECUTION_FAILED');
  assert.equal(receipt.failureAttempts, 3); assert.equal(receipt.continuationDeliveries, 0);
});
test('transient upload failure remains retryable within the admitted attempt ceiling', async () => { const f = fixture({ failFirstUpload: true });
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal((await f.execute()).replay, false); assert.equal(f.stats.uploads, 2); });
test('three failed attempts require reconciliation instead of unlimited work', async () => { const f = fixture({ failAllUploads: true });
  for (let i = 0; i < 3; i++) await assert.rejects(f.execute(), error => error.code === 'internal'); await assert.rejects(f.execute(), error => error.code === 'resource-exhausted'); assert.equal(f.stats.uploads, 3); });
test('changed retention receipt cannot reuse a terminal idempotency key', async () => { const f = fixture(); await f.execute();
  await assert.rejects(f.execute({ ...body, retentionDecisionReceiptId: 'different_retention_receipt' }), error => error.code === 'already-exists'); });
test('terminal receipt cannot cross a changed owner or request operation', async () => { for (const patch of [{ ownerUid: 'different_owner' }, { requestType: 'DELETE' }]) {
  const f = fixture(); await f.execute(); Object.assign(f.records.get(requestPath), patch); await assert.rejects(f.execute(), error => error.code === 'already-exists'); } });
test('revoked approval cannot authorize a terminal private export replay', async () => { const f = fixture(); await f.execute(); f.records.get(requestPath).status = 'DENIED';
  await assert.rejects(f.execute(), error => error.code === 'failed-precondition'); });
test('interrupted STARTED work recovers after expiry and late completion is fenced', async () => { let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  const f = fixture({ onUpload: async call => { if (call === 1) { entered(); await blocked; } } }); const first = f.execute(); await started; f.advance(180001);
  let second; try { second = await f.execute(); } finally { release(); } assert.equal(second.replay, false); await assert.rejects(first, error => error.code === 'unavailable');
  assert.equal((await f.execute()).replay, true); });
test('late failure cannot overwrite the successor terminal receipt', async () => { let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  const f = fixture({ onUpload: async call => { if (call === 1) { entered(); await blocked; throw new Error('fictional-late-failure'); } } });
  const first = f.execute(); await started; f.advance(180001); let second; try { second = await f.execute(); } finally { release(); }
  assert.equal(second.replay, false); await assert.rejects(first, error => error.code === 'internal'); assert.equal((await f.execute()).replay, true);
  assert.notEqual(f.stats.destinations[0], f.stats.destinations[1]); assert.ok(f.stats.cleanup.includes(f.stats.destinations[0])); });
test('active same-input execution reports in progress without duplicating export', async () => { let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  const f = fixture({ onUpload: async () => { entered(); await blocked; } }); const first = f.execute(); await started;
  try { await assert.rejects(f.execute(), error => error.code === 'unavailable'); } finally { release(); } await first; assert.equal(f.stats.uploads, 1); });
for (const count of [499, 602]) test(`actual deletion chunks ${count} logs within Firestore write bounds`, async () => {
  const f = fixture({ requestType: 'DELETE' }); for (let i = 0; i < count; i++) f.records.set(`jobs/fictional_job/logs/log_${i}`, { privateFixture: true });
  const out = await f.execute(); assert.equal(out.receipt.result.logDeletes, count); assert.equal(f.records.get('jobs/fictional_job').ownerUid.startsWith('deleted:'), true);
  assert.equal([...f.records.keys()].some(path => path.startsWith('jobs/fictional_job/logs/')), false); });
test('interrupted private derivative cleanup retries with one stable deletion epoch', async () => { const f = fixture({ requestType: 'DELETE', failFirstDelete: true });
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal(f.records.get(fencePath).deleted, true); const epoch = f.records.get(fencePath).deletionEpoch;
  await f.execute(); assert.equal(f.records.get(fencePath).deletionEpoch, epoch); assert.equal(epoch, 1); });
test('restored old source and derivative rows stay denied after deletion', async () => { const f = fixture(), saved = [...f.records].filter(([path]) => path.startsWith('uraiPrivate'));
  await f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'); for (const [path, value] of saved) f.records.set(path, value);
  await assert.rejects(f.helper.exportOwnedPrivateLifeModel(f.db, uid), /deleted|epoch/); });
test('owner deletion during export prevents a private output receipt', async () => { let changed = false;
  const f = fixture({ afterQuery: (path, records) => { if (!changed && path === `${sourcePath}/transcripts`) { changed = true; records.set(fencePath, { deleted: true, ownerHash: hash(uid), deletionEpoch: 1 }); } } });
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal(f.stats.uploads, 0); });
test('invalid protected source receipt identity cannot appear as proven exported source lineage', async () => { const f = fixture(); f.records.get(sourcePath).sourceReceiptRef = 'psr_different_receipt_000001';
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal(f.stats.uploads, 0); });
for (const patch of [{ ownerUid: 'different_owner' }, { jobId: 'different_job' }, { sourceReceiptRef: 'psr_different_receipt_000001' }, { requestedPurpose: 'transcribe' }, { sourceEvidenceClass: 'SOURCE_DERIVED' }]) {
  test(`dispatcher source receipt lineage rejects ${Object.keys(patch)[0]} substitution`, async () => { const f = fixture(); assert.equal(await f.finalize(), true); assert.equal(await f.finalize(patch), false); }); }

test('current source consent decision must still match the canonical job at finalization', async () => { const f = fixture(); assert.equal(await f.finalize(), true);
  f.records.get(sourcePath).consent = { ...consent, decisionReceiptId: 'different_source_consent' }; assert.equal(await f.finalize(), false); });
for (const patch of [{ schemaVersion: 'urai-private-source-transcript-v1' }, { requestedPurpose: 'asr' },
  { sourceReceiptRef: 'psr_different_receipt_000001' }, { sourceSha256: 'd'.repeat(64) }]) {
  test(`current transcript lineage rejects ${Object.keys(patch)[0]} substitution at finalization`, async () => {
    const f = fixture(); assert.equal(await f.finalize(), true);
    Object.assign(f.records.get(`${sourcePath}/transcripts/${hash(transcriptRef)}`), patch);
    assert.equal(await f.finalize(), false);
  });
}
test('exported revision root must belong to the protected source handle and owner', async () => {
  const f = fixture(), alternateHandle = 'psh_other_owned_source_000001';
  f.records.get(sourcePath).sourceHandle = alternateHandle;
  f.records.get(`${modelPath}/revisions/00000001`).lineage.sourceHandleHash = hash(alternateHandle);
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal(f.stats.uploads, 0);
});
test('cleanup failure retains an attempt receipt and requires explicit reconciliation', async () => { const f = fixture({ failFirstUpload: true, failCleanup: true });
  await assert.rejects(f.execute(), error => error.code === 'internal'); assert.equal(f.records.get(requestPath).executionState, 'PROTECTED_STAGING_EXECUTION_FAILED_RECONCILIATION_REQUIRED');
  const pending = [...f.records.values()].find(row => row.privateExportCleanupPending === true); assert.match(pending.exportAttemptObjectKey, /^[a-f0-9]{32}$/);
  await assert.rejects(f.execute(), error => error.code === 'failed-precondition'); assert.equal(f.stats.uploads, 1); });
test('bounded child deletion exhaustion resumes remaining rows without reopening owner authority', async () => { const f = fixture();
  for (let i = 2; i <= 10001; i++) f.records.set(`${modelPath}/revisions/${String(i).padStart(8, '0')}`, { ownerUid: uid });
  await assert.rejects(f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'), /delete_child_limit/);
  assert.equal(f.records.get(fencePath).deletionEpoch, 1); assert.equal((await f.db.collection(`${modelPath}/revisions`).get()).size, 1);
  await f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_retry'); assert.equal(f.records.get(fencePath).deletionEpoch, 1); assert.equal(f.records.has(modelPath), false); });
test('owner deletion pages more than 2000 source/index roots instead of failing at one enumeration', async () => { const f = fixture();
  for (let i = 0; i < 2001; i++) f.records.set(`uraiPrivateLifeModel/${hash(`fictional_root_${i}`).slice(0, 40)}`, { ownerUid: uid });
  const out = await f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'); assert.equal(out.localRootDeletionsAcknowledged, 2003);
  assert.equal((await f.db.collection('uraiPrivateLifeModel').where('ownerUid', '==', uid).get()).size, 0); });
test('foreign-owner children remain preserved behind the deletion fence', async () => { const f = fixture();
  f.records.set(`${modelPath}/revisions/foreign_fixture`, { ownerUid: 'foreign_owner', privateFixture: true });
  await assert.rejects(f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'), /delete_child_owner_mismatch/);
  assert.equal(f.records.get(`${modelPath}/revisions/foreign_fixture`).ownerUid, 'foreign_owner'); assert.equal(f.records.get(fencePath).deleted, true); });
test('malformed retained terminal receipt fails closed without a raw digest exception', async () => { const f = fixture(); await f.execute();
  const receipt = [...f.records.values()].find(row => row.event === 'DATA_RIGHTS_EXECUTION_FINISHED'); delete receipt.result;
  await assert.rejects(f.execute(), error => error.code === 'failed-precondition'); });
test('bounded owner job deletion resumes a scope larger than one execution', async () => { const f = fixture({ requestType: 'DELETE' });
  for (let i = 0; i < 2001; i++) f.records.set(`jobs/fictional_extra_${i}`, { jobId: `fictional_extra_${i}`, ownerUid: uid, status: 'SUCCESS' });
  await assert.rejects(f.execute(), error => error.code === 'resource-exhausted');
  assert.equal((await f.db.collection('jobs').where('ownerUid', '==', uid).get()).size, 2);
  await f.execute(); assert.equal((await f.db.collection('jobs').where('ownerUid', '==', uid).get()).size, 0); assert.equal(f.records.get(fencePath).deletionEpoch, 1); });

function consentFixture(options = {}) {
  const f = fixture(options), event = { ownerUid: uid, purpose: 'memory.storage', eventId: 'fictional_consent_cleanup' };
  const receipt = 'jobConsentEventReceipts/' + hash(event.eventId), block = 'jobConsentBlocks/' + hash(uid + String.fromCharCode(10) + event.purpose);
  f.records.set(receipt, { consumerId: 'urai-jobs', eventId: event.eventId, ownerUid: uid, purpose: event.purpose,
    status: 'blocked', eventBindingVersion: 'urai-jobs-consent-event-binding-v1', eventBindingHash: hash('fictional canonical event only') });
  f.records.set(block, { ownerUid: uid, purpose: event.purpose, active: true });
  return { ...f, event, receipt, block, revoke: () => f.helper.invalidatePrivateLifeModelForConsent(event) };
}
test('private consent cleanup resumes more than 4000 owner jobs from an atomic durable cursor', async () => {
  const f = consentFixture();
  for (let i = 0; i < 4002; i++) {
    const id = 'bulk_' + String(i).padStart(5, '0');
    f.records.set('jobs/' + id, { ownerUid: uid, type: 'memory.private-source.index', status: 'RUNNING', output: { private: true }, execution: { leaseToken: 'fictional' } });
  }
  await assert.rejects(f.revoke(), /scope_continuation/);
  const progress = f.records.get(f.receipt).privateLifeModelInvalidationProgress;
  assert.equal(progress.phase, 'jobs'); assert.equal(progress.jobsInvalidated, 4000); assert.ok(progress.cursor);
  const out = await f.revoke();
  assert.equal(out.jobsInvalidated, 4003); assert.equal(out.completePrivateSourceRevocation, false);
  assert.equal(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'DONE');
  assert.equal(f.records.has(fencePath), false); assert.equal(f.records.has(modelPath), false);
  const replay = await f.revoke(); assert.equal(replay.jobsInvalidated, out.jobsInvalidated);
  assert.ok([...f.records].filter(([p]) => p.startsWith('jobs/')).every(([,d]) => d.status === 'CANCELLED' && d.output === undefined));
});
test('private consent cleanup pages retained source grants and erased model roots beyond 2000', async () => {
  const f = consentFixture();
  for (let i = 0; i < 2001; i++) {
    f.records.set('uraiPrivateSourceReceipts/' + hash('bulk source ' + i), { ownerUid: uid, status: 'ACTIVE' });
    f.records.set('uraiPrivateLifeModel/' + hash('bulk model ' + i).slice(0,40), { ownerUid: uid });
  }
  await assert.rejects(f.revoke(), /scope_continuation/);
  assert.equal(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'sources');
  await assert.rejects(f.revoke(), /scope_continuation/);
  assert.equal(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'models');
  const out = await f.revoke();
  assert.equal(out.localRootDeletionsAcknowledged, 2002); assert.equal((await f.db.collection('uraiPrivateLifeModel').get()).size, 0);
  assert.ok([...f.records].filter(([p]) => p.startsWith('uraiPrivateSourceReceipts/') && p.split('/').length === 2).every(([,d]) => d.status === 'REVOKED'));
});
test('private consent cleanup resumes interrupted child erasure without dropping its parent cursor', async () => {
  const f = consentFixture();
  for (let i = 0; i < 10001; i++) f.records.set(sourcePath + '/transcripts/bulk_' + String(i).padStart(5, '0'), { ownerUid: uid });
  await assert.rejects(f.revoke(), /child_continuation/);
  assert.equal(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'sources');
  assert.equal(f.records.get(f.receipt).privateLifeModelInvalidationProgress.cursor, '');
  assert.equal((await f.db.collection(sourcePath + '/transcripts').get()).size, 2);
  await f.revoke(); assert.equal((await f.db.collection(sourcePath + '/transcripts').get()).size, 0);
});
test('private consent cleanup preserves a foreign-owner child and refuses a success continuation', async () => {
  const f = consentFixture(), foreign = sourcePath + '/transcripts/foreign';
  f.records.set(foreign, { ownerUid: 'different_owner', private: true });
  await assert.rejects(f.revoke(), /child_owner_mismatch/);
  assert.equal(f.records.get(foreign).ownerUid, 'different_owner');
  assert.notEqual(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'DONE');
});
test('private consent cleanup revalidates canonical block changes during enumeration', async () => {
  let changed = false;
  const f = consentFixture({ afterQuery: (path, records) => {
    if (path === 'jobs' && !changed) { changed = true; records.get('jobConsentBlocks/' + hash(uid + String.fromCharCode(10) + 'memory.storage')).active = false; }
  } });
  await assert.rejects(f.revoke(), /authority_changed/);
  assert.equal(f.records.get('jobs/fictional_job').status, 'SUCCESS');
  assert.equal(f.records.get(sourcePath).status, 'ACTIVE');
});



for (const reason of ['child-owner', 'child-version', 'root-owner', 'request-authority']) test(`deletion rechecks awaited child page: ${reason}`, async () => {
  const childPath = `${modelPath}/revisions/00000001`; let changed = false, admitted = true;
  const f = fixture({ afterQuery: (path, records) => { if (path !== `${modelPath}/revisions` || changed) return; changed = true;
    if (reason === 'child-owner') records.get(childPath).ownerUid = 'different_owner';
    if (reason === 'child-version') records.get(childPath).extraction = { claims: [{ object: 'Fictional corrected private claim' }] };
    if (reason === 'root-owner') records.get(modelPath).ownerUid = 'different_owner';
    if (reason === 'request-authority') admitted = false;
  } });
  const checkpoint = async () => { if (!admitted) throw new Error('fictional-request-authority-withdrawn'); };
  await assert.rejects(f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete', checkpoint));
  assert.equal(f.records.has(childPath), true); assert.equal(f.records.has(modelPath), true);
});
for (const reason of ['child-owner', 'child-version', 'root-owner', 'block']) test(`consent rechecks awaited transcript page: ${reason}`, async () => {
  const childPath = `${sourcePath}/transcripts/${hash(transcriptRef)}`; let changed = false;
  const f = consentFixture({ afterQuery: (path, records) => { if (path !== `${sourcePath}/transcripts` || changed) return; changed = true;
    if (reason === 'child-owner') records.get(childPath).ownerUid = 'different_owner';
    if (reason === 'child-version') records.get(childPath).transcriptSha256 = 'd'.repeat(64);
    if (reason === 'root-owner') records.get(sourcePath).ownerUid = 'different_owner';
    if (reason === 'block') records.get('jobConsentBlocks/' + hash(uid + String.fromCharCode(10) + 'memory.storage')).active = false;
  } });
  await assert.rejects(f.revoke()); assert.equal(f.records.has(childPath), true);
  assert.notEqual(f.records.get(f.receipt).privateLifeModelInvalidationProgress.phase, 'DONE');
});
for (const reason of ['root-owner', 'source-version', 'child-version']) test(`export rechecks exact owned source snapshot: ${reason}`, async () => {
  let changed = false;
  const f = fixture({ afterQuery: (path, records) => { if (path !== `${sourcePath}/transcripts` || changed) return; changed = true;
    if (reason === 'root-owner') records.get(sourcePath).ownerUid = 'different_owner';
    if (reason === 'source-version') records.get(sourcePath).sourceRevision = 2;
    if (reason === 'child-version') records.get(`${sourcePath}/transcripts/${hash(transcriptRef)}`).transcriptSha256 = 'd'.repeat(64);
  } });
  await assert.rejects(f.helper.exportOwnedPrivateLifeModel(f.db, uid)); assert.equal(f.stats.uploads, 0);
});
for (const reason of ['root-owner', 'root-version']) test(`consent model deletion preserves a changed parent after child erasure: ${reason}`, async () => {
  let changed = false;
  const f = consentFixture({ afterQuery: (path, records) => { if (path !== `${modelPath}/idempotency` || changed) return; changed = true;
    if (reason === 'root-owner') records.get(modelPath).ownerUid = 'different_owner';
    if (reason === 'root-version') records.get(modelPath).corrected = 'Fictional source correction';
  } });
  await assert.rejects(f.revoke()); assert.equal(f.records.has(modelPath), true);
});
for (const reason of ['foreign', 'missing']) test(`consent job cancellation preserves ${reason} queue identity`, async () => {
  const f = consentFixture(); if (reason === 'foreign') f.records.set('jobQueue/fictional_job', { ownerUid: 'different_owner', status: 'RUNNING' });
  else f.records.delete('jobQueue/fictional_job');
  if (reason === 'foreign') { await assert.rejects(f.revoke()); assert.equal(f.records.get('jobQueue/fictional_job').ownerUid, 'different_owner'); assert.equal(f.records.get('jobQueue/fictional_job').status, 'RUNNING'); }
  else { await f.revoke(); assert.equal(f.records.has('jobQueue/fictional_job'), false); }
});

test('registered late child insertion conflicts with atomic empty-root deletion', async () => {
  let inserted = false; const late = `${modelPath}/revisions/late_foreign_child`;
  const f = fixture({ beforeTransactionCommit: (reads, writes, records) => {
    if (inserted || !reads.has(modelPath) || !writes.length || [...records.keys()].some(path => path.startsWith(modelPath + '/'))) return;
    inserted = true; records.set(late, { ownerUid: 'different_owner', private: 'Fictional late child' });
  } });
  await assert.rejects(f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'));
  assert.equal(inserted, true); assert.equal(f.records.has(late), true); assert.equal(f.records.has(modelPath), true);
});
test('root correction after an awaited child transaction read conflicts before destruction', async () => {
  let changed = false; const child = `${modelPath}/state/current`;
  const f = fixture({ afterTransactionRead: (path, records) => { if (path !== child || changed) return; changed = true;
    records.get(modelPath).corrected = 'Fictional corrected source';
  } });
  await assert.rejects(f.helper.deleteOwnedPrivateLifeModel(f.db, uid, 'fictional_delete'));
  assert.equal(f.records.has(child), true); assert.equal(f.records.has(modelPath), true);
});

test('existing memory.storage consent block denies private derivative export before upload', async () => {
  const f = fixture(); f.records.set('jobConsentBlocks/' + hash(uid + '\n' + 'memory.storage'), { ownerUid: uid, purpose: 'memory.storage', active: true });
  await assert.rejects(f.execute()); assert.equal(f.stats.uploads, 0);
});
test('source revoked after its earlier 400-row validation cannot return stale private bytes', async () => {
  let changed = false, sourceRead = false;
  const f = fixture({ afterTransactionRead: (path, records) => {
    if (path === sourcePath) sourceRead = true;
    if (!changed && sourceRead && path.startsWith(sourcePath + '/transcripts/') && path !== sourcePath + '/transcripts/' + hash(transcriptRef)) {
      // With over 400 original transcripts, this hook occurs after the original
      // source root was validated in the predecessor's earlier transaction.
      if (++f.extraReads >= 401) { changed = true; records.get(sourcePath).status = 'REVOKED'; }
    }
  } }); f.extraReads = 0;
  for (let index = 0; index < 501; index++) { const ref = 'private:fictional/extra-' + index;
    f.records.set(sourcePath + '/transcripts/' + hash(ref), { ...f.records.get(sourcePath + '/transcripts/' + hash(transcriptRef)), transcriptRef: ref }); }
  await assert.rejects(f.helper.exportOwnedPrivateLifeModel(f.db, uid)); assert.equal(changed, true); assert.equal(f.stats.uploads, 0);
});
for (const reason of ['block', 'source', 'job-owner', 'profile']) test(`withdrawal during awaited upload cannot publish private output receipt: ${reason}`, async () => {
  const f = fixture({ onUpload: (_call, records) => {
    if (reason === 'block') records.set('jobConsentBlocks/' + hash(uid + '\n' + 'memory.storage'), { ownerUid: uid, purpose: 'memory.storage', active: true });
    if (reason === 'source') records.get(sourcePath).status = 'REVOKED';
    if (reason === 'job-owner') records.get('jobs/fictional_job').ownerUid = 'different_owner';
    if (reason === 'profile') records.get('users/' + uid).privateBiography = 'Fictional corrected profile';
  } }); await assert.rejects(f.execute()); assert.equal(f.stats.uploads, 1); assert.equal(f.stats.cleanup.length, 1);
  assert.equal([...f.records.values()].some(record => record.event === 'DATA_RIGHTS_EXECUTION_FINISHED'), false);
});
test('consent withdrawal before terminal receipt transaction preserves failed outcome', async () => {
  let withdrawn = false;
  const f = fixture({ beforeTransactionCommit: (reads, writes, records) => {
    if (withdrawn || writes.length !== 3 || !reads.has(requestPath) || f.stats.uploads !== 1) return;
    withdrawn = true; records.set('jobConsentBlocks/' + hash(uid + '\n' + 'memory.storage'), { ownerUid: uid, purpose: 'memory.storage', active: true });
  } }); await assert.rejects(f.execute()); assert.equal(withdrawn, true); assert.equal(f.stats.cleanup.length, 1);
  assert.equal([...f.records.values()].some(record => record.event === 'DATA_RIGHTS_EXECUTION_FINISHED'), false);
});
test('a consent-withdrawn terminal export cannot replay its private object pointer', async () => {
  const f = fixture(); await f.execute(); f.records.set('jobConsentBlocks/' + hash(uid + '\n' + 'memory.storage'), { ownerUid: uid, purpose: 'memory.storage', active: true });
  await assert.rejects(f.execute()); assert.equal(f.stats.uploads, 1);
});

for (const field of ['requestedFormat', 'payloadFingerprint']) test(`terminal private export replay denies a rebound existing request payload: ${field}`, async () => {
  const f = fixture(); await f.execute(); f.records.get(requestPath)[field] = field === 'requestedFormat' ? 'csv' : 'fictional_rebound_request_payload';
  await assert.rejects(f.execute()); assert.equal(f.stats.uploads, 1);
});
for (const reason of ['request-payload', 'execution-receipt', 'request-receipt-path']) test(`terminal replay binds original approval and receipt across the admission await: ${reason}`, async () => {
  let armed = false, changed = false;
  const executionPath = requestPath + '/audit/execution-' + hash(JSON.stringify(body.idempotencyKey)).slice(0, 24);
  const f = fixture({ afterTransactionCommit: (reads, writes, records) => {
    if (!armed || changed || writes.length || !reads.has(requestPath) || !reads.has(executionPath)) return;
    changed = true;
    if (reason === 'request-payload') records.get(requestPath).note = 'Fictional replaced approval details';
    if (reason === 'execution-receipt') records.get(executionPath).requestHash = 'fictional_rebound_execution_identity';
    if (reason === 'request-receipt-path') records.get(requestPath).executionReceiptPath = requestPath + '/audit/fictional_replacement';
  } }); await f.execute(); armed = true;
  await assert.rejects(f.execute()); assert.equal(changed, true); assert.equal(f.stats.uploads, 1);
});
test('existing approved request payload withdrawn during upload cannot publish its old result', async () => {
  const f = fixture({ onUpload: (_call, records) => { records.get(requestPath).payloadFingerprint = 'fictional_rebound_request_payload'; } });
  await assert.rejects(f.execute()); assert.equal(f.stats.uploads, 1); assert.equal(f.stats.cleanup.length, 1);
  assert.equal([...f.records.values()].some(record => record.event === 'DATA_RIGHTS_EXECUTION_FINISHED'), false);
  assert.equal(f.records.get(requestPath).payloadFingerprint, 'fictional_rebound_request_payload');
  assert.equal(f.records.get(requestPath).executionState, 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS', 'stale failure does not replace rebound request progress');
});
