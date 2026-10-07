import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync('functions/src/privacy/capturedRealityDerivativeRevocation.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ responseOk = true, missingConfig = false, foreignOwner = false, alreadyComplete = false } = {}) {
  const exports = {}, writes = [], calls = [];
  const job = { ownerUid: foreignOwner ? 'other_owner' : 'synthetic_owner', type: 'memory.private-source.reconstruct-place', status: 'SUCCESS',
    result: { runtime: { ref: 'cr-artifact:opaque-runtime' } }, output: { runtime: { ref: 'cr-artifact:opaque-runtime' } },
    derivativeAccessState: alreadyComplete ? 'REVOKED_ENGINE_CLEANUP_COMPLETE' : undefined };
  const snapshot = { id: 'synthetic_job_01', exists: true, get: key => job[key], data: () => job, ref: { update: async (patch) => { writes.push(patch); Object.assign(job, patch); } } };
  const db = { collection: (name) => ({ where: () => ({ orderBy() { return this; }, limit: () => ({ get: async () => ['capturedRealityRuntimeAdmissions', 'capturedRealityRuntimeCleanup'].includes(name) ? ({ size: 0, docs: [] }) : ({ size: 1, docs: [snapshot] }) }) }), doc: (id) => ({ name, id, get: async () => ({ exists: true, data: () => ({ eventId: 'synthetic_event_01', ownerUid: 'synthetic_owner', purpose: 'memory.storage', status: 'blocked' }) }), set: async () => {} }) }),
    runTransaction: async fn => { const pending = []; const result = await fn({ get: async () => snapshot, update: (_ref, patch) => pending.push(patch), set: () => {} }); pending.forEach(patch => { writes.push(patch); Object.assign(job, patch); }); return result; },
    batch: () => { const pending = []; return { update: (_ref, patch) => pending.push(patch), set: (_ref, patch) => pending.push(patch), commit: async () => { pending.forEach((patch) => { writes.push(patch); Object.assign(job, patch); }); } }; } };
  vm.runInNewContext(compiled, { exports, process: { env: missingConfig ? {} : { CAPTURED_REALITY_ENGINE_URL: 'https://engine.invalid', CAPTURED_REALITY_ENGINE_TOKEN: 'synthetic-token' } }, URL, AbortSignal, setTimeout,
    require: (name) => name === 'firebase-admin/firestore' ? { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { delete: () => undefined, serverTimestamp: () => 'server-time' } } : name === 'firebase-admin/storage' ? { getStorage: () => ({ bucket: () => ({ file: () => ({ delete: async () => {} }) }) }) } : require(name),
    fetch: async (url, options) => { calls.push({ url, body: options.body }); return { ok: responseOk, status: responseOk ? 200 : 503, json: async () => ({ ok: responseOk, artifactsDeleted: responseOk }) }; },
  });
  return { exports, writes, calls, job };
}
const event = { eventId: 'synthetic_event_01', ownerUid: 'synthetic_owner', purpose: 'memory.storage', revokedAt: new Date().toISOString() };
const valid = fixture(); const summary = await valid.exports.invalidateCapturedRealityDerivativesForConsent(event);
assert.equal(summary.engineDeletionsAcknowledged, 1); assert.equal(valid.job.derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_COMPLETE');
assert.equal(valid.job.output, undefined); assert.equal(valid.job.result, undefined); assert.equal(valid.job.status, 'CANCELLED');
assert.equal(valid.calls.length, 1); assert.equal(JSON.parse(valid.calls[0].body).jobId, 'synthetic_job_01');
assert.equal(valid.writes[0]['execution.asyncCallbackPending'], false);
assert.equal(valid.writes[0]['execution.callbackLeaseToken'], undefined);
const denied = fixture({ responseOk: false }); await assert.rejects(denied.exports.invalidateCapturedRealityDerivativesForConsent(event), /not_acknowledged/);
assert.equal(denied.job.derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_PENDING', 'an engine failure cannot produce a complete deletion ack');
const missing = fixture({ missingConfig: true }); await assert.rejects(missing.exports.invalidateCapturedRealityDerivativesForConsent(event), /unconfigured/);
assert.equal(missing.calls.length, 0); assert.equal(missing.job.derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_PENDING');
const foreign = fixture({ foreignOwner: true }); await assert.rejects(foreign.exports.invalidateCapturedRealityDerivativesForConsent(event), /owner_mismatch/); assert.equal(foreign.writes.length, 0);
const repeated = fixture({ alreadyComplete: true }); await repeated.exports.invalidateCapturedRealityDerivativesForConsent(event); assert.equal(repeated.calls.length, 0);
const unrelated = fixture(); await unrelated.exports.invalidateCapturedRealityDerivativesForConsent({ ...event, purpose: 'unrelated-purpose' }); assert.equal(unrelated.writes.length, 0);
const consent = fs.readFileSync('functions/src/privacy/consentRevocation.ts', 'utf8');
assert.ok(consent.includes('await invalidateCapturedRealityDerivativesForConsent(lifeMovieRevocationEvent)'));
assert.ok(consent.includes('capturedRealityInvalidation,'));
const rights = fs.readFileSync('functions/src/privacy/dataRightsExecution.ts', 'utf8');
assert.ok(rights.includes('await deleteCapturedRealityPublishedRuntimeForOwner(ownerUid)'));
assert.ok(rights.includes('await deleteCapturedRealityEngineJob(document.id)'));
assert.ok(rights.includes('result: FieldValue.delete()'));
assert.ok(rights.indexOf('await deleteCapturedRealityEngineJob(document.id)') < rights.indexOf('ownerUid: `deleted:${ownerHash}`'));

// Exercise the existing governed executor with a failed engine cleanup, then a
// retry on the same approved request/idempotency identity. A failed attempt must
// remain discoverable and may never masquerade as a completed replay.
const requestRecords = new Map(), requestId = 'synthetic_rights_01', ownerUid = 'synthetic_owner';
requestRecords.set(`dataRightsRequests/${requestId}`, { ownerUid, requestType: 'DELETE', status: 'APPROVED' });
let engineCalls = 0, failEngineOnce = true;
const jobRecord = { ownerUid, status: 'RUNNING', type: 'memory.private-source.reconstruct-place', result: { runtime: 'opaque' }, output: { runtime: 'opaque' } };
const jobRef = { id: 'synthetic_job_01', path: 'jobs/synthetic_job_01', update: async (patch) => Object.assign(jobRecord, patch), collection: () => ({ limit: () => ({ get: async () => ({ size: 0, docs: [] }) }) }) };
function ref(path) { return { path, get: async () => ({ exists: requestRecords.has(path), data: () => requestRecords.get(path) }),
  set: async (record) => requestRecords.set(path, { ...requestRecords.get(path), ...record }), collection: (name) => ({ doc: (id) => ref(`${path}/${name}/${id}`) }) }; }
const db = {
  collection: (name) => ({ doc: (id) => ref(`${name}/${id}`), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ size: jobRecord.ownerUid === ownerUid ? 1 : 0,
    docs: jobRecord.ownerUid === ownerUid ? [{ id: jobRef.id, ref: jobRef, data: () => jobRecord }] : [] }) }) }) }) }),
  runTransaction: async (fn) => {
    const writes = [], result = await fn({ get: (target) => target.get(), create: (target, record) => writes.push([target, record]), set: (target, record) => writes.push([target, record]) });
    for (const [target, record] of writes) await target.set(record); return result;
  },
  batch: () => ({ delete() {}, set(target, patch) { if (target === jobRef) Object.assign(jobRecord, patch); }, commit: async () => {} }),
};
const rightsExports = {};
vm.runInNewContext(ts.transpileModule(rights, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: rightsExports, process: { env: { URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE: 'protected-staging', GCLOUD_PROJECT: 'demo-private-staging', URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT: 'demo-private-staging' } }, Buffer,
  require: (name) => name === 'firebase-admin/firestore' ? { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { delete: () => 'deleted', serverTimestamp: () => 'time' } }
    : name === '../core/auth.js' ? { withAuthenticatedRole: (_roles, handler) => handler }
    : name === '../core/errors.js' ? { httpsError: (code, message) => Object.assign(new Error(message), { code }) }
    : name === '../core/gcs.js' ? { uploadToGcs: async () => 'opaque-private-export' }
    : name === './privateLifeModelDataRights.js' ? { assertPrivateDataRightsExportDestination: async () => {}, deleteOwnedPrivateLifeModel: async () => ({ unresolvedDomains: [] }), exportOwnedPrivateLifeModel: async () => ({ records: [], unresolvedDomains: [] }) }
    : name === './capturedRealityDerivativeRevocation.js' ? { deleteCapturedRealityEngineJob: async () => { engineCalls++; if (failEngineOnce) { failEngineOnce = false; throw new Error('synthetic-engine-unavailable'); } }, deleteCapturedRealityPublishedRuntimeForOwner: async () => ({ publishedRuntimeDeletionsAcknowledged: 0 }) }
    : require(name),
});
const request = { requestId, retentionDecisionReceiptId: 'synthetic_retention_01', idempotencyKey: 'synthetic_idempotency_01' };
await assert.rejects(rightsExports.processDataRightsRequest(request, {}), /synthetic-engine-unavailable/);
assert.equal(jobRecord.ownerUid, ownerUid, 'failed engine deletion must retain discoverable owner scope');
assert.equal(jobRecord.status, 'CANCELLED');
assert.equal(requestRecords.get(`dataRightsRequests/${requestId}`).executionState, 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE');
const retried = await rightsExports.processDataRightsRequest(request, {});
assert.equal(retried.replay, false); assert.equal(engineCalls, 2); assert.equal(jobRecord.result, 'deleted');
assert.ok(jobRecord.ownerUid.startsWith('deleted:')); assert.equal((await rightsExports.processDataRightsRequest(request, {})).replay, true); assert.equal(engineCalls, 2);
const executionPath = [...requestRecords.keys()].find((key) => key.includes('/audit/execution-'));
requestRecords.set(executionPath, { event: 'DATA_RIGHTS_EXECUTION_FAILED', attemptNumber: 3 });
requestRecords.set(`dataRightsRequests/${requestId}`, { ownerUid, requestType: 'DELETE', status: 'IN_REVIEW', executionState: 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE' });
await assert.rejects(rightsExports.processDataRightsRequest(request, {}), (error) => error.code === 'resource-exhausted');
requestRecords.set(executionPath, { event: 'DATA_RIGHTS_EXECUTION_STARTED', attemptNumber: 1 });
await assert.rejects(rightsExports.processDataRightsRequest(request, {}), /already active/);
console.log('[PASS] captured reality data rights: cancel/scrub/delete acknowledgement, failed cleanup pending, owner isolation and replay; protected runtime not certified');

