import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync('functions/src/privacy/capturedRealityDerivativeRevocation.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const event = { eventId: 'synthetic_paged_event_01', ownerUid: 'synthetic_owner', purpose: 'memory.storage', revokedAt: '2026-10-07T00:00:00.000Z' };
const progressPath = 'jobConsentEventReceipts/' + createHash('sha256').update(event.eventId).digest('hex');
const DELETE = Symbol('delete');
const jobPath = index => 'jobs/synthetic_job_' + String(index).padStart(5, '0');

function fixture(count, hooks = {}) {
  const records = new Map(), calls = [], writes = [], pages = [];
  records.set(progressPath, { ...event, status: 'blocked' });
  for (let index = 0; index < count; index++) records.set(jobPath(index), { ownerUid: event.ownerUid,
    jobType: 'memory.private-source.reconstruct-place', status: 'SUCCESS', output: { runtime: 'synthetic_opaque_artifact' } });
  records.set('jobs/synthetic_other_owner', { ownerUid: 'foreign_owner', jobType: 'memory.private-source.reconstruct-place', status: 'SUCCESS' });
  records.set('jobs/synthetic_unrelated_type', { ownerUid: event.ownerUid, jobType: 'unrelated.synthetic.job', status: 'SUCCESS' });
  const apply = (target, patch) => {
    const record = { ...records.get(target.path) };
    for (const [key, value] of Object.entries(patch)) { if (value === DELETE) delete record[key]; else record[key] = value; }
    records.set(target.path, record); writes.push(target.path);
  };
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path),
    set: async patch => apply(ref(path), patch), update: async patch => apply(ref(path), patch) });
  const snapshot = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: records.has(path),
    data: () => structuredClone(records.get(path)), get: key => records.get(path)?.[key] });
  const db = { collection: name => ({ doc: id => ref(name + '/' + id), where: (field, operator, value) => {
    let limit, after = '';
    return { orderBy() { return this; }, limit(n) { limit = n; return this; },
      startAfter(cursor) { after = typeof cursor === 'string' ? cursor : cursor.id; return this; },
      async get() {
        assert.equal(operator, '==');
        const docs = [...records].filter(([path, data]) => path.startsWith(name + '/') && data[field] === value
          && path.split('/').at(-1) > after).sort(([a],[b]) => a.localeCompare(b)).slice(0, limit).map(([path]) => snapshot(path));
        if (name === 'jobs') { pages.push(docs.length); assert.ok(docs.length <= 100); }
        return { docs, size: docs.length };
      } };
  } }), async runTransaction(fn) {
    await hooks.beforeTransaction?.({ records, calls });
    const pending = [];
    const result = await fn({ get: target => target.get(), update: (target, patch) => pending.push([target,patch]),
      set: (target, patch) => pending.push([target,patch]) });
    pending.forEach(([target,patch]) => apply(target,patch)); return result;
  } };
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: { CAPTURED_REALITY_ENGINE_URL: 'https://synthetic-engine.invalid', CAPTURED_REALITY_ENGINE_TOKEN: 'synthetic-token' } },
    URL, AbortSignal, setTimeout, Date: hooks.clock ? { now: hooks.clock } : Date,
    require: name => name === 'firebase-admin/firestore' ? { getFirestore: () => db, FieldPath: { documentId: () => '__name__' },
      FieldValue: { delete: () => DELETE, serverTimestamp: () => 'synthetic_time' } }
      : name === 'firebase-admin/storage' ? { getStorage: () => { throw new Error('unexpected_private_storage'); } } : require(name),
    fetch: async (_url, options) => {
      const id = JSON.parse(options.body).jobId; calls.push(id);
      await hooks.beforeEngineResponse?.({ records, calls, id });
      const ok = id !== hooks.failId;
      return { ok, status: ok ? 200 : 503, json: async () => ({ ok, artifactsDeleted: ok }) };
    },
  });
  return { run: input => exports.invalidateCapturedRealityDerivativesForConsent(input || event), records, calls, writes, pages };
}

{
  const f = fixture(2203);
  await assert.rejects(f.run(), /continuation_pending/);
  assert.equal(f.records.get(progressPath).capturedRealityCleanupCursor, 'synthetic_job_00999');
  assert.equal(f.records.get(progressPath).capturedRealityCleanupState, 'PENDING');
  assert.equal(f.calls.length, 1000);
  await assert.rejects(f.run(), /continuation_pending/);
  assert.equal(f.records.get(progressPath).capturedRealityCleanupCursor, 'synthetic_job_01999');
  assert.equal((await f.run()).engineDeletionsAcknowledged, 203);
  assert.equal(f.records.get(progressPath).capturedRealityCleanupState, 'COMPLETE');
  assert.equal(f.records.get(progressPath).capturedRealityCleanupCursor, undefined);
  assert.equal(f.calls.length, 2203); assert.equal(new Set(f.calls).size, 2203);
  assert.equal(f.records.get('jobs/synthetic_other_owner').status, 'SUCCESS');
  assert.equal(f.records.get('jobs/synthetic_unrelated_type').status, 'SUCCESS');
  assert.equal(f.writes.some(path => /other_owner|unrelated_type/.test(path)), false);
  console.log('[PASS] actual revocation helper completes 2203 jobs over bounded durable continuations, preserving foreign ownership and unrelated type');
}
{
  const hooks = { failId: 'synthetic_job_00150' }, f = fixture(203, hooks);
  await assert.rejects(f.run(), /not_acknowledged/);
  assert.equal(f.records.get(progressPath).capturedRealityCleanupCursor, 'synthetic_job_00099');
  assert.equal(f.records.get(jobPath(150)).derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_PENDING');
  hooks.failId = undefined; assert.equal((await f.run()).engineDeletionsAcknowledged, 53);
  assert.equal(f.calls.length, 204); assert.equal(f.calls.filter(id => id === 'synthetic_job_00149').length, 1);
  console.log('[PASS] middle-page engine failure retains previous cursor and exact pending job for retry');
}
{
  let corrected = false;
  const f = fixture(1, { beforeEngineResponse({ records, id }) { if (!corrected) { corrected = true;
    const record = records.get('jobs/' + id); records.set('jobs/' + id, { ...record, status: 'SUCCESS', output: { runtime: 'synthetic_correction' } }); } } });
  await assert.rejects(f.run(), /cleanup_job_changed/);
  assert.notEqual(f.records.get(jobPath(0)).derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_COMPLETE');
  assert.equal((await f.run()).engineDeletionsAcknowledged, 1);
  assert.equal(f.records.get(jobPath(0)).output, undefined);
  console.log('[PASS] correction during engine cleanup cannot receive a stale deletion certificate and retries current job authority');
}
{
  let moved = false;
  const f = fixture(1, { beforeTransaction({ records }) { if (!moved) { moved = true; records.get(jobPath(0)).ownerUid = 'foreign_owner'; } } });
  await assert.rejects(f.run(), /owner_mismatch/); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
  console.log('[PASS] owner reassignment between query and cancellation fails before any job or queue mutation');
}
{
  const f = fixture(1); assert.equal((await f.run({ ...event, purpose: 'unrelated.synthetic.purpose' })).jobsInvalidated, 0);
  assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
  f.records.get(progressPath).ownerUid = 'foreign_owner';
  await assert.rejects(f.run(), /event_authority_invalid/); assert.equal(f.writes.length, 0);
  console.log('[PASS] unrelated purposes and mismatched canonical event ownership confer no cleanup authority');
}
{
  let time = 0; const hooks = { clock: () => time, beforeEngineResponse() { time = 41000; } }, f = fixture(2,hooks);
  await assert.rejects(f.run(), /continuation_pending/); assert.equal(f.calls.length, 1);
  assert.equal(f.records.get(jobPath(0)).derivativeAccessState, 'REVOKED_ENGINE_CLEANUP_COMPLETE');
  time = 0; hooks.beforeEngineResponse = undefined;
  assert.equal((await f.run()).engineDeletionsAcknowledged, 1); assert.equal(f.calls.length, 2);
  console.log('[PASS] elapsed invocation budget leaves durable completed identities and resumes unfinished page');
}
console.log('URAI_CR_REVOCATION_PAGING_SYNTHETIC_VALIDATION: complete; no private engine, Storage or global erasure certificate');
