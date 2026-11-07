import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { mayApplyNewConsentRevocation } from '../functions/src/privacy/consentRevocationOrder.ts';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(new URL('../functions/src/privacy/consentRevocation.ts', import.meta.url), 'utf8');
const sf = ts.createSourceFile('consentRevocation.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
let initializer = '';
for (const statement of sf.statements) if (ts.isVariableStatement(statement))
  for (const item of statement.declarationList.declarations)
    if (item.name.getText(sf) === 'ingestConsentRevocation') initializer = item.initializer.getText(sf);
assert.ok(initializer.startsWith('onRequest('), 'Must execute original HTTP handler callback');
const output = ts.transpileModule('exports.endpoint = ' + initializer + ';', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true
});
assert.equal(output.diagnostics?.length,0);
const event = {type:'consent.revoked.v2',eventId:'b'.repeat(64),ownerUid:'owner-1',purpose:'life-movie.render',policyVersion:'p1',correlationId:'revocation:'+'b'.repeat(64),revokedAt:'2026-11-03T05:00:00.000Z',sourceReceiptHash:'a'.repeat(64)};
const block=(overrides={})=>({active:true,eventId:'a'.repeat(64),ownerUid:event.ownerUid,purpose:event.purpose,policyVersion:'p0',revokedAt:'2026-11-03T04:00:00.000Z',...overrides});
function instantiate(existingBlock) {
  const records=new Map();if(existingBlock!==null)records.set('block',existingBlock);
  const DELETED=Symbol('FIRESTORE_FIELD_DELETE');
  const touched=[];let invalidationCalls=0;let cleanupFailuresLeft=0;
  const receiptRef={id:'receipt',async set(value){
    touched.push({kind:'receiptSet',value});
    const merged={...records.get('receipt'),...value};
    // Mirror Firestore set(..., {merge:true}) FieldValue.delete() semantics.
    for(const [key,item] of Object.entries(merged))if(item===DELETED)delete merged[key];
    records.set('receipt',merged);
  }};
  const db={async runTransaction(callback){
    const writes=[];
    const transaction={async get(ref){let data=records.get(ref.id);return {exists:data!==undefined,data:()=>data};},
      set(ref,value,options){writes.push({kind:'set',ref,value,options});},
      create(ref,value){writes.push({kind:'create',ref,value});}};
    const outcome=await callback(transaction);
    for(const w of writes){
      touched.push(w);
      if(w.kind==='set'){
        const record=w.options?.merge?{...records.get(w.ref.id),...w.value}:{...w.value};
        for(const [key,value] of Object.entries(record)) if(value===DELETED)delete record[key];
        records.set(w.ref.id,record);
      }else records.set(w.ref.id,w.value);
    }
    return outcome;
  }};
  const exp={};
  const context={exports:exp,process,console,Error,Set,String,Promise,Date,Object,createHash,timingSafeEqual,
    privacyEventToken:{value:()=> 'secret'},onRequest:(_options,handler)=>handler,
    expectedBearer:()=> 'secret', getFirestore:()=>db,
    consentBlockRef:()=>({id:'block'}), consentEventReceiptRef:()=>receiptRef,
    canonicalSourceRevocationAckHash:()=> 'ackhash', canonicalConsentAckHash:()=> 'ackhash',
    FieldValue:{serverTimestamp:()=> 'server-time',delete:()=>DELETED},
    ConsentRevokedEventSchema:{safeParse:()=>({success:true,data:event})},
    mayApplyNewConsentRevocation,
    invalidateLifeMovieDerivativesForConsent:async()=>{invalidationCalls++;if(cleanupFailuresLeft>0){cleanupFailuresLeft--;throw new Error('synthetic cleanup failure');}return {purpose:event.purpose,jobsScanned:0,jobsInvalidated:0,plansInvalidated:0,storageObjectsDeleted:0};}
  };
  vm.runInNewContext(output.outputText,context);
  async function invoke(){
    const result={statusCode:null,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await exp.endpoint({method:'POST',headers:{authorization:'Bearer secret'},body:event},result);
    return result;
  }
  return {invoke,records,touched,failNextCleanup(){cleanupFailuresLeft++;},get invalidationCalls(){return invalidationCalls;}};
}
test('new event cannot overwrite newer active revocation or run derivative cleanup',async()=>{
  const h=instantiate(block({eventId:'z'.repeat(64),revokedAt:'2026-11-03T06:00:00.000Z'}));
  const result=await h.invoke();assert.equal(result.statusCode,409);assert.equal(h.touched.length,0);assert.equal(h.invalidationCalls,0);
});
test('new event cannot overwrite an existing grant-cleared boundary',async()=>{
  const h=instantiate(block({active:false}));const result=await h.invoke();
  assert.equal(result.statusCode,409);assert.equal(h.touched.length,0);assert.equal(h.invalidationCalls,0);
});
test('newer event commits consent block and succeeds after derivative invalidation',async()=>{
  const h=instantiate(block());const result=await h.invoke();
  assert.equal(result.statusCode,200);assert.equal(result.body.ok,true);
  assert.equal(h.records.get('block').eventId,event.eventId);assert.equal(h.invalidationCalls,1);
  assert.ok(h.touched.some(x=>x.kind==='create'&&x.ref.id==='receipt'));
});
test('first event can create initial revocation block',async()=>{
  const h=instantiate(null);const result=await h.invoke();
  assert.equal(result.statusCode,200);assert.equal(h.records.get('block').active,true);
});

test('malformed prior calendar date cannot authorize a newer event through the real guard', async()=>{
  const h=instantiate(block({revokedAt:'2026-02-31T04:00:00.000Z'}));
  const result=await h.invoke();
  assert.equal(result.statusCode,409);
  assert.equal(h.touched.length,0);
  assert.equal(h.invalidationCalls,0);
});
test('same-time competing event cannot replace current revocation even with different id', async()=>{
  const h=instantiate(block({revokedAt:event.revokedAt}));
  const result=await h.invoke();
  assert.equal(result.statusCode,409);
  assert.equal(h.touched.length,0);
  assert.equal(h.invalidationCalls,0);
});

test('failed derivative invalidation does not claim success, replay repairs without replacing the receipt',async()=>{
  const h=instantiate(null);h.failNextCleanup();
  const first=await h.invoke();
  assert.equal(first.statusCode,500);
  assert.equal(first.body.ok,false);
  assert.equal(first.body.error,'derivative-invalidation-failed');
  assert.equal(h.records.get('block').active,true,'revocation veto must remain active');
  assert.equal(h.touched.filter(x=>x.kind==='create'&&x.ref.id==='receipt').length,1);
  const second=await h.invoke();
  assert.equal(second.statusCode,200);
  assert.equal(second.body.ok,true);
  assert.equal(h.invalidationCalls,2,'cleanup must run again after a transient failure');
  assert.equal(h.touched.filter(x=>x.kind==='create'&&x.ref.id==='receipt').length,1,'replay must not create another event receipt');
});

test('successful event replay re-runs idempotent cleanup without overwriting the block',async()=>{
  const h=instantiate(null);
  const first=await h.invoke();
  assert.equal(first.statusCode,200);
  const block=h.records.get('block');
  const result=await h.invoke();
  assert.equal(result.statusCode,200);
  assert.equal(h.records.get('block'),block,'retry must keep exact existing block');
  assert.equal(h.invalidationCalls,2,'cleanup should be retryable after a lost response');
  assert.equal(h.touched.filter(x=>x.kind==='create'&&x.ref.id==='receipt').length,1);
});


test('R855: consent BLOCKED receipt never implies private derivative deletion complete',async()=>{
  const h=instantiate(null);
  const response=await h.invoke();
  assert.equal(response.statusCode,200);
  assert.equal(response.body.ok,true);
  assert.equal(response.body.acknowledgement.status,'blocked');
  assert.equal(response.body.acknowledgement.privateOutputDeletionAcknowledged,false);
  assert.equal(response.body.acknowledgement.storageWriteFenceVerified,false);
  assert.equal(response.body.acknowledgement.derivativeInvalidationStatus,'STORAGE_WRITE_FENCE_UNVERIFIED');
  assert.equal(Object.hasOwn(response.body.acknowledgement,'derivativeInvalidationCompletedAt'),false);
  const receipt=h.records.get('receipt');
  assert.equal(receipt.privateOutputDeletionAcknowledged,false);
  assert.equal(receipt.storageWriteFenceVerified,false);
  assert.equal(receipt.derivativeInvalidationStatus,'STORAGE_WRITE_FENCE_UNVERIFIED');
  assert.equal(receipt.derivativeInvalidationAttemptedAt,'server-time');
  assert.equal(Object.hasOwn(receipt,'derivativeInvalidationCompletedAt'),false);
  assert.equal(h.records.get('block').active,true);
});

test('R855: exact replay scrubs legacy false cleanup-complete field without deleting consent block',async()=>{
  const h=instantiate(null);
  assert.equal((await h.invoke()).statusCode,200);
  h.records.get('receipt').derivativeInvalidationCompletedAt='legacy-unsafe-success';
  const oldBlock=h.records.get('block');
  const result=await h.invoke();
  assert.equal(result.statusCode,200);
  assert.equal(h.records.get('block'),oldBlock);
  assert.equal(Object.hasOwn(h.records.get('receipt'),'derivativeInvalidationCompletedAt'),false);
  assert.equal(Object.hasOwn(result.body.acknowledgement,'derivativeInvalidationCompletedAt'),false);
  assert.equal(result.body.acknowledgement.privateOutputDeletionAcknowledged,false);
  assert.equal(h.invalidationCalls,2,'original retry cleanup still runs');
});

test('R855: transient cleanup failure cannot return a private deletion acknowledgement',async()=>{
  const h=instantiate(null);
  h.failNextCleanup();
  const response=await h.invoke();
  assert.equal(response.statusCode,500);
  assert.equal(h.records.get('block').active,true);
  assert.equal(response.body.acknowledgement.privateOutputDeletionAcknowledged,false);
  assert.equal(response.body.acknowledgement.storageWriteFenceVerified,false);
  assert.equal(Object.hasOwn(h.records.get('receipt'),'derivativeInvalidationCompletedAt'),false);
  assert.equal(Object.hasOwn(h.records.get('receipt'),'derivativeInvalidationAttemptedAt'),false);
});
