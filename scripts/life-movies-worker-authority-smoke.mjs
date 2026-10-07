// Execute the real registered worker guard. All authority reads use explicit
// in-memory adapters; no private memory, provider or cloud acceptance is implied.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const reproduce = process.argv.includes('--reproduce-predecessor');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const consent = { purpose: 'life-movie.render', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-receipt' };
let cases = 0;
function fixture(type) {
  const job = { jobId: 'fixture-job', type, ownerUid: 'fixture-owner', tenantId: 'fixture-tenant',
    leaseToken: 'fixture-lease', consent, consents: [{ purpose: 'memory.storage', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-storage' }], payload: { projectId: 'fixture-project' } };
  const current = { ...structuredClone(job), status: 'RUNNING', execution: { leaseToken: job.leaseToken } };
  const docs = new Map([['jobs/' + job.jobId, current]]);
  const reads = [];
  const state = { fail: false, hang: false };
  const ref = key => ({ key, async get() {
    reads.push(key);
    if (state.fail) throw new Error('synthetic private backend error');
    if (state.hang) return new Promise(() => {});
    const value = docs.get(key);
    return { exists: docs.has(key), data: () => structuredClone(value) };
  } });
  const db = { collection: name => ({ doc: id => ref(name + '/' + id) }),
    runTransaction: callback => callback({ get: reference => reference.get() }) };
  const app = { use() {}, get() {}, post() {}, listen() {} };
  const worker = { exports: {} };
  vm.runInNewContext(source + '\nmodule.exports = { createRenderControl };', {
    module: worker, Buffer, AbortController, console: { log() {}, error() {} },
    process: { env: { URAI_ENV: 'test', URAI_STUDIO_LEASE_POLL_MS: '1000', URAI_STUDIO_RENDER_TIMEOUT_MS: '75', URAI_STUDIO_ASSEMBLY_TIMEOUT_MS: '75' } },
    require(name) {
      if (name === 'express') return Object.assign(() => app, { json: () => () => {} });
      if (name === 'firebase-admin') return { initializeApp() {}, firestore: () => db };
      return require(name);
    },
  });
  return { job, current, docs, reads, state, control: worker.exports.createRenderControl(job) };
}
const defects = [
  ['local deletion fence', h => h.docs.set('uraiPrivateLifeModelOwnerFences/' + digest(h.job.ownerUid), { ownerHash: digest(h.job.ownerUid), deleted: true }), /render_owner_deleted/],
  ['central deletion tombstone', h => h.docs.set('privacyDeletionTombstones/' + h.job.ownerUid, { uid: h.job.ownerUid, active: true }), /render_owner_deleted/],
  ['foreign local owner fence', h => h.docs.set('uraiPrivateLifeModelOwnerFences/' + digest(h.job.ownerUid), { ownerHash: 'foreign', deleted: false }), /render_owner_deleted/],
  ['foreign central tombstone', h => h.docs.set('privacyDeletionTombstones/' + h.job.ownerUid, { uid: 'foreign', active: false }), /render_owner_deleted/],
  ['changed canonical receipt', h => { h.current.consent.decisionReceiptId = 'new-receipt'; }, /render_job_binding_mismatch/],
  ['changed secondary consent', h => { h.current.consents[0].policyVersion = 'new-policy'; }, /render_job_binding_mismatch/],
  ['removed canonical consent', h => { delete h.current.consent; }, /render_job_binding_mismatch/],
  ['missing owner', h => { delete h.job.ownerUid; delete h.current.ownerUid; }, /render_consent_missing|render_job_binding_mismatch/],
  ['missing primary consent', h => { delete h.job.consent; delete h.current.consent; }, /render_consent_missing/],
  ['invalid additional consent', h => { h.job.consents = h.current.consents = [{}]; }, /render_consent_missing/],
  ['secondary consent revoked', h => h.docs.set('jobConsentBlocks/' + digest(h.job.ownerUid + '\n' + 'memory.storage'), { active: true }), /render_consent_revoked/],
  ['foreign canonical document identity', h => { h.current.jobId = 'foreign-job'; }, /render_job_binding_mismatch/],
];
for (const type of ['studio.render.video', 'studio.assemble.video']) {
  for (const [label, mutate, expected] of defects) {
    for (const afterStart of [false, true]) {
      const h = fixture(type);
      try {
        if (afterStart) await h.control.start();
        mutate(h);
        if (reproduce) await (afterStart ? h.control.check() : h.control.start());
        else await assert.rejects(afterStart ? h.control.check() : h.control.start(), expected);
        cases++;
      } finally { h.control.stop(); }
    }
    console.log(`[${reproduce ? 'REPRODUCED' : 'PASS'}] ${type}: ${label} before and during admitted work`);
  }
  if (!reproduce) {
    for (const flag of ['fail', 'hang']) {
      const h = fixture(type);
      h.state[flag] = true;
      try { await assert.rejects(h.control.start(), flag === 'fail' ? /render_authority_unavailable/ : /render_deadline_exceeded/); cases++; }
      finally { h.control.stop(); }
    }
    const h = fixture(type);
    h.docs.set('uraiPrivateLifeModelOwnerFences/' + digest(h.job.ownerUid), { ownerHash: digest(h.job.ownerUid), deleted: false });
    h.docs.set('privacyDeletionTombstones/' + h.job.ownerUid, { uid: h.job.ownerUid, active: false });
    try {
      await h.control.start(); await h.control.check();
      for (const key of ['jobs/' + h.job.jobId, 'uraiPrivateLifeModelOwnerFences/' + digest(h.job.ownerUid),
        'privacyDeletionTombstones/' + h.job.ownerUid,
        ...[h.job.consent, ...h.job.consents].map(value => 'jobConsentBlocks/' + digest(h.job.ownerUid + '\n' + value.purpose))]) {
        assert.ok(h.reads.filter(path => path === key).length >= 2, 'every guard rereads all current durable authority');
      }
      cases++;
    } finally { h.control.stop(); }
  }
}
console.log(`${reproduce ? 'Predecessor bypasses reproduced' : 'Actual Studio worker lifecycle cases passed'}: ${cases}; provider calls:0; cloud acceptance:false.`);
