/**
 * R900 independent safety-negative test against the EXACT original Jobs R898
 * TypeScript executor, core role wrapper, and current-owner helper.
 * All provider modules and Firestore/GCS are in-memory substitutes. Never runs
 * with Firebase credentials, IAM, real user data, or real cloud resources.
 * Security requirement cases intentionally FAIL against current source;
 * diagnostic cases prove what the original code does, not safety compliance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const requireFunctions=createRequire(new URL('../functions/package.json', import.meta.url));
const ts=requireFunctions('typescript');
const repo=new URL('../',import.meta.url);
const file=p=>fileURLToPath(new URL(p,repo));
const source=p=>readFileSync(file(p),'utf8');
const blob=p=>execFileSync('git',['hash-object',file(p)],{encoding:'utf8'}).trim();
const ORIGINAL_SHA={
 'functions/src/privacy/dataRightsExecution.ts':'7109247526da10725aaba8bef1a4e9c3bba1c86e',
 'functions/src/jobs/currentJobCallerAuthority.ts':'b791017fcb291e8a793b2b85fa9ee37991277c9d',
 'functions/src/core/auth.ts':'434ffe34830d9e4db745ac51c18ff1615cf9d533',
};
function compile(path,stubs){
 const r=ts.transpileModule(source(path),{fileName:file(path),reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const errors=(r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,`Original TS must transpile: ${path}`);
 const mod={exports:{}};
 new Function('require','module','exports',r.outputText)(name=>{
  if(!Object.hasOwn(stubs,name))throw Error(`Unexpected dependency: ${name} from ${path}`);
  return stubs[name];
 },mod,mod.exports);
 return mod.exports;
}
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const httpsError=(code,message)=>new HttpsError(code,message);
const field=(kind,choices)=>{const out={kind,choices};for(const method of ['trim','min','max','regex','optional','default','int'])out[method]=function(v){if(method==='optional')this.isOptional=true;if(method==='default')this.defaultVal=v;if(method==='min')this.minVal=v;if(method==='max')this.maxVal=v;if(method==='regex')this.pattern=v;return this;};return out;};
const z={string:()=>field('string'),number:()=>field('number'),enum:choices=>field('enum',choices),object:fields=>({strict(){return this;},safeParse(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {success:false,error:{flatten:()=>({})}};
 const d={...value};if(Object.keys(d).some(k=>!Object.hasOwn(fields,k)))return {success:false,error:{flatten:()=>({})}};
 for(const [key,f] of Object.entries(fields)){
  let v=d[key];if(v===undefined&&Object.hasOwn(f,'defaultVal')){v=f.defaultVal;d[key]=v;}
  if(v===undefined&&f.isOptional)continue;
  if(v===undefined || (f.kind==='string'&&typeof v!=='string') || (f.kind==='enum'&&!f.choices.includes(v)) ||(f.kind==='number'&&typeof v!=='number'))return {success:false,error:{flatten:()=>({})}};
  if(f.kind==='string'){
   if(f.minVal!==undefined&&v.length<f.minVal)return {success:false,error:{flatten:()=>({})}};
   if(f.maxVal!==undefined&&v.length>f.maxVal)return {success:false,error:{flatten:()=>({})}};
   if(f.pattern&&!f.pattern.test(v))return {success:false,error:{flatten:()=>({})}};
  }
 }
 return {success:true,data:d};
 }})};
const helper=compile('functions/src/jobs/currentJobCallerAuthority.ts',{});
const id='request-r900-0001',ret='retention-r900-0001',idem='execution-r900-0001';
const auth={uid:'operator-r900',token:{role:'operator'}};
const active={uid:'operator-r900',role:'operator',accountStatus:'active',disabled:false,tenantId:'synthetic-tenant',orgId:'synthetic-org'};
const owner={uid:'owner-r900',role:'user',accountStatus:'active',disabled:false};
function snapshot(path,value){return {id:path.split('/').at(-1),exists:value!==null&&value!==undefined,data:()=>value,ref:{path}};}
function makeState({requestType='EXPORT',requestStatus='APPROVED',retention=ret,entryOperator=active,transOperator=entryOperator,afterAdmission=()=>{},priorExecution=null,ownerExists=true}={}){
 const state={events:[],gcsWrites:[],operatorAtWrapper:entryOperator,operatorAtTx:transOperator,operatorAfterTx:transOperator,ownerDoc:ownerExists?{...owner}:null,request:{requestId:id,ownerUid:'owner-r900',requestType,status:requestStatus,retentionDecisionReceiptId:retention},priorExecution,afterAdmission,executionReceipt:null};
 const ref=(kind,id,parent=null)=>({kind,id,path:parent?`${parent}/${id}`:`${kind}/${id}`,
   collection(child){if(kind!=='dataRightsRequests'||child!=='audit')throw Error('unexpected nested collection');return {doc:childId=>ref('audit',childId,`dataRightsRequests/${id}/audit`)};},
   async get(){
    state.events.push(`GET:${kind}`);
    if(kind==='users')return snapshot(this.path,id==='operator-r900'?state.operatorAtWrapper:state.ownerDoc);
    if(kind==='dataRightsRequests')return snapshot(this.path,state.request);
    if(kind==='audit')return snapshot(this.path,state.priorExecution);
    throw Error('Unexpected get '+kind);
   },
   async set(value,opts){state.events.push(`SET:${kind}`);if(kind==='audit')state.executionReceipt={...(state.executionReceipt||{}),...value};else if(kind==='dataRightsRequests')Object.assign(state.request,value);else if(kind==='users')Object.assign(state.ownerDoc,value);else throw Error('Unexpected set '+kind);}
 });
 const jobsQuery={kind:'jobsQuery',where(field,op,value){assert.equal(field,'ownerUid');assert.equal(op,'==');assert.equal(value,'owner-r900');return this;},orderBy(){return this;},limit(){return this;},async get(){state.events.push('JOBS_QUERY');return {size:0,docs:[]}}};
 const db={
  collection(kind){return kind==='jobs'?jobsQuery:{doc:id=>ref(kind,id)};},
  async runTransaction(handler){
   state.events.push('TX_BEGIN');const writes=[];
   const tx={async get(r){state.events.push(`TX_GET:${r.kind}:${r.id}`);
    if(r.kind==='users')return snapshot(r.path,r.id==='operator-r900'?state.operatorAtTx:state.ownerDoc);
    if(r.kind==='dataRightsRequests')return snapshot(r.path,state.request);
    if(r.kind==='audit')return snapshot(r.path,state.priorExecution);
    throw Error('Unexpected transaction read '+r.kind);
   },create(r,value){writes.push({r,kind:'create',value});},set(r,value){writes.push({r,kind:'set',value});}};
   const result=await handler(tx);
   for(const w of writes){state.events.push(`TX_${w.kind.toUpperCase()}:${w.r.kind}`);
    if(w.r.kind==='audit')state.priorExecution=w.value;
    else if(w.r.kind==='dataRightsRequests')state.request={...state.request,...w.value};
    else if(w.r.kind==='users')state.ownerDoc={...state.ownerDoc,...w.value};
    else throw Error('Unexpected tx write');}
   state.events.push('TX_COMMIT');state.afterAdmission(state);return result;
  },
 };
 return{state,db};
}
let fixture;
const authModule=compile('functions/src/core/auth.ts',{
 'firebase-functions/v1':{https:{onCall:fn=>fn}},
 './errors.js':{httpsError},
 './firestore-paths.js':{userDoc:uid=>fixture.db.collection('users').doc(uid)}
});
const fields={serverTimestamp:()=>({toDate:()=>new Date('2026-11-08T20:00:00Z')}),delete:()=>({syntheticDelete:true})};
const executor=compile('functions/src/privacy/dataRightsExecution.ts',{
 'node:crypto':require('node:crypto'),
 'firebase-admin/firestore':{getFirestore:()=>fixture.db,FieldValue:fields,FieldPath:{documentId:()=>('__name__')}},
 'zod':{z},
 '../core/auth.js':authModule,
 '../core/errors.js':{httpsError},
 '../jobs/currentJobCallerAuthority.js':helper,
 '../core/gcs.js':{uploadToGcs:async(bytes,dest,type)=>{fixture.state.events.push('GCS_WRITE_STUB');fixture.state.gcsWrites.push({bytes:bytes.length,dest,type,operator:{...fixture.state.operatorAfterTx}});return `gs://demo-r900-isolated/${dest}`;}}
});
const cleanEnv=['URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE','GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT','URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED','GCS_BUCKET_NAME'];
const previous=Object.fromEntries(cleanEnv.map(k=>[k,process.env[k]]));
process.env.URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE='protected-staging';
process.env.GCLOUD_PROJECT='demo-r900-isolated';
process.env.URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT='demo-r900-isolated';
process.env.GCS_BUCKET_NAME='demo-r900-isolated';
delete process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED;
process.once('exit',()=>{for(const k of cleanEnv)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];});
const input={requestId:id,retentionDecisionReceiptId:ret,idempotencyKey:idem};
const call=opts=>{fixture=makeState(opts);return executor.processDataRightsRequest(input,{auth});};
const denied=e=>e?.code==='permission-denied';

test('R900 exact original Git blobs',()=>{for(const [p,s] of Object.entries(ORIGINAL_SHA))assert.equal(blob(p),s,p);});
test('R900 original source TypeScript transpiles using real TypeScript 5.8',()=>{assert.equal(typeof executor.processDataRightsRequest,'function');});
test('R900 positive synthetic approved operator export remains Jobs-scope only',async()=>{
 const result=await call();assert.equal(result.replay,false);assert.equal(fixture.state.gcsWrites.length,1);
 assert.equal(result.receipt.terminalState,'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED');
 assert.equal(result.receipt.result.payload.completeEcosystemExport,false);
 assert.deepEqual(result.receipt.result.payload.unresolvedDomains.sort(),[
 'firebase-auth-account','provider-side-derivatives','external-artifacts-not-bound-to-jobs-storage','cross-system-data-owned-by-other-urai-services'].sort());
});
test('R900 disabled operator before transaction denied without GCS effect',async()=>{
 fixture=makeState({transOperator:{...active,disabled:true}});
 await assert.rejects(()=>executor.processDataRightsRequest(input,{auth}),denied);
 assert.equal(fixture.state.gcsWrites.length,0);assert.equal(fixture.state.events.includes('TX_COMMIT'),false);
});
test('R900 removed operator role inside transaction denied without GCS effect',async()=>{
 fixture=makeState({transOperator:{...active,role:'user'}});
 await assert.rejects(()=>executor.processDataRightsRequest(input,{auth}),denied);
 assert.equal(fixture.state.gcsWrites.length,0);
});
test('R900 forged retention receipt rejected despite active operator',async()=>{
 fixture=makeState({retention:'different-from-claimed'});
 await assert.rejects(()=>executor.processDataRightsRequest(input,{auth}),e=>e?.code==='failed-precondition');
 assert.equal(fixture.state.gcsWrites.length,0);
});
test('R900 unapproved request rejected without output write',async()=>{
 fixture=makeState({requestStatus:'PENDING'});
 await assert.rejects(()=>executor.processDataRightsRequest(input,{auth}),e=>e?.code==='failed-precondition');
 assert.equal(fixture.state.gcsWrites.length,0);
});
test('R900 production authorization true is fail-closed',async()=>{
 process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED='true';
 try {fixture=makeState();await assert.rejects(()=>executor.processDataRightsRequest(input,{auth}),e=>e?.code==='failed-precondition');
  assert.equal(fixture.state.gcsWrites.length,0);}finally{delete process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED;}
});
test('R900 after admission role revocation STILL reaches synthetic GCS: security-negative observation',async()=>{
 const result=await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,role:'user'};s.events.push('REVOKE_ROLE_AFTER_TX');}});
 assert.equal(result.replay,false);
 assert.equal(fixture.state.gcsWrites.length,1);
 assert.ok(fixture.state.events.indexOf('TX_COMMIT')<fixture.state.events.indexOf('REVOKE_ROLE_AFTER_TX'));
 assert.ok(fixture.state.events.indexOf('REVOKE_ROLE_AFTER_TX')<fixture.state.events.indexOf('GCS_WRITE_STUB'));
 assert.equal(fixture.state.gcsWrites[0].operator.role,'user');
});
test('R900 after admission account disable STILL reaches synthetic GCS: security-negative observation',async()=>{
 await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,disabled:true};s.events.push('REVOKE_DISABLE_AFTER_TX');}});
 assert.equal(fixture.state.gcsWrites.length,1);assert.equal(fixture.state.gcsWrites[0].operator.disabled,true);
});
test('R900 after admission central deletion fence STILL reaches synthetic GCS: security-negative observation',async()=>{
 await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,dataRightsDeletionPendingCentralPrivacy:true};s.events.push('REVOKE_PRIVACY_FENCE_AFTER_TX');}});
 assert.equal(fixture.state.gcsWrites.length,1);assert.equal(fixture.state.gcsWrites[0].operator.dataRightsDeletionPendingCentralPrivacy,true);
});
test('R900 after admission role revocation STILL reaches Jobs-scope delete write: security-negative observation',async()=>{
 const result=await call({requestType:'DELETE',afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,role:'user'};s.events.push('REVOKE_ROLE_AFTER_TX');}});
 assert.equal(result.receipt.terminalState,'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED');
 assert.equal(fixture.state.gcsWrites.length,0);
 assert.ok(fixture.state.events.indexOf('REVOKE_ROLE_AFTER_TX')<fixture.state.events.indexOf('SET:users'));
 assert.equal(fixture.state.ownerDoc.dataRightsDeletionPendingCentralPrivacy,true);
});
console.log('R900: source-complete original Jobs TS, synthetic Firestore/Auth/GCS only; diagnostic negatives are NOT security passes.');

test('R900 SECURITY REQUIREMENT: revoked operator must not export after admission',async()=>{
 await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,role:'user'};s.events.push('REVOKE_ROLE_AFTER_TX');}});
 assert.equal(fixture.state.gcsWrites.length,0,'GCS export after operator revocation must be denied');
});
test('R900 SECURITY REQUIREMENT: disabled operator must not export after admission',async()=>{
 await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,disabled:true};s.events.push('REVOKE_DISABLE_AFTER_TX');}});
 assert.equal(fixture.state.gcsWrites.length,0,'GCS export after operator disable must be denied');
});
test('R900 SECURITY REQUIREMENT: Privacy deletion fence must block later export effect',async()=>{
 await call({afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,dataRightsDeletionPendingCentralPrivacy:true};s.events.push('REVOKE_PRIVACY_FENCE_AFTER_TX');}});
 assert.equal(fixture.state.gcsWrites.length,0,'GCS export after central Privacy fence must be denied');
});
test('R900 SECURITY REQUIREMENT: revoked operator must not perform later Jobs-scope delete',async()=>{
 await call({requestType:'DELETE',afterAdmission:s=>{s.operatorAtWrapper=s.operatorAtTx=s.operatorAfterTx={...active,role:'user'};s.events.push('REVOKE_ROLE_AFTER_TX');}});
 assert.equal(fixture.state.events.includes('SET:users'),false,'Jobs-scope cleanup after operator revocation must be denied');
});