import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextPrivateOutputFence,privateOutputFenceId,PRIVATE_OUTPUT_FENCE_DENIED,PRIVATE_OUTPUT_FENCE_COLLECTION} from '../functions/src/privacy/privateOutputRevocationFence.ts';
const event=(eventId='event1',ownerUid='owner1',purpose='life-movie.render')=>({eventId,ownerUid,purpose});
const context=(replay=false,priorBlockExists=false,priorBlock=undefined)=>({replay,priorBlockExists,priorBlock});
const first=()=>nextPrivateOutputFence(undefined,event(),context());
const newer=(prev,previousEventId='event1')=>nextPrivateOutputFence(prev,event('event2'),context(false,true,{eventId:previousEventId,ownerUid:'owner1',purpose:'life-movie.render',active:true}));
const denied=(fn)=>assert.throws(fn,{message:PRIVATE_OUTPUT_FENCE_DENIED});
test('first authenticated event creates a deny-by-default revocation epoch',()=>{
 const x=first();assert.equal(x.kind,'create');assert.equal(x.state.epoch,1);
 for(const k of ['storageWriteAuthorized','storageWriteFenceVerified','allWritersDrained','privateOutputDeletionAcknowledged']) assert.equal(x.state[k],false);
 assert.equal(x.state.phase,'FENCING');assert.equal(x.state.legacyLineageUnverified,true);
});
test('historical replay with missing fence marks lineage unverified',()=>{
 const x=nextPrivateOutputFence(null,event(),context(true,true,{}));
 assert.equal(x.kind,'create');assert.equal(x.state.legacyLineageUnverified,true);
});
test('new revocation with prior block and missing fence never infers clean history',()=>{
 const x=nextPrivateOutputFence(null,event('event2'),context(false,true,{}));
 assert.equal(x.state.legacyLineageUnverified,true);
});
test('exact replay never increments epoch',()=>assert.deepEqual(nextPrivateOutputFence(first().state,event(),context(true,true,{})),{kind:'replay'}));
test('newer event increments epoch only with matching previous block',()=>{
 const x=newer(first().state);assert.equal(x.kind,'update');assert.equal(x.state.epoch,2);
 assert.equal(x.state.eventId,'event2');assert.equal(x.state.storageWriteAuthorized,false);
});
test('sequential newer events preserve legacy uncertainty',()=>{
 const legacy=nextPrivateOutputFence(null,event(),context(true,true,{})).state;
 const x=newer(legacy);assert.equal(x.state.legacyLineageUnverified,true);
});
test('different event cannot masquerade as replay',()=>denied(()=>nextPrivateOutputFence(first().state,event('event2'),context(true,true,{}))));
test('prior consent block must match the stored epoch event',()=>{
 denied(()=>newer(first().state,'unknown'));denied(()=>nextPrivateOutputFence(first().state,event('event2'),context()));
});
test('owner and purpose mismatch never carry an epoch between scopes',()=>{
 denied(()=>nextPrivateOutputFence(first().state,event('event2','other'),context(false,true,{})));
 denied(()=>nextPrivateOutputFence(first().state,event('event2','owner1','another'),context(false,true,{})));
});
test('malformed and externally asserted authority fields never upgrade fence',()=>{
 for(const field of ['storageWriteAuthorized','storageWriteFenceVerified','allWritersDrained','privateOutputDeletionAcknowledged'])
  denied(()=>nextPrivateOutputFence({...first().state,[field]:true},event(),context(true,true,{})));
 for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER])
  denied(()=>nextPrivateOutputFence({...first().state,epoch:value},event(),context(true,true,{})));
 denied(()=>nextPrivateOutputFence({...first().state,phase:'OPEN'},event(),context(true,true,{})));
});
test('owner-purpose stable digest avoids cross-owner collision',()=>{
 assert.equal(privateOutputFenceId('owner1','life-movie.render'),privateOutputFenceId('owner1','life-movie.render'));
 assert.notEqual(privateOutputFenceId('owner1','life-movie.render'),privateOutputFenceId('owner2','life-movie.render'));
 assert.match(privateOutputFenceId('owner1','life-movie.render'),/^[0-9a-f]{64}$/);
});
test('original source transaction reads both records before writes; storage authority remains off',()=>{
 const endpoint=readFileSync(new URL('../functions/src/privacy/consentRevocation.ts',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../workers/studio-worker/private-output-write-authority.js',import.meta.url),'utf8');
 assert.match(endpoint,/const outputFenceSnap = outputFenceRef \? await transaction\.get\(outputFenceRef\)/);
 assert.match(endpoint,/nextPrivateOutputFence\(outputFenceSnap\.data\(\)/);
 assert.match(endpoint,/transaction\.create\(outputFenceRef/);
 assert.match(endpoint,/transaction\.update\(outputFenceRef/);
 assert.ok(endpoint.indexOf('const outputFenceSnap =')<endpoint.indexOf('transaction.set(blockRef'));
 assert.match(worker,/return false;/);
 assert.equal(PRIVATE_OUTPUT_FENCE_COLLECTION,'lifeMoviePrivateOutputRevocationFences');
});

test('R1028: server fence refuses extra authority aliases and prototype manipulation',()=>{
 const state=first().state;
 for(const key of ['authorized','storageWriteEnabled','providerProofAuthenticated',
   'releaseAuthorized','deletionAcknowledged','extraEventId']) {
   denied(()=>nextPrivateOutputFence({...state,[key]:true},event(),context(true,true,{})));
 }
 const forged=Object.create({storageWriteAuthorized:true});
 Object.assign(forged,state);
 denied(()=>nextPrivateOutputFence(forged,event(),context(true,true,{})));
 const accessor={...state};
 Object.defineProperty(accessor,'unexpectedPrivilege',{get(){throw new Error('getter should not run');},enumerable:true});
 denied(()=>nextPrivateOutputFence(accessor,event(),context(true,true,{})));
});
test('R1028: missing mandatory persisted fence fields always fail closed',()=>{
 for(const key of Object.keys(first().state)) {
   const state={...first().state};delete state[key];
   denied(()=>nextPrivateOutputFence(state,event(),context(true,true,{})));
 }
});
test('R1028: malformed event scope and hidden identity separators fail closed',()=>{
 const bad=['','owner/other',' owner','owner\nother','owner\rmore',
   'owner\\other','other\u0000owner','👁'];
 for(const owner of bad) {
   denied(()=>nextPrivateOutputFence(undefined,event('event1',owner),context()));
 }
 for(const e of bad) denied(()=>nextPrivateOutputFence(undefined,event(e),context()));
});
test('R1028: legitimate timestamp metadata never confers authority',()=>{
 const state={...first().state,createdAt:{_seconds:123,_nanoseconds:0},
   updatedAt:{_seconds:124,_nanoseconds:0}};
 const x=nextPrivateOutputFence(state,event(),context(true,true,{}));
 assert.deepEqual(x,{kind:'replay'});
});

test('R1028: cross-realm Firestore-like plain documents preserve exact replay',async()=>{
 const vm=await import('node:vm');
 const state=vm.runInNewContext('({...source})',{source:first().state});
 const result=nextPrivateOutputFence(state,event(),context(true,true,{}));
 assert.deepEqual(result,{kind:'replay'});
});
test('R1028: forged getter under an allowed field cannot confer authority',()=>{
 const state={...first().state};
 Object.defineProperty(state,'createdAt',{get(){throw new Error('untrusted getter executed');},enumerable:true});
 denied(()=>nextPrivateOutputFence(state,event(),context(true,true,{})));
});


test('R1033: first revocation without prior Jobs consent block retains unknown historical Storage lineage',()=>{
  const x=nextPrivateOutputFence(undefined,event('untracked-preexisting-object'),context(false,false,undefined));
  assert.equal(x.kind,'create');
  assert.equal(x.state.legacyLineageUnverified,true);
  for(const key of ['storageWriteAuthorized','storageWriteFenceVerified','allWritersDrained','privateOutputDeletionAcknowledged']) {
    assert.equal(x.state[key],false);
  }
  const y=nextPrivateOutputFence(x.state,event('event2'),context(false,true,{eventId:'untracked-preexisting-object',ownerUid:'owner1',purpose:'life-movie.render',active:true}));
  assert.equal(y.kind,'update');
  assert.equal(y.state.legacyLineageUnverified,true);
});
