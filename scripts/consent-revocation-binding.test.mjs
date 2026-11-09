import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../functions/package.json', import.meta.url)), ts = require('typescript');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const event = { type: 'consent.revoked.v1', eventId: 'fictional_revocation_01', ownerUid: 'fictional_owner', purpose: 'memory.storage',
  policyVersion: 'fictional-policy', decisionReceiptId: 'fictional-decision', correlationId: 'fictional-correlation', revokedAt: '2026-01-01T00:00:00.000Z' };
const receiptPath = 'jobConsentEventReceipts/' + hash(event.eventId);
const blockPath = 'jobConsentBlocks/' + hash(event.ownerUid + String.fromCharCode(10) + event.purpose);
const clone = value => value === undefined ? undefined : structuredClone(value);

function fixture(options = {}) {
  const records = new Map(), calls = [], logs = [], modules = new Map();
  let transactionCount = 0, serial = Promise.resolve();
  const ref = path => ({ path, get: async () => snap(path),
    set: async (value, settings) => records.set(path, { ...(settings?.merge ? records.get(path) : {}), ...clone(value) }) });
  const snap = path => ({ exists: records.has(path), data: () => clone(records.get(path)), ref: ref(path) });
  const db = { collection: name => ({ doc: id => ref(name + '/' + id) }), runTransaction: async callback => {
    const operation = serial.then(async () => {
      transactionCount++;
      if (options.failTransaction) throw new Error('PRIVATE database error fictional_owner private:path payload');
      const writes = [], tx = {
        get: async reference => { assert.equal(writes.length, 0); return snap(reference.path); },
        set: (reference, value, settings) => writes.push(() => reference.set(value, settings)),
        create: (reference, value) => writes.push(() => { assert.equal(records.has(reference.path), false); return reference.set(value); }),
      };
      const result = await callback(tx);
      for (const write of writes) await write();
      return result;
    });
    serial = operation.catch(() => {});
    return operation;
  } };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const exports = {}; modules.set(path, exports);
    const source = fs.readFileSync(new URL('../functions/src/' + path + '.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, process: { env: {} }, console: { error: (...args) => logs.push(args) }, require(name) {
      if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'fictional-time' } };
      if (name === 'firebase-functions/params') return { defineSecret: () => ({ value: () => options.noToken ? '' : 'fictional-secret' }) };
      if (name === 'firebase-functions/v2/https') return { onRequest: (_settings, handler) => handler };
      if (name === './consentBlocks.js') return load('privacy/consentBlocks');
      const phases = {
        './lifeMovieDerivativeRevocation.js': ['invalidateLifeMovieDerivativesForConsent', 'movie'],
        './capturedRealityDerivativeRevocation.js': ['invalidateCapturedRealityDerivativesForConsent', 'reality'],
        './privateLifeModelDataRights.js': ['invalidatePrivateLifeModelForConsent', 'private'],
      };
      if (phases[name]) {
        const [exportName, phase] = phases[name];
        return { [exportName]: async incoming => {
          assert.equal(records.get(blockPath)?.active, true, 'canonical block must precede derivative work');
          calls.push({ phase, event: clone(incoming) });
          await options.onPhase?.(phase, records, calls);
          return { phase, fictional: true };
        } };
      }
      if (name === 'zod' || name === 'node:crypto') return require(name);
      throw new Error('Unexpected consent binding dependency: ' + name);
    } });
    return exports;
  }
  const handler = load('privacy/consentRevocation').ingestConsentRevocation;
  return { records, calls, logs, blocks: load('privacy/consentBlocks'), get transactionCount() { return transactionCount; },
    execute: async (body = event, request = {}) => {
      const response = { statusCode: null, body: null, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } };
      await handler({ method: 'POST', headers: { authorization: 'Bearer fictional-secret' }, body: clone(body), ...request }, response);
      return response;
    } };
}

test('method, secret and schema gates reject before a canonical mutation or derivative call', async () => {
  const f = fixture();
  assert.equal((await f.execute(event, { method: 'GET' })).statusCode, 405);
  assert.equal((await f.execute(event, { headers: { authorization: 'Bearer incorrect' } })).statusCode, 401);
  assert.equal((await fixture({ noToken: true }).execute()).statusCode, 401);
  assert.equal((await f.execute({ ...event, arbitrary: 'field' })).statusCode, 400);
  assert.equal(f.transactionCount, 0); assert.equal(f.calls.length, 0); assert.equal(f.records.size, 0);
});
test('new authenticated event durably binds every authority field before propagating exact interfaces', async () => {
  const f = fixture(), out = await f.execute();
  assert.equal(out.statusCode, 200);
  const receipt = f.records.get(receiptPath);
  assert.equal(receipt.revokedAt, event.revokedAt);
  assert.equal(receipt.eventBindingVersion, 'urai-jobs-consent-event-binding-v1');
  assert.match(receipt.eventBindingHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.integrityHash, f.blocks.canonicalConsentAckHash(receipt));
  assert.equal(f.calls.length, 3);
  for (const call of f.calls) assert.deepEqual(call.event, { eventId: event.eventId, ownerUid: event.ownerUid, purpose: event.purpose, revokedAt: event.revokedAt });
});
test('same bound event retries derivative propagation without creating a new receipt', async () => {
  const f = fixture();
  assert.equal((await f.execute()).statusCode, 200); assert.equal((await f.execute()).statusCode, 200);
  assert.equal(f.records.size, 2); assert.equal(f.calls.length, 6);
});
for (const patch of [
  { ownerUid: 'different_owner' }, { purpose: 'location.context' }, { policyVersion: 'different-policy' },
  { decisionReceiptId: 'different-decision' }, { correlationId: 'different-correlation' }, { revokedAt: '2026-02-02T00:00:00.000Z' },
]) {
  test('event ID collision rejects altered ' + Object.keys(patch)[0] + ' without propagation', async () => {
    const f = fixture(); await f.execute();
    const previous = clone(f.records.get(receiptPath));
    const out = await f.execute({ ...event, ...patch });
    assert.equal(out.statusCode, 409); assert.equal(out.body.error, 'event-id-conflict');
    assert.equal(f.calls.length, 3); assert.equal(f.records.size, 2); assert.deepEqual(f.records.get(receiptPath), previous);
  });
}
test('tampered receipt bindings, consumer, status and integrity require reconciliation', async () => {
  for (const patch of [
    { eventBindingHash: 'a'.repeat(64) }, { eventBindingVersion: 'other-version' },
    { integrityHash: 'b'.repeat(64) }, { consumerId: 'other-consumer' }, { status: 'allowed' },
  ]) {
    const f = fixture(); await f.execute();
    Object.assign(f.records.get(receiptPath), patch);
    assert.equal((await f.execute()).statusCode, 409); assert.equal(f.calls.length, 3);
  }
});
test('legacy unbound event receipts cannot be promoted to current authority', async () => {
  const f = fixture(); await f.execute();
  for (const key of ['eventBindingVersion', 'eventBindingHash', 'revokedAt']) delete f.records.get(receiptPath)[key];
  assert.equal((await f.execute()).statusCode, 409);
  assert.equal(f.calls.length, 3); assert.equal(f.records.get(receiptPath).eventBindingVersion, undefined);
});
test('replayed event requires its canonical owner/purpose block still active and intact', async () => {
  for (const patch of [null, { active: false }, { ownerUid: 'different_owner' }, { purpose: 'location.context' }, { integrityHash: 'a'.repeat(64) }]) {
    const f = fixture(); await f.execute();
    if (patch) Object.assign(f.records.get(blockPath), patch); else f.records.delete(blockPath);
    assert.equal((await f.execute()).statusCode, 409); assert.equal(f.calls.length, 3);
  }
});
test('bound replay preserves a later legitimate block for the same owner and purpose', async () => {
  const f = fixture(); await f.execute();
  const newer = { ...event, eventId: 'fictional_revocation_02', policyVersion: 'newer-policy', decisionReceiptId: 'newer-decision' };
  assert.equal((await f.execute(newer)).statusCode, 200); assert.equal((await f.execute()).statusCode, 200);
  assert.equal(f.records.get(blockPath).eventId, newer.eventId); assert.equal(f.calls.length, 9);
});
test('transient cleanup failure retains the bound block and retries without leaking private errors', async () => {
  let fail = true;
  const f = fixture({ onPhase: async phase => {
    if (phase === 'movie' && fail) { fail = false; throw new Error('PRIVATE storage error fictional_owner private:path payload'); }
  } });
  const first = await f.execute();
  assert.equal(first.statusCode, 500); assert.equal(first.body.error, 'derivative-invalidation-failed');
  assert.equal(f.records.get(blockPath).active, true);
  assert.equal(JSON.stringify(f.logs).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(f.logs).includes('fictional_owner'), false);
  assert.equal((await f.execute()).statusCode, 200); assert.equal(f.calls.length, 4);
});
test('database admission failure returns a fixed response without derivative propagation or private error text', async () => {
  const f = fixture({ failTransaction: true }), out = await f.execute();
  assert.equal(out.statusCode, 500); assert.equal(out.body.error, 'consent-admission-failed');
  assert.equal(f.calls.length, 0); assert.equal(JSON.stringify(f.logs).includes('PRIVATE'), false);
});
test('canonical block changes between phases stop propagation and success acknowledgement', async () => {
  const f = fixture({ onPhase: async (phase, records) => { if (phase === 'movie') records.get(blockPath).active = false; } });
  assert.equal((await f.execute()).statusCode, 409); assert.equal(f.calls.length, 1);
  assert.equal(f.records.get(receiptPath).derivativeInvalidationCompletedAt, undefined);
});
test('acknowledgement projects bound fields rather than arbitrary stored receipt content', async () => {
  const f = fixture(); await f.execute(); f.records.get(receiptPath).privatePayload = 'PRIVATE arbitrary stored source';
  const out = await f.execute();
  assert.equal(out.statusCode, 200); assert.equal(JSON.stringify(out.body).includes('PRIVATE'), false);
});
test('concurrent exact deliveries retain one immutable receipt and block', async () => {
  const f = fixture(), outputs = await Promise.all([f.execute(), f.execute()]);
  assert.ok(outputs.every(out => out.statusCode === 200)); assert.equal(f.records.size, 2); assert.equal(f.calls.length, 6);
});
