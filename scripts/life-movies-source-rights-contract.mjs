import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/privacy/lifeMovieSourceRightsVerifier.ts', import.meta.url), 'utf8');
const module = { exports: {} };
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

// This synthetic scope implementation matches the versioned Jobs source-set
// algorithm. The actual verifier module is transpiled from its committed TS.
function deriveScope(selection) {
  const sources = selection.sources.map(s => [s.id, s.bucket, s.objectPath, s.generation,
    s.mimeType, s.provenance, s.sourceRefs, s.consentRef, s.ownerOrRightsRef]);
  sources.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (sources.some((s, i) => i && s[0] === sources[i - 1][0])) throw Error('duplicate source');
  return { projectId: selection.projectId, renderPlanDigest: selection.renderPlanDigest,
    sourceSetDigest: createHash('sha256').update('urai-life-movie-source-set-v1\n')
      .update(JSON.stringify(sources)).digest('hex') };
}
vm.runInNewContext(js, {
  module, exports: module.exports, Date, Buffer, Number, Object, Array, Reflect,
  Set, Promise, Error, Map,
  require(name) {
    if (name === 'node:crypto') return { randomUUID };
    if (name === '../jobs/studioLifeMovieContract.js') return {
      deriveStudioLifeMovieRenderScope: deriveScope,
    };
    throw Error('unexpected module import: ' + name);
  },
}, { filename: 'lifeMovieSourceRightsVerifier.js' });
const { createLifeMovieSourceRightsVerifier } = module.exports;
const now = Date.parse('2026-11-01T14:00:00Z');
const sourceItem = {
  id: 'source-1', ownerOrRightsRef: 'rights-1', consentRef: 'consent-1',
  bucket: 'private-movie-bucket', objectPath: 'tenants/tenant-1/source/movie.mp4',
  generation: '1793378565000001', mimeType: 'video/mp4', provenance: 'owner-upload',
  sourceRefs: ['library-item-1'],
};
const baseSelection = { projectId: 'movie-1', renderPlanDigest: 'a'.repeat(64), sources: [sourceItem] };
const makeRequest = (selection = baseSelection) => ({ ownerUid: 'owner-1', tenantId: 'tenant-1',
  selection, renderScope: deriveScope(selection) });
const makeRecord = (s = sourceItem) => ({
  schemaVersion: 'urai-life-movie-source-rights-v1', issuer: 'trusted-server-source-rights-v1',
  status: 'approved', purpose: 'life-movie.render', ownerUid: 'owner-1', tenantId: 'tenant-1',
  projectId: 'movie-1', sourceId: s.id, bucket: s.bucket, objectPath: s.objectPath,
  generation: s.generation, mimeType: s.mimeType, consentRef: s.consentRef,
  ownerOrRightsRef: s.ownerOrRightsRef, provenance: s.provenance, sourceRefs: s.sourceRefs,
  revokedAt: null, deletedAt: null, thirdPartyClearance: 'verified',
  evidenceHash: 'b'.repeat(64), expiresAt: new Date(now + 60000).toISOString(),
  reviewedAt: new Date(now - 1000).toISOString(),
});
const metadata = { generation: sourceItem.generation, contentType: sourceItem.mimeType,
  size: '200000', temporaryHold: false };
let checks = 0;
const deny = /life_movie_source_rights_unverified/;
function fixture(overrides = {}) {
  const actions = [];
  let ownerReads = 0;
  let rightsReads = 0;
  const backend = {
    allowedBuckets: ['private-movie-bucket'], nowMs: () => now,
    async assertCurrentOwner(uid, tenant) {
      ownerReads++;
      assert.equal(uid, 'owner-1'); assert.equal(tenant, 'tenant-1');
      if (overrides.ownerDenied || (overrides.ownerDeniedSecond && ownerReads === 2)) throw Error('owner disabled');
    },
    async readRightsRecord(id) {
      actions.push('rights'); assert.equal(id, 'rights-1');
      rightsReads++;
      if (overrides.noRights || (overrides.missingOnSecondRead && rightsReads === 2)) return null;
      if (overrides.rightsError || (overrides.errorOnSecondRead && rightsReads === 2)) throw Error('database denied');
      if (overrides.changedOnSecondRead && rightsReads === 2) {
        return { ...makeRecord(), ...overrides.changedOnSecondRead };
      }
      return { ...makeRecord(), ...(overrides.record || {}) };
    },
    async currentObject(bucket, path) {
      actions.push('live'); assert.equal(bucket, sourceItem.bucket);
      assert.equal(path, sourceItem.objectPath);
      if (overrides.storageError) throw Error('Storage unavailable');
      return { ...metadata, ...(overrides.current || {}) };
    },
    async selectedGeneration(bucket, path, generation) {
      actions.push('pinned'); assert.equal(bucket, sourceItem.bucket);
      assert.equal(path, sourceItem.objectPath); assert.equal(generation, sourceItem.generation);
      return { ...metadata, ...(overrides.selected || {}) };
    },
    async recordDecision(event) {
      actions.push('audit');
      assert.equal(event.ownerUid, 'owner-1'); assert.equal(event.tenantId, 'tenant-1');
      assert.equal(event.sourceCount, 1); assert.equal(event.projectId, 'movie-1');
      if (overrides.auditError) throw Error('audit unavailable');
    },
  };
  return { backend, actions, ownerReads: () => ownerReads };
}

assert.throws(() => createLifeMovieSourceRightsVerifier({}), deny); checks++;
for (const invalid of [null, {}, { allowedBuckets: [] }, { allowedBuckets: ['x'] }]) {
  assert.throws(() => createLifeMovieSourceRightsVerifier(invalid), deny); checks++;
}
{
  const f = fixture(); const evidence = await createLifeMovieSourceRightsVerifier(f.backend)(makeRequest());
  assert.equal(evidence.ownerUid, 'owner-1'); assert.equal(evidence.tenantId, 'tenant-1');
  assert.equal(evidence.renderScope.sourceSetDigest, makeRequest().renderScope.sourceSetDigest);
  assert.ok(typeof evidence.rightsEventId === 'string' && evidence.rightsEventId.length > 8);
  assert.deepEqual(f.actions, ['rights', 'live', 'pinned', 'rights', 'audit']);
  assert.equal(f.ownerReads(), 2); checks += 6;
}
for (const mutate of [
  req => ({ ...req, ownerUid: '' }), req => ({ ...req, ownerUid: 'foreign/uid' }),
  req => ({ ...req, tenantId: 'cross/tenant' }),
  req => ({ ...req, renderScope: { ...req.renderScope, sourceSetDigest: 'c'.repeat(64) } }),
  req => ({ ...req, renderScope: { ...req.renderScope, projectId: 'another-movie' } }),
  req => ({ ...req, selection: { ...req.selection, renderPlanDigest: 'no-digest' } }),
  req => ({ ...req, selection: { ...req.selection, sources: [] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [...req.selection.sources, ...req.selection.sources] } }),
  req => ({ ...req, selection: { ...req.selection, sources: Array(129).fill(sourceItem) } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, bucket: 'foreign-bucket' }] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, objectPath: '../unsafe.mp4' }] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, generation: '0' }] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, generation: '9007199254740992' }] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, consentRef: '' }] } }),
  req => ({ ...req, selection: { ...req.selection, sources: [{ ...sourceItem, sourceRefs: [] }] } }),
]) {
  const f = fixture();
  await assert.rejects(() => createLifeMovieSourceRightsVerifier(f.backend)(mutate(makeRequest())), deny);
  assert.deepEqual(f.actions, [], 'invalid input must not touch backend'); checks++;
}
for (const record of [
  { issuer: 'studio' }, { status: 'pending' }, { purpose: 'memory.storage' },
  { ownerUid: 'other' }, { tenantId: 'other' }, { projectId: 'other' },
  { sourceId: 'other' }, { bucket: 'other' }, { objectPath: 'other' },
  { generation: '123' }, { mimeType: 'image/jpeg' }, { consentRef: 'other' },
  { ownerOrRightsRef: 'other' }, { provenance: 'other' }, { sourceRefs: ['foreign'] },
  { thirdPartyClearance: 'unreviewed' }, { revokedAt: new Date(now).toISOString() },
  { deletedAt: new Date(now).toISOString() }, { evidenceHash: 'invalid' },
  { expiresAt: new Date(now - 1000).toISOString() },
  { reviewedAt: new Date(now + 1000).toISOString() },
  { reviewedAt: new Date(now - 366 * 86400000).toISOString() },
]) {
  const f = fixture({ record });
  await assert.rejects(() => createLifeMovieSourceRightsVerifier(f.backend)(makeRequest()), deny);
  assert.equal(f.actions.includes('audit'), false); checks++;
}
for (const override of [
  { current: { generation: '2' } }, { selected: { generation: '2' } },
  { current: { contentType: 'image/jpeg' } }, { selected: { contentType: 'image/jpeg' } },
  { current: { size: '0' } }, { selected: { size: 'garbage' } },
  { current: { timeDeleted: 'deleted' } }, { selected: { temporaryHold: true } },
  { noRights: true }, { rightsError: true }, { storageError: true },
  { ownerDenied: true }, { ownerDeniedSecond: true }, { auditError: true },
]) {
  const f = fixture(override);
  await assert.rejects(() => createLifeMovieSourceRightsVerifier(f.backend)(makeRequest()), deny);
  checks++;
}
// A rights record can be revoked after the first read while Storage I/O is
// pending. Neither that new state nor a failed final read may be accepted.
for (const override of [
  { changedOnSecondRead: { status: 'revoked' } },
  { changedOnSecondRead: { revokedAt: new Date(now).toISOString() } },
  { changedOnSecondRead: { expiresAt: new Date(now-1).toISOString() } },
  { changedOnSecondRead: { tenantId: 'another-tenant' } },
  { missingOnSecondRead: true },
  { errorOnSecondRead: true },
]) {
  const f = fixture(override);
  await assert.rejects(() => createLifeMovieSourceRightsVerifier(f.backend)(makeRequest()), deny);
  assert.equal(f.actions.filter(x => x === 'rights').length, 2);
  assert.equal(f.actions.includes('audit'), false);
  checks++;
}
console.log('[PASS] ' + checks + ' synthetic source-rights verifier scenarios; no Firebase, grants or rendering.');
