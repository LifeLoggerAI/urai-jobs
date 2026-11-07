import assert from 'node:assert/strict';
import test from 'node:test';
import { assessReviewOnlyGenerationEvidence as assess,
  canonicalReviewOnlyStorageGeneration as canonical } from '../functions/src/privacy/lifeMovieGenerationEvidenceReview.ts';

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
