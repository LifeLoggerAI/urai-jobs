import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
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

test('long-form status reads owner, consent and private job metadata in one transaction', async () => {
  const source = fs.readFileSync(path.resolve('functions/src/jobs/studioLifeMovieLongformBridge.ts'), 'utf8');
  const ast = ts.createSourceFile('studioLifeMovieLongformBridge.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decl = name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const owner = decl('assertPlanOwner');
  const reader = decl('readPlanStatus');
  const makeChild = decl('makeChildId');
  const makeAssembly = decl('makeAssemblyJobId');
  const validatePlan = decl('assertPlanStructure');
  assert.ok([owner, reader, makeChild, makeAssembly, validatePlan].every(fn => fn?.body),
    'long-form status must retain exact original owner, plan structure and child binding functions');
  const output = ts.transpileModule([owner, makeChild, makeAssembly, validatePlan, reader]
    .map(fn => fn.getText(ast)).join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const planId = 'synthetic-plan-1';
  const childId = 'lms_' + createHash('sha256').update(planId + ':0000').digest('hex').slice(0, 32) + '_0000';
  const plan = { planId, tenantId: 'tenant-1', ownerUid: 'owner-1',
    consent: { purpose: 'life-movie.render' }, childJobIds: [childId],
    segments: [{ jobId: childId, index: 0 }],
    renderPlanDigest: 'a'.repeat(64), sceneTruthDigest: 'b'.repeat(64) };
  const assemblyId = 'lma_' + createHash('sha256').update(planId + ':assembly-v1').digest('hex').slice(0, 40);
  const child = { jobId: childId, ownerUid: 'owner-1', tenantId: 'tenant-1',
    sourceSystem: 'urai-studio', jobType: 'studio.render.video',
    execution: { rootJobId: planId, parentJobId: planId },
    consent: plan.consent, status: 'SUCCESS' };
  const assembly = { jobId: assemblyId, ownerUid: 'owner-1', tenantId: 'tenant-1',
    sourceSystem: 'urai-studio', jobType: 'studio.assemble.video',
    execution: { rootJobId: planId, parentJobId: planId },
    consent: plan.consent, status: 'SUCCESS' };
  let currentChild = child;
  let currentAssembly = assembly;
  let currentPlan = plan;
  let currentOwner = { ...fixture };
  let assemblyReads = 0;
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
        if (ref.kind === 'consent') { consentReads++; return snap({ blocked: false }); }
        if (ref.kind === 'job') {
          assemblyReads++; assert.equal(ref.id, assemblyId); return snap(currentAssembly);
        }
        txReads.push(ref.kind);
        if (ref.kind === 'plan') return snap(currentPlan);
        if (ref.kind === 'owner') { assert.equal(ref.uid, 'owner-1'); return snap(currentOwner); }
        throw Error('unexpected transaction reference');
      }, async getAll(...refs) {
        segmentReads++;
        assert.equal(refs.length, 1);
        assert.equal(refs[0].kind, 'job');
        assert.equal(refs[0].id, childId);
        return [snap(currentChild)];
      } });
    },
    async getAll() {
      throw Error('private status read escaped the owner/consent transaction');
    },
  };
  const longformModule = { exports: {} };
  vm.runInNewContext(output + '\nmodule.exports.readPlanStatus = readPlanStatus;', {
    module: longformModule, Object, Array, Promise, Error, Set, createHash, isDeepStrictEqual,
    getFirestore: () => db,
    planRef: id => ({ kind: 'plan', id }),
    jobDoc: id => ({ kind: 'job', id, async get() {
      throw Error('assembly read escaped the owner/consent transaction');
    } }),
    consentBlockRef: () => ({ kind: 'consent', async get() {
      throw Error('consent read escaped the owner/consent transaction');
    } }),
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
  currentOwner = { ...fixture };
  // Revocation is a minimal state, not permission to read child documents or
  // return private segment IDs, render digests, or assembly metadata.
  consentMode = 'revoked';
  txReads.length = 0;
  consentReads = 0;
  segmentReads = 0;
  assemblyReads = 0;
  const redacted = await load();
  assert.equal(redacted.status, 'REVOKED');
  assert.equal(redacted.consentRevoked, true);
  assert.equal(redacted.segmentCount, 0);
  assert.deepEqual(Array.from(redacted.children), []);
  assert.equal(redacted.assembly, null);
  assert.equal(redacted.publicReleaseAuthorized, false);
  assert.equal('renderPlanDigest' in redacted, false);
  assert.equal('sceneTruthDigest' in redacted, false);
  assert.equal(Object.keys(redacted.counts).length, 0);
  assert.deepEqual(txReads, ['plan', 'owner']);
  assert.equal(consentReads, 1);
  assert.equal(segmentReads, 0);
  assert.equal(assemblyReads, 0);
  consentMode = 'clear';
  // Existing children can be replaced or reconsented after the parent plan
  // was created. The status boundary must reject a foreign live job.
  const tamperedChildren = [
    { ...child, jobId: 'other-child' },
    { ...child, ownerUid: 'foreign-owner' },
    { ...child, tenantId: 'foreign-tenant' },
    { ...child, sourceSystem: 'foreign-studio' },
    { ...child, jobType: 'studio.assemble.video' },
    { ...child, execution: { rootJobId: 'foreign-plan', parentJobId: planId } },
    { ...child, execution: { rootJobId: planId, parentJobId: 'foreign-plan' } },
    { ...child, consent: { ...plan.consent, decisionReceiptId: 'forged' } },
    { ...child, consent: null },
  ];
  for (const foreign of tamperedChildren) {
    currentPlan = plan;
    currentChild = foreign;
    txReads.length = 0;
    consentReads = 0;
    segmentReads = 0;
    await assert.rejects(load(), /longform_child_status_boundary_mismatch/);
    assert.deepEqual(txReads, ['plan', 'owner']);
    assert.equal(segmentReads, 1);
  }
  currentChild = child;
  currentPlan = { ...plan, assemblyJobId: assemblyId };
  const validAssembly = await load();
  assert.equal(validAssembly.assembly?.status, 'SUCCESS');
  assert.ok(assemblyReads > 0);
  const badAssemblies = [
    { ...assembly, jobId: 'other-assembly' },
    { ...assembly, ownerUid: 'foreign-owner' },
    { ...assembly, tenantId: 'foreign-tenant' },
    { ...assembly, sourceSystem: 'foreign-studio' },
    { ...assembly, jobType: 'studio.render.video' },
    { ...assembly, execution: { rootJobId: 'foreign-plan', parentJobId: planId } },
    { ...assembly, execution: { rootJobId: planId, parentJobId: 'foreign-plan' } },
    { ...assembly, consent: { purpose: 'other' } },
  ];
  for (const foreign of badAssemblies) {
    currentAssembly = foreign;
    await assert.rejects(load(), /longform_assembly_status_boundary_mismatch/);
  }
  currentAssembly = assembly;
  currentPlan = plan;
  // Malformed persisted plans must not cause unbounded or mismatched
  // per-child Firestore lookups, even if their historical owner matches.
  const malformed = [
    { ...plan, childJobIds: [], segments: [] },
    { ...plan, childJobIds: [childId, childId], segments: [
      { jobId: childId, index: 0 }, { jobId: childId, index: 1 },
    ] },
    { ...plan, childJobIds: [childId], segments: [{ jobId: 'foreign-job', index: 0 }] },
    { ...plan, childJobIds: [childId], segments: [{ jobId: childId, index: 1 }] },
    { ...plan, childJobIds: [childId], segments: [] },
    { ...plan, assemblyJobId: 'foreign-assembly' },
    { ...plan, childJobIds: Array(181).fill(childId),
      segments: Array.from({ length: 181 }, (_, index) => ({ jobId: childId, index })) },
  ];
  for (const corrupt of malformed) {
    currentPlan = corrupt;
    txReads.length = 0;
    consentReads = 0;
    segmentReads = 0;
    await assert.rejects(load(), /longform_plan_structure_invalid/);
    assert.deepEqual(txReads, ['plan'], 'invalid child plan must fail before owner metadata');
    assert.equal(consentReads, 0, 'invalid plan must not read consent details');
    assert.equal(segmentReads, 0, 'invalid plan must not read child-job metadata');
  }
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
