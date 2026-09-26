import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../functions/src/privacy/dataRightsRequestExport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports, Date,
  require(name) {
    if (name === 'firebase-admin/firestore') return { FieldPath: { documentId: () => '__name__' } };
    if (name === '../core/errors.js') return { httpsError: (code, message) => Object.assign(new Error(message), { code }) };
    return require(name);
  },
});
const prepare = exports.prepareDataRightsRequestExport;
const stamp = { toDate: () => new Date('2026-09-26T00:00:00Z') };
function fixture({ foreign = false, failSecondPage = false, count = 101, eventName = 'DATA_RIGHTS_REQUEST_SUBMITTED' } = {}) {
  let requestPages = 0;
  function query(documents, isRequest = false, cursor = '', limit = 100) {
    return {
      where(field, op, value) { assert.equal(field, 'ownerUid'); assert.equal(op, '=='); assert.equal(value, 'owner-1'); return this; },
      orderBy(field) { assert.equal(field, '__name__'); return this; },
      startAfter(document) { return query(documents, isRequest, document.id, limit); },
      limit(size) { return query(documents, isRequest, cursor, size); },
      async get() {
        if (isRequest && ++requestPages === 2 && failSecondPage) throw new Error('source unavailable');
        const docs = documents.filter(document => document.id > cursor).slice(0, limit);
        return { docs, size: docs.length };
      },
    };
  }
  const documents = Array.from({ length: count }, (_, i) => ({
    id: `request-${String(i).padStart(6, '0')}`,
    data: () => ({ ownerUid: foreign ? 'other-owner' : 'owner-1', requestType: 'EXPORT', requestedFormat: 'json', status: 'PENDING', note: 'private note and token', secret: 'must-not-export', payloadFingerprint: 'internal', createdAt: stamp, updatedAt: stamp }),
    ref: { collection(name) { assert.equal(name, 'audit'); return query([{ id: 'submitted', data: () => ({ event: eventName, status: 'PENDING', actorUid: 'internal-operator', secret: 'must-not-export', createdAt: stamp }) }]); } },
  }));
  return { db: { collection(name) { assert.equal(name, 'dataRightsRequests'); return query(documents, true); } }, pages: () => requestPages };
}
const f = fixture();
const output = await prepare(f.db, 'owner-1');
assert.equal(f.pages(), 2);
assert.equal(output.requestCount, 101);
assert.equal(output.auditCount, 101);
assert.equal(output.recordCount, 202);
assert.equal(output.crossSystemComplete, false);
assert.equal(output.exportDeliveryActive, false);
assert.match(output.sha256, /^[a-f0-9]{64}$/);
assert.equal(output.sha256, (await prepare(fixture().db, 'owner-1')).sha256);
const serialized = JSON.stringify(output);
for (const excluded of ['must-not-export', 'internal-operator', 'private note', 'payloadFingerprint']) assert.ok(!serialized.includes(excluded));
await assert.rejects(prepare(fixture({ foreign: true }).db, 'owner-1'), error => error.code === 'permission-denied');
await assert.rejects(prepare(fixture({ failSecondPage: true }).db, 'owner-1'), /source unavailable/);
await assert.rejects(prepare(fixture().db, ''), error => error.code === 'invalid-argument');
await assert.rejects(prepare(fixture({ count: 5001 }).db, 'owner-1'), error => error.code === 'resource-exhausted');
await assert.rejects(prepare(fixture({ eventName: 'UNREGISTERED_EVENT' }).db, 'owner-1'), error => error.code === 'failed-precondition');
console.log('[PASS] Request-record export preparation pagination, owner boundary, redaction, deterministic digest and partial-failure rejection');
