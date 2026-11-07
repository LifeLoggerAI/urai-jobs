import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Original TypeScript source is transpiled in memory. No mocked authority
// decision can open the separate consent or Storage write gate.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const ownerSource = fs.readFileSync(path.resolve('functions/src/privacy/ownerDeletionFence.ts'), 'utf8');
const js = ts.transpileModule(ownerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(js, { module, exports: module.exports, Object, Array, Error });
const { assertLifeMovieOwnerTenantAuthorityClear: check } = module.exports;
const BLOCK = /life_movie_owner_tenant_authority_unavailable/;
const fixture = { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active', deleted: false,
  markedForDeletion: false, disabled: false, dataRightsDeletionPendingCentralPrivacy: false };
const snap = value => ({ exists: value !== null, data: () => value });

function denied(value, uid = 'owner-1', tenant = 'tenant-1') {
  assert.throws(() => check(snap(value), uid, tenant), BLOCK);
}

test('approved owner/tenant and clear account projection passes the independent transaction-local guard', () => {
  assert.doesNotThrow(() => check(snap(fixture), 'owner-1', 'tenant-1'));
});
test('wrong tenant, wrong owner, missing profile and missing identity fail closed', () => {
  denied(fixture, 'foreign-1'); denied(fixture, 'owner-1', 'foreign-1');
  denied(null); denied({ ...fixture, uid: 'other-1' }); denied({ ...fixture, tenantId: 'other-1' });
  denied({ ...fixture, uid: undefined }); denied({ ...fixture, tenantId: undefined });
  denied(fixture, '', 'tenant-1'); denied(fixture, 'owner-1', 'not/a/tenant');
});
test('missing legacy owner/tenant/active state cannot be mistaken for authorization', () => {
  for (const key of ['uid','tenantId','accountStatus','deleted','markedForDeletion']) {
    const copy = { ...fixture }; delete copy[key]; denied(copy);
  }
});
test('disabled, deleted, pending deletion and malformed status fail closed', () => {
  for (const field of [
    { disabled:true }, { disabled:null }, { deleted:true },
    { markedForDeletion:true }, { accountStatus:'disabled' },
    { dataRightsDeletionPendingCentralPrivacy:true },
    { dataRightsDeletionPendingCentralPrivacy:null },
  ]) denied({ ...fixture, ...field });
});
test('legacy absent disabled/central flag does not manufacture those states', () => {
  const copy={...fixture}; delete copy.disabled; delete copy.dataRightsDeletionPendingCentralPrivacy;
  assert.doesNotThrow(() => check(snap(copy),'owner-1','tenant-1'));
});
test('inherited and accessor-backed tenant and deletion fields are rejected without executing getters', () => {
  const bad=Object.create({ tenantId:'tenant-1' }); Object.assign(bad, fixture); delete bad.tenantId; denied(bad);
  let calls=0; const getter={...fixture}; Object.defineProperty(getter,'tenantId',{get(){calls++;return 'tenant-1'}});
  denied(getter); assert.equal(calls,0);
  const inherited=Object.create(null); Object.assign(inherited,fixture); Object.setPrototypeOf(inherited,{disabled:false});
  denied(inherited);
  const deletion={...fixture}; Object.defineProperty(deletion,'dataRightsDeletionPendingCentralPrivacy',{get(){calls++;return false}});
  denied(deletion); assert.equal(calls,0);
});
test('throwing profile or hostile snapshot fails closed', () => {
  assert.throws(()=>check({exists:true,data(){throw new Error('Firestore unavailable')}},'owner-1','tenant-1'),BLOCK);
  assert.throws(()=>check({exists:false,data:()=>fixture},'owner-1','tenant-1'),BLOCK);
  assert.throws(()=>check(null,'owner-1','tenant-1'),BLOCK);
});
test('both actual Studio bridges enforce the guard inside all enqueue/resume transactions', () => {
  for(const name of ['studioLifeMovieBridge.ts','studioLifeMovieLongformBridge.ts']) {
    const source=fs.readFileSync(path.resolve(`functions/src/jobs/${name}`),'utf8');
    const expected=name.includes('Longform')?3:1;
    const matches=[...source.matchAll(/assertOwnerDeletionFenceClear\(ownerSnapshot\);\s*assertLifeMovieOwnerTenantAuthorityClear\(ownerSnapshot,\s*(?:input.userId|userId),\s*(?:input.tenantId|tenantId)\);/g)];
    assert.equal(matches.length,expected,name+' must bind every owner-relevant transaction');
  }
});
test('Studio status rechecks owner and tenant within one Firestore read transaction', async () => {
  const source = fs.readFileSync(path.resolve('functions/src/jobs/studioLifeMovieBridge.ts'), 'utf8');
  const ast = ts.createSourceFile('studioLifeMovieBridge.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'loadBoundJob');
  assert.ok(declaration?.body, 'original Studio status loader must exist');
  const js = ts.transpileModule(declaration.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const originalJob = { jobId: 'synthetic-job-1234567890', sourceSystem: 'urai-studio',
    tenantId: 'tenant-1', ownerUid: 'owner-1', jobType: 'studio.render.video', status: 'SUCCESS' };
  let jobValue = originalJob;
  let ownerValue = { ...fixture };
  const reads = [];
  let transactions = 0;
  const db = {
    collection(name) {
      assert.equal(name, 'users');
      return { doc(uid) { return { kind: 'owner', uid }; } };
    },
    async runTransaction(fn) {
      transactions++;
      return fn({ async get(ref) {
        reads.push(ref.kind);
        if (ref.kind === 'job') return snap(jobValue);
        if (ref.kind === 'owner') { assert.equal(ref.uid, 'owner-1'); return snap(ownerValue); }
        throw Error('unexpected reference');
      } });
    },
  };
  const bridgeModule = { exports: {} };
  vm.runInNewContext(js + '\nmodule.exports.loadBoundJob = loadBoundJob;', {
    module: bridgeModule, Object, Array, Promise, Error,
    getFirestore: () => db,
    jobDoc: id => ({ kind: 'job', id }),
    assertLifeMovieOwnerTenantAuthorityClear: check,
  });
  const load = () => bridgeModule.exports.loadBoundJob('tenant-1', 'owner-1', originalJob.jobId);
  assert.strictEqual(await load(), originalJob);
  assert.deepEqual(reads, ['job', 'owner']);
  assert.equal(transactions, 1);
  for (const invalid of [
    { ...fixture, disabled: true }, { ...fixture, accountStatus: 'disabled' },
    { ...fixture, tenantId: 'another-tenant' }, { ...fixture, deleted: true },
    { ...fixture, dataRightsDeletionPendingCentralPrivacy: true }, null,
  ]) {
    reads.length = 0;
    ownerValue = invalid;
    await assert.rejects(load(), BLOCK);
    assert.deepEqual(reads, ['job', 'owner'], 'both records must be read before status disclosure');
  }
  ownerValue = { ...fixture };
  jobValue = { ...originalJob, tenantId: 'another-tenant' };
  reads.length = 0;
  await assert.rejects(load(), /job_boundary_mismatch/);
  assert.deepEqual(reads, ['job'], 'wrong job binding must be rejected first');
  jobValue = null;
  reads.length = 0;
  await assert.rejects(load(), /job_not_found/);
  assert.deepEqual(reads, ['job'], 'missing job must not read owner profile');
});

test('long-form status transaction rechecks current owner before private segment reads', async () => {
  const source = fs.readFileSync(path.resolve('functions/src/jobs/studioLifeMovieLongformBridge.ts'), 'utf8');
  const ast = ts.createSourceFile('studioLifeMovieLongformBridge.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decl = name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const owner = decl('assertPlanOwner');
  const reader = decl('readPlanStatus');
  assert.ok(owner?.body && reader?.body, 'long-form owner and status functions must exist');
  const output = ts.transpileModule(owner.getText(ast) + '\n' + reader.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const plan = { planId: 'synthetic-plan-1', tenantId: 'tenant-1', ownerUid: 'owner-1',
    consent: { purpose: 'life-movie.render' }, childJobIds: ['synthetic-child-1'],
    segments: [{ index: 0 }], renderPlanDigest: 'a'.repeat(64), sceneTruthDigest: 'b'.repeat(64) };
  let currentPlan = plan;
  let currentOwner = { ...fixture };
  let consentReads = 0;
  let segmentReads = 0;
  let consentMode = 'clear';
  const txReads = [];
  const db = {
    collection(name) {
      assert.equal(name, 'users');
      return { doc(uid) { return { kind: 'owner', uid }; } };
    },
    async runTransaction(fn) {
      return fn({ async get(ref) {
        txReads.push(ref.kind);
        if (ref.kind === 'plan') return snap(currentPlan);
        if (ref.kind === 'owner') { assert.equal(ref.uid, 'owner-1'); return snap(currentOwner); }
        throw Error('unexpected transaction reference');
      } });
    },
    async getAll(...refs) {
      segmentReads++;
      assert.equal(refs.length, 1);
      return [snap({ status: 'SUCCESS' })];
    },
  };
  const longformModule = { exports: {} };
  vm.runInNewContext(output + '\nmodule.exports.readPlanStatus = readPlanStatus;', {
    module: longformModule, Object, Array, Promise, Error, Set,
    getFirestore: () => db,
    planRef: id => ({ kind: 'plan', id }),
    jobDoc: id => ({ kind: 'job', id }),
    consentBlockRef: () => ({ async get() { consentReads++; return snap({ blocked: false }); } }),
    checkedJobConsentBlockState: () => consentMode,
    deriveStatus: () => 'SUCCESS',
    assertLifeMovieOwnerTenantAuthorityClear: check,
  });
  const load = () => longformModule.exports.readPlanStatus(plan.planId, 'tenant-1', 'owner-1');
  const valid = await load();
  assert.equal(valid.status, 'SUCCESS');
  assert.equal(valid.segmentCount, 1);
  assert.deepEqual(txReads, ['plan', 'owner']);
  assert.equal(consentReads, 1);
  assert.equal(segmentReads, 1);

  for (const blocked of [
    { ...fixture, disabled: true }, { ...fixture, deleted: true },
    { ...fixture, tenantId: 'foreign-tenant' }, { ...fixture, accountStatus: 'disabled' },
    { ...fixture, dataRightsDeletionPendingCentralPrivacy: true }, null,
  ]) {
    currentOwner = blocked;
    txReads.length = 0;
    consentReads = 0;
    segmentReads = 0;
    await assert.rejects(load(), BLOCK);
    assert.deepEqual(txReads, ['plan', 'owner'], 'current owner must be checked in transaction');
    assert.equal(consentReads, 0, 'owner denial must precede consent detail');
    assert.equal(segmentReads, 0, 'owner denial must precede private segment metadata');
  }
  // Consent revocation may expose only minimal revoked state, not child jobs,
  // segment identifiers, assembly state or provenance digests.
  currentOwner = { ...fixture };
  consentMode = 'revoked';
  txReads.length = 0;
  consentReads = 0;
  segmentReads = 0;
  const revokedStatus = await load();
  assert.deepEqual(txReads, ['plan', 'owner']);
  assert.equal(consentReads, 1);
  assert.equal(segmentReads, 0, 'revoked status must not read private child jobs');
  assert.equal(revokedStatus.status, 'REVOKED');
  assert.equal(revokedStatus.consentRevoked, true);
  assert.equal(revokedStatus.segmentCount, 0);
  assert.deepEqual(Array.from(revokedStatus.children), []);
  assert.equal(revokedStatus.assembly, null);
  assert.equal(revokedStatus.publicReleaseAuthorized, false);
  assert.equal('renderPlanDigest' in revokedStatus, false);
  assert.equal('sceneTruthDigest' in revokedStatus, false);
  assert.equal(Object.keys(revokedStatus.counts).length, 0);
  consentMode = 'clear';
  currentPlan = { ...plan, tenantId: 'foreign' };
  txReads.length = 0;
  consentReads = 0;
  await assert.rejects(load(), /longform_plan_boundary_mismatch/);
  assert.deepEqual(txReads, ['plan'], 'wrong plan binding rejected before owner profile');
  assert.equal(consentReads, 0);
  currentPlan = null;
  txReads.length = 0;
  await assert.rejects(load(), /longform_plan_not_found/);
  assert.deepEqual(txReads, ['plan'], 'missing plan rejected before owner profile');
});

test('worker activation and consent availability remain hard closed', () => {
  const source=fs.readFileSync('functions/src/privacy/lifeMovieConsentGate.ts','utf8');
  assert.match(source,/export function lifeMovieConsentAuthorityAvailable\(\): boolean \{\s*return false;/);
  const worker=fs.readFileSync('workers/studio-worker/index.js','utf8');
  assert.match(worker,/function lifeMovieConsentAuthorityAvailable\(\) \{\s*return false;/);
});
