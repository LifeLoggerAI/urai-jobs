const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8');

function harness() {
  const routes = new Map(), before = [], after = [];
  const app = {
    use(fn) { (fn.length === 3 ? before : after).push(fn); },
    get(route, ...fns) { routes.set('GET ' + route, fns); },
    post(route, ...fns) { routes.set('POST ' + route, fns); },
    listen() {},
  };
  const express = () => app;
  express.json = () => (_req, _res, next) => next();
  const loaded = { 'node:crypto': crypto, express,
  'express-rate-limit': { rateLimit: () => (_req, _res, next) => next() },
    './protected-source-provider': { registerProtectedSourceRoutes() {} },
    './contracts.js': require(path.join(__dirname, '../dist/contracts.js')),
    'firebase-admin/app': { getApps: () => [1], initializeApp() {}, applicationDefault() {} },
    'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'synthetic-only' }, getFirestore() { throw new Error('unexpected Firestore call'); } },
  };
  const context = { exports: {}, require(name) { assert.ok(Object.hasOwn(loaded, name), 'unexpected module: ' + name); return loaded[name]; },
    process: { env: { URAI_ENV: 'production', PRIVATE_SOURCE_INDEX_TOKEN: 'synthetic-cache-test-token' } }, Buffer, URL, AbortSignal,
    setTimeout, clearTimeout, console: { log() {}, error() {} }, fetch() { throw new Error('unexpected network/provider call'); } };
  vm.runInNewContext(source, context, { filename: 'compiled-production-index.js' });
  async function invoke(method, route, body, authorization = 'Bearer synthetic-cache-test-token') {
    const result = { headers: {}, status: 0, value: null }, res = {
      set(name, value) { result.headers[name.toLowerCase()] = value; return res; },
      status(value) { result.status = value; return res; },
      send(value) { result.value = JSON.parse(JSON.stringify(value)); return res; },
    };
    const req = { method, body, get(name) { return name.toLowerCase() === 'authorization' ? authorization : ''; } };
    const fns = [...before, ...(routes.get(method + ' ' + route) || after)];
    for (const fn of fns) {
      let advanced = false;
      await fn(req, res, () => { advanced = true; });
      if (result.value !== null || !advanced) break;
    }
    return result;
  }
  return { invoke };
}
const input = () => ({
  ownerUid: 'synthetic-owner', jobId: 'synthetic-job-0001', leaseToken: 'synthetic-lease-0001',
  sourceReceiptRef: 'psr_synthetic_receipt_000001', sourceSha256: 'a'.repeat(64), sourceFixityRef: 'private:synthetic/fixity',
  sourceByteLength: 10, sourceRevision: 1, sourceHandle: 'psh_synthetic_handle_000001', sourceEvidenceClass: 'DIRECT_SUBJECT_TESTIMONY',
  transcriptRef: 'private:synthetic/transcript', provenanceRef: 'private:synthetic/provenance', requestedPurpose: 'memory-index',
  correlationTrigger: 'initial-source', idempotencyKey: 'synthetic-job-0001',
});
for (const [name, method, route, body, auth, status] of [
  ['authorization denial retains no private cache', 'POST', '/', input(), 'Bearer invalid-synthetic-token', 401],
  ['invalid private request retains no private cache', 'POST', '/', {}, undefined, 502],
  ['hard-off private index readiness retains no private cache', 'POST', '/', input(), undefined, 503],
  ['health response keeps no-store', 'GET', '/healthz', undefined, undefined, 200],
  ['unknown route does not permit response caching', 'POST', '/unknown-private-route', {}, undefined, 404],
]) test(name, async () => {
  const result = await harness().invoke(method, route, body, auth);
  assert.equal(result.status, status);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.value.memoryIndexRef, undefined);
});
