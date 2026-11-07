import assert from 'node:assert/strict';
import test from 'node:test';
import { assessReviewOnlyGenerationEvidence as assess,
  canonicalReviewOnlyStorageGeneration as canonical,
  assertReviewOnlyHistoricalObservationClaim as assertClaim } from '../functions/src/privacy/lifeMovieGenerationEvidenceReview.ts';

test('R872: valid uint64 and no loss of large decimal generations', () => {
  for (const v of ['1','9007199254740993','18446744073709551615'])
    assert.equal(canonical(v), true);
  for (const v of ['0','01','-1','18446744073709551616',1, 1n, null, '1.0'])
    assert.equal(canonical(v), false);
});

test('R872: actual matching metadata admits first-time observation', () => {
  assert.deepEqual(assess('9007199254740993','9007199254740993',false,false),
    {storageCurrentlyObserved:true});
});

test('R872: first-time claim refuses missing object or mismatch', () => {
  assert.throws(()=>assess('15',null,true,false),/generation_not_observed/);
  assert.throws(()=>assess('15','16',false,false),/generation_not_observed/);
});

test('R872: verified historic replay survives exact absent-generation cleanup', () => {
  assert.deepEqual(assess('15',null,true,true),{storageCurrentlyObserved:false});
});

test('R872: replacement at same path must not masquerade as deleted historic object', () => {
  assert.throws(()=>assess('15','16',false,true),/generation_replaced_unverified/);
});

test('R872: unknown or unsafe provider metadata is always denied', () => {
  assert.throws(()=>assess('15',null,false,true),/storage_unverified/);
  assert.throws(()=>assess('15',9007199254740993,false,true),/storage_unverified/);
  assert.throws(()=>assess('15','0',false,true),/storage_unverified/);
  assert.throws(()=>assess('15','16',true,true),/storage_unverified/);
});

test('R872: verified original live generation is idempotent', () => {
  assert.deepEqual(assess('15','15',false,true),{storageCurrentlyObserved:true});
});

test('R872: malformed claimed generations fail closed before provenance evaluation', () => {
  assert.throws(()=>assess('01',null,true,true),/generation_invalid/);
});

test('R873: historical caller-claimed mismatches stay generation conflicts', () => {
  assert.throws(()=>assertClaim('16','15','tenants/a/file','tenants/a/file'),
    /generation_conflict/);
  assert.throws(()=>assertClaim('15','15','tenants/a/file','tenants/b/file'),
    /generation_conflict/);
  assert.throws(()=>assertClaim('15',null,'tenants/a/file','tenants/a/file'),
    /generation_conflict/);
  assert.doesNotThrow(()=>assertClaim('15','15','tenants/a/file','tenants/a/file'));
});

test('R873: live path replacement is classified separately after exact claim binding', () => {
  assert.doesNotThrow(()=>assertClaim('15','15','tenants/a/file','tenants/a/file'));
  assert.throws(()=>assess('15','16',false,true),/generation_replaced_unverified/);
  assert.deepEqual(assess('15',null,true,true),{storageCurrentlyObserved:false});
});

test('R874: forged claim wins conflict precedence while a replacement exists', () => {
  const path='tenants/t/life-movies/p/review-only-broker/hash.bin';
  const ledger='101', liveReplacement='202', forged='303';
  assert.throws(() => {
    assertClaim(forged, ledger, path, path);
    assess(forged, liveReplacement, false, true);
  }, /generation_conflict/);
  assert.throws(() => {
    assertClaim(ledger, ledger, path, path);
    assess(ledger, liveReplacement, false, true);
  }, /generation_replaced_unverified/);
});
