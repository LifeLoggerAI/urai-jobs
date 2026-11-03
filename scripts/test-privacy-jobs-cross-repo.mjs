import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const privacyText = source('./fixtures/privacy-revocation-contract-65e7d7ec.ts');
const endpointText = source('../functions/src/privacy/consentRevocation.ts');
const orderText = source('../functions/src/privacy/consentRevocationOrder.ts');
const hashText = source('../functions/src/privacy/consentBlocks.ts');
function gitBlob(text, expected, label) {
  const bytes = Buffer.from(text);
  const actual = createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
  assert.equal(actual, expected, label + ' must match reviewed source');
}
gitBlob(privacyText, '6cca2b9456319927cf22511c7d51c1f16ddf051c', 'Privacy sender');
gitBlob(endpointText, 'bf8598710668e6ed0c533c58be9ce67bfaa3e289', 'Jobs receiver');
gitBlob(orderText, '33c71b71a7a505d17f8b5b51189573a954873593', 'Jobs ordering guard');
gitBlob(hashText, '8bd86161687402ebb610cc30f6677f88521c2c1c', 'Jobs canonical digest');
const transpile = (text) => {
  const compiled = ts.transpileModule(text, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}, reportDiagnostics:true});
  assert.equal(compiled.diagnostics?.length, 0);
  return compiled.outputText;
};
function sourceFunction(text, name, variable) {
  const file = ts.createSourceFile(name + '.ts', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  for (const statement of file.statements) {
    if (!variable && ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement.getText(file);
    if (variable && ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations)
      if (decl.name.getText(file) === name) return decl.initializer.getText(file);
  }
  throw new Error('Missing source function: ' + name);
}
function execute(code, context={}) {
  const exports = {};
  vm.runInNewContext(transpile(code), {exports,require,Buffer,Date,URL,AbortSignal,TextDecoder,Response,fetch,process,Promise,Array,Object,String,Number,Error,RegExp,Set,createHash,timingSafeEqual,...context});
  return exports;
}
const privacy = execute(privacyText);
const order = execute(orderText);
const digest = execute(sourceFunction(hashText, 'canonicalSourceRevocationAckHash', false) +
  '\nexports.hash = canonicalSourceRevocationAckHash;').hash;
const handler = sourceFunction(endpointText, 'ingestConsentRevocation', true);
assert.ok(handler.startsWith('onRequest('));
const compiledHandler = transpile('exports.handler = ' + handler + ';');
const hash = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

function makeEvent({uid='synthetic-1',purpose='life-movie.render',createdAt='2026-11-03T05:00:00.000Z',policyVersion='p1'}={}) {
  const recordId = uid + '_' + purpose.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fields = {schemaVersion:'consent.revoked.v1',consentRecordId:recordId,uid,purpose,consentTier:'C1',
    policyVersion,sourceReceiptHash:'a'.repeat(64),status:'pending',createdAt:{toDate:()=>new Date(createdAt)}};
  const eventId = hash({schemaVersion:fields.schemaVersion,recordId,uid,purpose,consentTier:'C1',
    policyVersion,receiptHash:fields.sourceReceiptHash});
  const row = {...fields,eventId,integrityHash:hash({eventId,recordId,uid,purpose})};
  return privacy.buildJobsRevocationEventV2(eventId,row);
}

const HOST = 'us-central1-urai-jobs.cloudfunctions.net';
const TOKEN = 'T'.repeat(64);
function harness({existingBlock=null,failOnce=false,tamperAck=false}={}) {
  const data = new Map();
  const DELETE = Symbol('field-delete');
  if (existingBlock) data.set('block',existingBlock);
  let failures=failOnce?1:0, cleanup=0, receipts=0;
  const receiptRef={id:'receipt',async set(fields){data.set('receipt',{...data.get('receipt'),...fields})}};
  const firestore={async runTransaction(callback){
    const writes=[];
    const tx={
      async get(ref){const row=data.get(ref.id);return {exists:row!==undefined,data:()=>row}},
      set(ref,row,options){writes.push({type:'set',ref,row,options})},
      create(ref,row){writes.push({type:'create',ref,row})}
    };
    const result=await callback(tx);
    for (const w of writes) {
      if (w.type==='create') {
        assert.equal(data.has(w.ref.id),false,'receipt must not be created twice');
        receipts++;
      }
      const updated=w.options?.merge?{...data.get(w.ref.id),...w.row}:{...w.row};
      for (const [key,value] of Object.entries(updated)) if(value===DELETE) delete updated[key];
      data.set(w.ref.id,updated);
    }
    return result;
  }};
  const exports={};
  const context={exports,console:{error:()=>{}},process,Error,Set,String,Promise,Date,Object,createHash,timingSafeEqual,
    onRequest:(_opts,callback)=>callback, privacyEventToken:{value:()=>TOKEN}, expectedBearer:()=>TOKEN, getFirestore:()=>firestore,
    consentBlockRef:()=>({id:'block'}),consentEventReceiptRef:()=>receiptRef,
    canonicalSourceRevocationAckHash:digest,canonicalConsentAckHash:digest,
    mayApplyNewConsentRevocation:order.mayApplyNewConsentRevocation,
    FieldValue:{serverTimestamp:()=> 'server-time',delete:()=>DELETE},
    ConsentRevokedEventSchema:{safeParse:(input)=>{
      const required=['type','eventId','ownerUid','purpose','policyVersion','correlationId','revokedAt','sourceReceiptHash'];
      const valid=input?.type==='consent.revoked.v2'&&required.every(k=>typeof input[k]==='string'&&input[k]) &&
        input.correlationId==='revocation:'+input.eventId;
      return valid?{success:true,data:input}:{success:false};
    }},
    invalidateLifeMovieDerivativesForConsent:async e=>{
      cleanup++;
      if(failures-->0)throw new Error('simulated transient Storage failure');
      return {purpose:e.purpose,jobsScanned:e.purpose==='life-movie.render'?2:0,
        jobsInvalidated:e.purpose==='life-movie.render'?1:0,plansInvalidated:0,storageObjectsDeleted:cleanup===1?2:0};
    }
  };
  vm.runInNewContext(compiledHandler,context);
  async function mockedTransport(url,options) {
    assert.equal(url,'https://'+HOST+'/ingestConsentRevocation');
    assert.equal(options.method,'POST');
    const result={code:500,body:null,status(code){this.code=code;return this},json(body){this.body=body;return this}};
    await exports.handler({method:options.method,headers:{authorization:options.headers.authorization},body:JSON.parse(options.body)},result);
    if (tamperAck && result.code===200)
      result.body={...result.body,acknowledgement:{...result.body.acknowledgement,sourceReceiptHash:'f'.repeat(64)}};
    return new Response(JSON.stringify(result.body),{status:result.code,headers:{'content-type':'application/json'}});
  }
  const send=(event,token=TOKEN)=>privacy.sendJobsRevocationEvent(event,{
    endpoint:'https://'+HOST+'/ingestConsentRevocation',expectedHost:HOST,bearerToken:token,request:mockedTransport
  });
  return {send,data,get cleanup(){return cleanup},get receipts(){return receipts}};
}

test('Privacy v1 event reaches actual Jobs handler and passes two canonical hash implementations',async()=>{
  const env=harness(),event=makeEvent();
  const receipt=await env.send(event);
  assert.equal(receipt.acknowledgementHash,digest({...event,status:'blocked'}));
  assert.equal(receipt.acknowledgementHash,privacy.jobsRevocationAckHash(event));
  assert.equal(env.data.get('block').eventId,event.eventId);
  assert.equal(env.data.get('block').active,true);
  assert.equal(env.receipts,1);
});
test('lost response retry returns same authenticated receipt and no duplicate event record',async()=>{
  const env=harness(),event=makeEvent();
  const before=await env.send(event),after=await env.send(event);
  assert.equal(before.acknowledgementHash,after.acknowledgementHash);
  assert.equal(env.cleanup,2);
  assert.equal(env.receipts,1);
});
test('transient cleanup failure returns failure, then replays the exact receipt and completes',async()=>{
  const env=harness({failOnce:true}),event=makeEvent();
  await assert.rejects(env.send(event),/PRIVACY_JOBS_DELIVERY_UNCONFIRMED/);
  assert.equal(env.data.get('block').active,true);
  const applied=await env.send(event);
  assert.equal(applied.eventId,event.eventId);
  assert.equal(env.receipts,1);
  assert.equal(env.cleanup,2);
});
test('older delivery cannot replace newer revocation',async()=>{
  const env=harness(),newer=makeEvent({policyVersion:'p2',createdAt:'2026-11-03T06:00:00.000Z'});
  const older=makeEvent({policyVersion:'p1'});
  await env.send(newer);
  await assert.rejects(env.send(older),/PRIVACY_JOBS_DELIVERY_UNCONFIRMED/);
  assert.equal(env.data.get('block').eventId,newer.eventId);
});
test('wrong bearer cannot install a consent block',async()=>{
  const env=harness(),event=makeEvent();
  await assert.rejects(env.send(event,'Q'.repeat(64)),/PRIVACY_JOBS_DELIVERY_UNCONFIRMED/);
  assert.equal(env.data.has('block'),false);
});
test('tampering with consumer receipt cannot complete Privacy delivery',async()=>{
  const env=harness({tamperAck:true});
  await assert.rejects(env.send(makeEvent()),/PRIVACY_JOBS_ACK_NOT_VERIFIED/);
});
test('existing block belonging to another owner must not be replaced',async()=>{
  const other={active:true,ownerUid:'other',purpose:'life-movie.render',eventId:'x'.repeat(64),
    revokedAt:'2026-11-03T04:00:00.000Z'};
  const env=harness({existingBlock:other});
  await assert.rejects(env.send(makeEvent()),/PRIVACY_JOBS_DELIVERY_UNCONFIRMED/);
  assert.equal(env.data.get('block').ownerUid,'other');
});
