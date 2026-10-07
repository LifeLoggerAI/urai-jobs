import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const authority = require('../workers/captured-reality-worker/lifecycle-authority.js');
const attempt = { jobId: 'private_job_01', leaseToken: 'lease_01', ownerUid: 'synthetic_owner_01' };
attempt.payload = { sourceReceiptRefs: ['receipt_01'], spatialAuthorityHead: 'a'.repeat(40), reconstructionMethod: '3dgs',
  studioProjectRef: '', assetFactoryGovernanceRef: '' };
const baseJob = () => ({
  status: 'RUNNING', ownerUid: attempt.ownerUid, type: 'memory.private-source.reconstruct-place', payload: structuredClone(attempt.payload),
  consents: [{ purpose: 'memory.storage' }, { purpose: 'location.context' }],
  execution: { leaseToken: attempt.leaseToken, callbackLeaseToken: attempt.leaseToken, asyncCallbackPending: true,
    callbackTokenHash: crypto.createHash('sha256').update('synthetic_callback_01').digest('hex'),
    callbackDeadlineAt: { toMillis: () => Date.now() + 60000 } },
});
assert.deepEqual(authority.requireDispatchAuthority(baseJob(), attempt), ['memory.storage', 'location.context']);
assert.throws(() => authority.requireDispatchAuthority({ ...baseJob(), ownerUid: 'another_owner' }, attempt), /owner mismatch/);
assert.throws(() => authority.requireDispatchAuthority({ ...baseJob(), consents: [{ purpose: 'memory.storage' }] }, attempt), /required consent/);
assert.throws(() => authority.requireDispatchAuthority({ ...baseJob(), status: 'CANCELLED' }, attempt), /stale job/);
assert.throws(() => authority.requireDispatchAuthority({ ...baseJob(), execution: { leaseToken: 'new_lease' } }, attempt), /stale job/);
assert.throws(() => authority.requireDispatchAuthority({ ...baseJob(), payload: { ...attempt.payload, spatialAuthorityHead: 'f'.repeat(40) } }, attempt), /stored payload mismatch/);
authority.requireCallbackLease(baseJob());
assert.throws(() => authority.requireCallbackLease({ execution: { leaseToken: 'new_lease', callbackLeaseToken: 'lease_01' } }), /stale callback lease/);
assert.throws(() => authority.requireCallbackLease({ execution: { leaseToken: 'lease_01' } }), /stale callback lease/);

// Execute the actual HTTP handlers with synthetic Firestore/transport boundaries.
// A denied attempt must never authorize a source or reach the reconstruction engine.
async function exercise({ job = baseJob(), blocked = false, revokeAfterAuthorize = false, callback = false } = {}) {
  const routes = new Map(), writes = [], calls = [];
  let authorized = false;
  const db = {
    collection: (collection) => ({ doc: (id) => ({ collection, id, update: async (value) => writes.push(value) }) }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.collection === 'jobs'
        ? { exists: true, data: () => job }
        : { exists: blocked || (revokeAfterAuthorize && authorized), data: () => ({ active: true }) },
      update: (_ref, value) => writes.push(value), set: (_ref, value) => writes.push(value),
    }),
  };
  const app = { use() {}, get() {}, post(path, ...handlers) { routes.set(path, handlers.at(-1)); }, listen() {} };
  const express = () => app; express.json = () => () => {};
  const FieldValue = { serverTimestamp: () => 'time', delete: () => 'deleted' };
  const admin = { apps: [{}], firestore: Object.assign(() => db, { FieldValue, Timestamp: { fromMillis: (n) => ({ toMillis: () => n, toDate: () => new Date(n) }) } }) };
  const context = {
    require: (name) => name === 'express' ? express : name === 'firebase-admin' ? admin
      : name === 'express-rate-limit' ? { rateLimit: () => () => {}, ipKeyGenerator: (x) => x }
      : name === './lifecycle-authority' ? authority : require(name),
    process: { env: { URAI_ENV: 'test', PRIVATE_SOURCE_AUTHORITY_URL: 'https://authority.invalid', PRIVATE_SOURCE_AUTHORITY_TOKEN: 'synthetic',
      CAPTURED_REALITY_ENGINE_URL: 'https://engine.invalid', CAPTURED_REALITY_ENGINE_TOKEN: 'synthetic', CAPTURED_REALITY_WORKER_PUBLIC_URL: 'https://worker.invalid' } },
    URL, Date, console: { log() {}, error() {} },
    fetch: async (url) => {
      calls.push(url);
      if (url.includes('/authorize')) { authorized = true; return { status: 200, json: async () => ({ authorized: true, sourceHandle: 'opaque_handle_01' }) }; }
      return { ok: true, json: async () => ({ accepted: true }) };
    },
  };
  vm.runInNewContext(fs.readFileSync('workers/captured-reality-worker/index.js', 'utf8'), context);
  let status, body;
  const res = { status(value) { status = value; return this; }, send(value) { body = value; return this; } };
  const req = { body: callback ? { jobId: attempt.jobId, status: 'failed' } : { ...attempt, jobType: 'memory.private-source.reconstruct-place',
    payload: { sourceReceiptRefs: ['receipt_01'], spatialAuthorityHead: 'a'.repeat(40), reconstructionMethod: '3dgs', providerSpendAuthorized: false, publicReleaseAuthorized: false } },
    query: { callbackToken: 'synthetic_callback_01' }, get: () => '' };
  await routes.get(callback ? '/engine-callback' : '/execute-job')(req, res);
  return { status, body, writes, calls };
}

for (const options of [
  { job: { ...baseJob(), ownerUid: 'another_owner' } },
  { job: { ...baseJob(), consents: [{ purpose: 'memory.storage' }] } },
  { job: { ...baseJob(), payload: { ...attempt.payload, sourceReceiptRefs: ['unrelated_receipt_01'] } } },
  { blocked: true },
]) {
  const result = await exercise(options);
  assert.equal(result.status, 502);
  assert.equal(result.calls.length, 0, 'denied attempts cannot authorize private source bytes');
  assert.equal(result.writes.length, 0);
}
const raced = await exercise({ revokeAfterAuthorize: true });
assert.equal(raced.status, 502);
assert.equal(raced.calls.filter((url) => url.includes('/reconstruct')).length, 0);
assert.equal(raced.writes.length, 0, 'a revocation race cannot register callback authority');
const stale = baseJob(); stale.execution.leaseToken = 'new_lease';
const rejectedCallback = await exercise({ job: stale, callback: true });
assert.equal(rejectedCallback.status, 403);
assert.equal(rejectedCallback.writes.length, 0, 'a stale callback cannot terminalize a successor attempt');
const valid = await exercise();
assert.equal(valid.status, 202);
assert.equal(valid.calls.filter((url) => url.includes('/reconstruct')).length, 1);
console.log('[PASS] captured reality lifecycle authority: owner/dual-consent/revocation race/stale callback/valid dispatch');
