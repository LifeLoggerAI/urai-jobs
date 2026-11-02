import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Actual committed TypeScript modules run with simulated Firebase Admin APIs.
// These are contract regressions, not Firestore/Storage emulator or hosted tests.
const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
function compile(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports, Date, Set, Number, Object, Array, Promise, Error,
    require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw Error('Unexpected import ' + name); },
  }, { filename: path });
  return module.exports;
}
function deriveScope(selection) {
  const sources = selection.sources.map(s => [s.id, s.bucket, s.objectPath, s.generation,
    s.mimeType, s.provenance, s.sourceRefs, s.consentRef, s.ownerOrRightsRef]);
  sources.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (sources.some((s, i) => i > 0 && s[0] === sources[i - 1][0])) throw Error('duplicate source');
  return { projectId: selection.projectId, renderPlanDigest: selection.renderPlanDigest,
    sourceSetDigest: createHash('sha256').update('urai-life-movie-source-set-v1\n')
      .update(JSON.stringify(sources)).digest('hex') };
}
const verifier = compile('../functions/src/privacy/lifeMovieSourceRightsVerifier.ts', {
  'node:crypto': { randomUUID },
  '../jobs/studioLifeMovieContract.js': { deriveStudioLifeMovieRenderScope: deriveScope },
});
const time = Date.parse('2026-11-01T13:00:00.000Z');
const source = { id: 'source-1', bucket: 'private-source-bucket',
  objectPath: 'tenants/tenant-1/sources/clip.mp4', generation: '1793378565000001',
  mimeType: 'video/mp4', consentRef: 'consent-1', ownerOrRightsRef: 'rights-1',
  provenance: 'original-source', sourceRefs: ['record-1'] };
const selection = { projectId: 'movie-1', renderPlanDigest: 'a'.repeat(64), sources: [source] };
const scope = deriveScope(selection);
const input = { ownerUid: 'owner-1', tenantId: 'tenant-1', selection, renderScope: scope };
const rights = { schemaVersion: 'urai-life-movie-source-rights-v1', issuer: 'trusted-server-source-rights-v1',
  status: 'approved', purpose: 'life-movie.render', ownerUid: input.ownerUid, tenantId: input.tenantId,
  projectId: selection.projectId, sourceId: source.id, bucket: source.bucket,
  objectPath: source.objectPath, generation: source.generation, mimeType: source.mimeType,
  consentRef: source.consentRef, ownerOrRightsRef: source.ownerOrRightsRef,
  provenance: source.provenance, sourceRefs: source.sourceRefs,
  thirdPartyClearance: 'verified', evidenceHash: 'f'.repeat(64),
  reviewedAt: new Date(time - 1000).toISOString(),
  expiresAt: new Date(time + 60000).toISOString() };
const metadata = { generation: source.generation, contentType: source.mimeType, size: '5' };
let active;
const observed = () => active.events;
const db = { collection(name) { return { doc(id) { return {
  async get() { active.events.push({ operation: 'get', collection: name, id });
    if (active.readError) throw Error('Firestore denied');
    if (name === 'lifeMovieSourceRights' && active.revokeOnSecondRead &&
        active.events.filter(x => x.operation === 'get' && x.collection === name).length === 2) {
      return { exists: true, data: () => ({ ...active.rights, status: 'revoked' }) };
    }
    return { exists: active.rights != null, data: () => active.rights }; },
  async create(value) { active.events.push({ operation: 'create', collection: name, id, value });
    if (active.auditError) throw Error('Firestore audit unavailable'); },
}; } }; } };
const storage = { bucket(bucket) { return { file(path, options) {
  active.events.push({ operation: 'file', bucket, path, options });
  return { async getMetadata() {
    active.events.push({ operation: 'metadata', bucket, path, options });
    if (active.storageError) throw Error('Storage unavailable');
    return [options?.generation === undefined ? active.currentMetadata : active.selectedMetadata];
  } };
} }; } };
const firebaseApp = { options: { projectId: 'urai-staging' } };
const adapter = compile('../functions/src/privacy/lifeMovieFirebaseSourceRightsAdapter.ts', {
  'firebase-admin/app': { getApp: () => active?.firebaseApp ?? firebaseApp },
  'firebase-admin/firestore': { getFirestore: (app) => { assert.equal(app, firebaseApp); return db; }, FieldValue: { serverTimestamp: () => '<server-time>' } },
  'firebase-admin/storage': { getStorage: (app) => { assert.equal(app, firebaseApp); return storage; } },
  './lifeMovieSourceRightsVerifier.js': verifier,
});
const checker = async (uid, tenant) => {
  active.events.push({ operation: 'owner', uid, tenant });
  if (active.ownerError || (active.revokeAfterFirst && ++active.ownerChecks > 1)) throw Error('owner disabled');
};
function fixture(overrides = {}) {
  active = { rights: structuredClone(rights), currentMetadata: structuredClone(metadata),
    selectedMetadata: structuredClone(metadata), events: [], ownerChecks: 0, ...overrides };
  const run = adapter.createFirebaseLifeMovieSourceRightsVerifier({
    firebaseProjectId: 'urai-staging',
    allowedBuckets: ['private-source-bucket'], assertCurrentOwner: checker, nowMs: () => time,
  });
  return { run, state: active };
}
let passed = 0;
{
  active = { firebaseApp: { options: { projectId: 'untrusted-project' } } };
  assert.throws(() => adapter.createFirebaseLifeMovieSourceRightsVerifier({
    firebaseProjectId: 'urai-staging', allowedBuckets: ['private-source-bucket'],
    assertCurrentOwner: checker,
  }), /life_movie_source_rights_unverified/);
  passed++;
}
{
  active = { firebaseApp: { options: {} } };
  assert.throws(() => adapter.createFirebaseLifeMovieSourceRightsVerifier({
    firebaseProjectId: 'urai-staging', allowedBuckets: ['private-source-bucket'],
    assertCurrentOwner: checker,
  }), /life_movie_source_rights_unverified/);
  passed++;
}
for (const config of [
  {}, { allowedBuckets: [], assertCurrentOwner: checker },
  { allowedBuckets: ['bad/bucket'], assertCurrentOwner: checker },
  { allowedBuckets: [1], assertCurrentOwner: checker },
  { allowedBuckets: ['private-source-bucket'] },
  { allowedBuckets: ['private-source-bucket'], assertCurrentOwner: null },
  { firebaseProjectId: '', allowedBuckets: ['private-source-bucket'], assertCurrentOwner: checker },
  { firebaseProjectId: 'BAD-PROJECT', allowedBuckets: ['private-source-bucket'], assertCurrentOwner: checker },
]) {
  assert.throws(() => adapter.createFirebaseLifeMovieSourceRightsVerifier(config), /life_movie_source_rights_unverified/);
  passed++;
}
{
  const { run, state } = fixture();
  const result = await run(input);
  assert.equal(result.ownerUid, input.ownerUid);
  assert.equal(result.tenantId, input.tenantId);
  assert.equal(result.renderScope.sourceSetDigest, scope.sourceSetDigest);
  assert.match(result.rightsEventId, /^[0-9a-f-]{36}$/);
  const reads = state.events.filter(x => x.operation === 'get');
  assert.deepEqual(reads.map(x => [x.collection, x.id]), [
    ['lifeMovieSourceRights', 'rights-1'], ['lifeMovieSourceRights', 'rights-1'],
  ]);
  const files = state.events.filter(x => x.operation === 'file');
  assert.equal(files.length, 2);
  assert.equal(files[0].bucket, source.bucket);
  assert.equal(files[0].path, source.objectPath);
  assert.equal(files[0].options, undefined);
  assert.equal(files[1].options.generation, Number(source.generation));
  const writes = state.events.filter(x => x.operation === 'create');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].collection, 'lifeMovieSourceRightsDecisions');
  assert.equal(writes[0].value.sourceSetDigest, scope.sourceSetDigest);
  assert.equal(writes[0].value.createdAt, '<server-time>');
  assert.equal(writes[0].value.ownerUid, input.ownerUid);
  assert.equal(state.events.filter(x => x.operation === 'owner').length, 2);
  passed += 16;
}
async function denied(overrides, request = input) {
  const { run, state } = fixture(overrides);
  await assert.rejects(() => run(request), /life_movie_source_rights_unverified/);
  const writes = observed().filter(x => x.operation === 'create');
  if (!overrides.auditError) assert.equal(writes.length, 0, 'failed access must not emit a success audit');
  passed++;
  return state;
}
await denied({ rights: null });
await denied({ readError: true });
await denied({ ownerError: true });
await denied({ revokeAfterFirst: true });
await denied({ revokeOnSecondRead: true });
await denied({ storageError: true });
await denied({ auditError: true });
await denied({ rights: { ...rights, tenantId: 'foreign-tenant' } });
await denied({ rights: { ...rights, ownerUid: 'another-owner' } });
await denied({ rights: { ...rights, status: 'revoked' } });
await denied({ rights: { ...rights, issuer: 'user-controlled' } });
await denied({ rights: { ...rights, revokedAt: new Date(time).toISOString() } });
await denied({ rights: { ...rights, expiresAt: new Date(time - 1000).toISOString() } });
await denied({ rights: { ...rights, sourceRefs: ['changed'] } });
await denied({ currentMetadata: { ...metadata, generation: '1793378565000002' } });
await denied({ selectedMetadata: { ...metadata, generation: '1793378565000002' } });
await denied({ selectedMetadata: { ...metadata, contentType: 'image/jpeg' } });
await denied({ currentMetadata: { ...metadata, timeDeleted: '2026-11-01T13:00:00Z' } });
await denied({ selectedMetadata: { ...metadata, temporaryHold: true } });
await denied({}, { ...input, tenantId: 'foreign-tenant' });
await denied({}, { ...input, renderScope: { ...scope, sourceSetDigest: '0'.repeat(64) } });
console.log('[PASS] ' + passed + ' synthetic Firebase adapter contract assertions; no Firebase emulator, hosted service or token issued.');
