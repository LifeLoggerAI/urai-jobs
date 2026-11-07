import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalReviewOnlyStorageGeneration as canonical, assessReviewOnlyGenerationEvidence as assess, assertReviewOnlyHistoricalObservationClaim as claim } from '../functions/src/privacy/lifeMovieGenerationEvidenceReview.ts';

const MAX = (1n << 64n) - 1n;
const accepted = ['1','2','42','9007199254740991','9007199254740992','9007199254740993','18446744073709551614',String(MAX)];
const invalid = ['0','00','01','-1','+1',' 1','1 ','1\n','1.0','1e2','0x10',String(MAX + 1n),'99999999999999999999',...new Array(12).fill(0).map((_,i)=>('1'+'0'.repeat(20+i)))];

test('R874 independent: uint64 canonical boundaries, whitespace and overflow remain closed',()=>{
  for(const v of accepted) assert.equal(canonical(v),true,"canonical "+v);
  for(const v of invalid) assert.equal(canonical(v),false,"reject "+v);
  for(const v of [0,1,9007199254740993,Infinity,NaN,-Infinity,1n,null,undefined,{},[],false,true,new String('1')]) assert.equal(canonical(v),false);
});

test('R874 independent: each verified generation can replay only its exact current object or genuine 404',()=>{
  let checked = 0;
  for(const original of accepted) {
    assert.deepEqual(assess(original,original,false,true),{storageCurrentlyObserved:true}); checked++;
    assert.deepEqual(assess(original,null,true,true),{storageCurrentlyObserved:false}); checked++;
    for(const replacement of accepted) if(replacement!==original) {
      assert.throws(()=>assess(original,replacement,false,true),/generation_replaced_unverified/);checked++;
    }
    assert.throws(()=>assess(original,null,false,true),/storage_unverified/);checked++;
    assert.throws(()=>assess(original,'0',false,true),/storage_unverified/);checked++;
    assert.throws(()=>assess(original,original,true,true),/storage_unverified/);checked++;
  }
  assert.ok(checked>=80);
});

test('R874 independent: first observation cannot be admitted by a missing, forged, or alternate generation',()=>{
  for(const original of accepted){
    assert.deepEqual(assess(original,original,false,false),{storageCurrentlyObserved:true});
    assert.throws(()=>assess(original,null,true,false),/generation_not_observed/);
    for(const replacement of accepted) if(replacement!==original)
      assert.throws(()=>assess(original,replacement,false,false),/generation_not_observed/);
  }
});

test('R874 independent: historical claim mismatch is rejected before metadata classification',()=>{
  for(const original of accepted){
    claim(original,original,'tenants/A/output','tenants/A/output');
    assert.throws(()=>claim(original,original,'tenants/A/output','tenants/B/output'),/generation_conflict/);
    for(const different of accepted)if(different!==original)
      assert.throws(()=>claim(original,different,'tenants/A/output','tenants/A/output'),/generation_conflict/);
  }
});

test('R874 independent: provider string, unsafe numeric, fake object and booleans never silently coerce',()=>{
  for(const original of accepted){
    for(const unexpected of [null,undefined,0,-1,NaN,Infinity,1n,{},[],false,true,'01','1.0']){
      assert.throws(()=>assess(original,unexpected,false,true),/storage_unverified/);
    }
  }
  assert.deepEqual(assess('15',15,false,false),{storageCurrentlyObserved:true});
  assert.throws(()=>assess('9007199254740993',9007199254740993,false,true),/storage_unverified/);
});

test('R874 independent: malformed caller generations never appear authorized',()=>{
  for(const malformed of invalid){
    for(const found of [null,'1','42']){
      assert.throws(()=>assess(malformed,found,true,true),/generation_invalid/);
      assert.throws(()=>assess(malformed,found,false,true),/generation_invalid/);
    }
  }
});
