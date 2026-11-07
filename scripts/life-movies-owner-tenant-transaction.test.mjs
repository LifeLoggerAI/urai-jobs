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

test('long-form status atomically checks owner, consent and original job bindings', async () => {
  const source = fs.readFileSync(path.resolve('functions/src/jobs/studioLifeMovieLongformBridge.ts'), 'utf8');
  const ast = ts.createSourceFile('studioLifeMovieLongformBridge.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decl = name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const owner = decl('assertPlanOwner');
  const reader = decl('readPlanStatus');
  const structural = ['makeChildId', 'makeAssemblyJobId', 'assertPlanStructure', 'boundPlanJob']
    .map(name => decl(name));
  assert.ok(owner?.body && reader?.body && structural.every(node => node?.body),
    'original long-form structure, owner, job binding and status functions must exist');
  const deletionSource = fs.readFileSync(path.resolve('functions/src/jobs/lifeMovieOwnerDeletion.ts'), 'utf8');
  const deletionAst = ts.createSourceFile('lifeMovieOwnerDeletion.ts', deletionSource,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const validator = deletionAst.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'validateOwnedMovieJob');
  const safeSegment = deletionAst.statements.find(node =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
      declaration.name.getText(deletionAst) === 'SAFE_SEGMENT'));
  assert.ok(validator?.body && safeSegment, 'actual Jobs owner-bound validator must exist');
  const sourceFunctions = [safeSegment.getText(deletionAst),
    validator.getText(deletionAst).replace(/^export\s+/, ''),
    ...structural.map(node => node.getText(ast)), owner.getText(ast), reader.getText(ast)];
  const output = ts.transpileModule(sourceFunctions.join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const planId = 'synthetic-plan-1';
  const childId = 'lms_' + createHash('sha256').update(planId + ':0000').digest('hex').slice(0, 32) + '_0000';
  const assemblyId = 'lma_' + createHash('sha256').update(planId + ':assembly-v1').digest('hex').slice(0, 40);
  const consent = { purpose: 'life-movie.render', policyVersion: '1.0.0', decisionReceiptId: 'synthetic-receipt' };
  const plan = { planId, tenantId: 'tenant-1', ownerUid: 'owner-1', projectId: 'synthetic-project',
    consent, childJobIds: [childId], segments: [{ index: 0, jobId: childId }],
    renderPlanDigest: 'a'.repeat(64), sceneTruthDigest: 'b'.repeat(64) };
  const child = { jobId: childId, ownerUid: 'owner-1', tenantId: 'tenant-1',
    sourceSystem: 'urai-studio', jobType: 'studio.render.video', status: 'SUCCESS',
    payload: { projectId: plan.projectId },
    execution: { rootJobId: planId, parentJobId: planId }, consent };
  const assembly = { ...child, jobId: assemblyId, jobType: 'studio.assemble.video' };
  let currentChild = child;
  let currentAssembly = assembly;
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
      return fn({
        async get(ref) {
          txReads.push(ref.kind);
          if (ref.kind === 'plan') return snap(currentPlan);
          if (ref.kind === 'owner') { assert.equal(ref.uid, 'owner-1'); return snap(currentOwner); }
          if (ref.kind === 'consent') { consentReads++; return snap({ state: consentMode }); }
          if (ref.kind === 'job') return snap(currentAssembly);
          throw Error('unexpected Firestore transaction reference');
        },
        async getAll(...refs) {
          txReads.push('children');
          segmentReads++;
          assert.equal(refs.length, 1);
          return [snap(currentChild)];
        },
      });
    },
    // The old nontransactional child-read path must never be reintroduced.
    async getAll() { throw Error('private_child_read_outside_transaction'); },
  };
  const longformModule = { exports: {} };
  vm.runInNewContext(output + '\nmodule.exports.readPlanStatus = readPlanStatus;', {
    module: longformModule, Object, Array, Promise, Error, Set, createHash, isDeepStrictEqual,
    getFirestore: () => db,
    planRef: id => ({ kind: 'plan', id }),
    jobDoc: id => ({ kind: 'job', id }),
    consentBlockRef: () => ({ kind: 'consent', get() { throw Error('consent_read_outside_transaction'); } }),
    checkedJobConsentBlockState: (snapshot) => snapshot.data()?.state ?? 'unverified',
    deriveStatus: () => 'SUCCESS',
    assertLifeMovieOwnerTenantAuthorityClear: check,
  });
  const load = () => longformModule.exports.readPlanStatus(plan.planId, 'tenant-1', 'owner-1');
  const valid = await load();
  assert.equal(valid.status, 'SUCCESS');
  assert.equal(valid.segmentCount, 1);
  assert.deepEqual(txReads, ['plan', 'owner', 'consent', 'children']);
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
  assert.deepEqual(txReads, ['plan', 'owner', 'consent']);
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
  // An unreadable consent block must fail before any child lookup.
  consentMode = 'unverified';
  txReads.length = 0;
  consentReads = 0;
  segmentReads = 0;
  await assert.rejects(load(), /life_movie_consent_block_unverified/);
  assert.deepEqual(txReads, ['plan', 'owner', 'consent']);
  assert.equal(segmentReads, 0);
  consentMode = 'clear';
  currentPlan = plan;
  currentChild = { ...child, ownerUid: 'cross-owner' };
  txReads.length = 0;
  consentReads = 0;
  await assert.rejects(load(), /life_movie_owner_job_boundary_mismatch/);
  assert.deepEqual(txReads, ['plan', 'owner', 'consent', 'children'],
    'foreign child must be rejected before status disclosure');
  currentChild = { ...child, consent: { ...consent, decisionReceiptId: 'forged-consent' } };
  await assert.rejects(load(), /life_movie_owner_job_boundary_mismatch/);
  currentChild = child;
  currentPlan = { ...plan, assemblyJobId: assemblyId };
  const validAssembly = await load();
  assert.equal(validAssembly.assembly?.status, 'SUCCESS');
  currentAssembly = { ...assembly, tenantId: 'cross-tenant' };
  await assert.rejects(load(), /life_movie_owner_job_boundary_mismatch/);
  currentAssembly = assembly;
  currentPlan = { ...plan, childJobIds: ['foreign-child'] };
  await assert.rejects(load(), /longform_plan_structure_invalid/);
  currentPlan = plan;
  currentChild = null;
  await assert.rejects(load(), /longform_child_not_found/);
  currentChild = child;

  // Preserve the parallel R832 worker's full tamper matrix, adapted to
  // R831's atomic Firestore read path and shared owner-bound validator.
  const tamperedChildren = [
    { ...child, jobId: 'other-child' },
    { ...child, ownerUid: 'foreign-owner' },
    { ...child, tenantId: 'foreign-tenant' },
    { ...child, payload: { ...child.payload, projectId: 'foreign-project' } },
    { ...child, sourceSystem: 'foreign-studio' },
    { ...child, jobType: 'studio.assemble.video' },
    { ...child, execution: { rootJobId: 'foreign-plan', parentJobId: planId } },
    { ...child, execution: { rootJobId: planId, parentJobId: 'foreign-plan' } },
    { ...child, consent: { ...plan.consent, decisionReceiptId: 'forged' } },
    { ...child, consent: null },
  ];
  currentPlan = plan;
  for (const foreign of tamperedChildren) {
    currentChild = foreign;
    txReads.length = 0;
    consentReads = 0;
    segmentReads = 0;
    await assert.rejects(load(), /life_movie_owner_job_boundary_mismatch/);
    assert.deepEqual(txReads, ['plan', 'owner', 'consent', 'children']);
    assert.equal(consentReads, 1);
    assert.equal(segmentReads, 1);
  }
  currentChild = child;
  currentPlan = { ...plan, assemblyJobId: assemblyId };
  const badAssemblies = [
    { ...assembly, jobId: 'other-assembly' },
    { ...assembly, ownerUid: 'foreign-owner' },
    { ...assembly, tenantId: 'foreign-tenant' },
    { ...assembly, payload: { ...assembly.payload, projectId: 'foreign-project' } },
    { ...assembly, sourceSystem: 'foreign-studio' },
    { ...assembly, jobType: 'studio.render.video' },
    { ...assembly, execution: { rootJobId: 'foreign-plan', parentJobId: planId } },
    { ...assembly, execution: { rootJobId: planId, parentJobId: 'foreign-plan' } },
    { ...assembly, consent: { purpose: 'other' } },
  ];
  for (const foreign of badAssemblies) {
    currentAssembly = foreign;
    txReads.length = 0;
    consentReads = 0;
    segmentReads = 0;
    await assert.rejects(load(), /life_movie_owner_job_boundary_mismatch/);
    assert.deepEqual(txReads, ['plan', 'owner', 'consent', 'children', 'job']);
    assert.equal(consentReads, 1);
    assert.equal(segmentReads, 1);
  }
  currentAssembly = assembly;
  currentPlan = plan;
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
    assert.deepEqual(txReads, ['plan'], 'invalid plan must fail before owner metadata');
    assert.equal(consentReads, 0);
    assert.equal(segmentReads, 0);
  }
  currentPlan = plan;
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
