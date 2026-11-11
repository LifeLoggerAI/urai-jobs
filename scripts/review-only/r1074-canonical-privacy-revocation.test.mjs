import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {assertCanonicalPrivacyRevocation:check, DENIED} = require('../../workers/storage-broker/canonical-privacy-revocation.js');
const evt=()=>({ownerUid:'owner1',purpose:'life-movie.render',eventId:'revocation-123'});
const block=()=>({active:true,consumerId:'urai-jobs',status:'blocked',ownerUid:'owner1',
  purpose:'life-movie.render',eventId:'revocation-123',policyVersion:'v1',integrityHash:'a'.repeat(64)});
const fence=()=>({schemaVersion:'R1027_PRIVATE_OUTPUT_FENCE_V1',ownerUid:'owner1',
 purpose:'life-movie.render',eventId:'revocation-123',phase:'FENCING',epoch:1,
 legacyLineageUnverified:true,storageWriteAuthorized:false,
 storageWriteFenceVerified:false,allWritersDrained:false,privateOutputDeletionAcknowledged:false});
const snap=value=>({exists:true,data:()=>value});
const deny=(b=block(),f=fence(),e=evt())=>assert.throws(()=>check(snap(b),snap(f),e),{message:DENIED});
test('matching canonical Privacy block and fence prove only a veto, never upload/deletion permission',()=>{
 const r=check(snap(block()),snap(fence()),evt());
 assert.equal(r.canonicalPrivacyVetoObserved,true);
 for(const x of ['productionAuthorized','storageWriteAuthorized','allWritersDrained','deletionAcknowledged']) assert.equal(r[x],false);
 assert.equal(Object.isFrozen(r),true);
});
test('missing or malformed canonical documents reject',()=>{
 assert.throws(()=>check({exists:false},snap(fence()),evt()),{message:DENIED});
 assert.throws(()=>check(snap(block()),{exists:false},evt()),{message:DENIED});
 assert.throws(()=>check(snap(block()),{exists:true,data:()=>undefined},evt()),{message:DENIED});
});
test('wrong owner, purpose, event, status or inactive block reject',()=>{
 for(const patch of [{active:false},{ownerUid:'owner2'},{purpose:'other'},{eventId:'revocation-old'},
 {status:'pending'},{consumerId:'other'},{integrityHash:'invalid'}])deny({...block(),...patch});
});
test('canonical fence epoch and metadata do not grant permission',()=>{
 for(const patch of [{phase:'OPEN'},{epoch:0},{epoch:'2'},{eventId:'old'},
 {legacyLineageUnverified:false},{storageWriteAuthorized:true},{storageWriteFenceVerified:true},
 {allWritersDrained:true},{privateOutputDeletionAcknowledged:true}])deny(block(),{...fence(),...patch});
});
test('accessor and thrown getters do not leak values or produce authorization',()=>{
 const b=block(); Object.defineProperty(b,'active',{get(){throw new Error('sensitive-credential')}});
 deny(b); const f=fence(); Object.defineProperty(f,'eventId',{get(){throw new Error('another-secret')}});
 deny(block(),f);
});
test('event spoofing or forged owner always denies',()=>{
 deny(block(),fence(),{...evt(),ownerUid:'owner2'});
 deny(block(),fence(),{...evt(),eventId:'revocation-wrong'});
 deny(block(),fence(),{...evt(),purpose:'other'});
});
test('no user-supplied synthetic green booleans grant deletion',()=>{
 const b={...block(),releaseApproved:true},f={...fence(),green:true};
 const r=check(snap(b),snap(f),evt());
 assert.equal(r.productionAuthorized,false);assert.equal(r.deletionAcknowledged,false);
});
