import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(new URL('../functions/src/privacy/dataRights.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let committed = [];
let failCommit = false;
let batches = 0;
const db = {
  collection(name) {
    assert.equal(name, 'dataRightsRequests');
    return { doc: () => ({ id: 'request-123', collection: name => {
      assert.equal(name, 'audit');
      return { doc: id => ({ id }) };
    } }) };
  },
  batch() {
    batches++;
    const writes = [];
    return {
      create(ref, record) { writes.push({ id: ref.id, record }); },
      async commit() {
        if (failCommit) throw new Error('unavailable');
        committed = writes;
      },
    };
  },
};
const exports = {};
vm.runInNewContext(code, {
  exports,
  require(name) {
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'server-time' } };
    if (name === '../core/auth.js') return { withAuthenticatedRole: (_roles, handler) => handler };
    if (name === '../core/errors.js') return { httpsError: (code, message) => Object.assign(new Error(message), { code }) };
    if (name === 'zod') return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  },
});
const submit = exports.submitDataRightsRequest;
const context = { auth: { uid: 'owner-1' } };
await submit({ requestType: 'EXPORT' }, context);
assert.equal(batches, 1);
assert.equal(committed.length, 2);
assert.equal(committed[0].record.ownerUid, 'owner-1');
assert.equal(committed[0].record.requestedFormat, 'json');
assert.equal(committed[0].record.executionState, 'HARD_OFF_PENDING_GOVERNED_WORKER');
assert.equal(committed[1].id, 'submitted');
assert.equal(committed[1].record.actorUid, 'owner-1');
committed = [];
failCommit = true;
await assert.rejects(submit({ requestType: 'DELETE' }, context), /unavailable/);
assert.equal(committed.length, 0, 'failed atomic commit must not leave a request without its audit');
failCommit = false;
await assert.rejects(submit({ requestType: 'DELETE', ownerUid: 'other-user' }, context), error => error.code === 'invalid-argument');
await assert.rejects(submit({ requestType: 'EXPORT' }, {}), error => error.code === 'unauthenticated');
assert.equal(batches, 2, 'invalid requests must not begin writes');
const indexes = JSON.parse(fs.readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8')).indexes;
assert.ok(indexes.some(index => index.collectionGroup === 'dataRightsRequests' && index.queryScope === 'COLLECTION' && JSON.stringify(index.fields) === JSON.stringify([
  { fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' },
])), 'status-filtered operator listing requires its deployed composite index');
console.log('[PASS] Data-rights atomic intake, failure propagation, authority and listing index');
