import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const base = new URL('../', import.meta.url);
const file = path => fileURLToPath(new URL(path, base));
const source = path => readFileSync(file(path), 'utf8');
function gitBlob(path) { return execFileSync('git', ['hash-object', file(path)], {encoding:'utf8'}).trim(); }
function moduleFromOriginal(path, stubs) {
  const transpiled=ts.transpileModule(source(path), {fileName:file(path), reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  const diagnostics=(transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
  assert.equal(diagnostics.length,0,`TS parse errors in ${path}`);
  const module={exports:{}};
  new Function('require','module','exports',transpiled.outputText)(name=>{
    if (!Object.prototype.hasOwnProperty.call(stubs,name)) throw Error(`Unexpected require ${name} in ${path}`);
    return stubs[name];
  },module,module.exports);
  return module.exports;
}
class HttpsError extends Error { constructor(code,msg){super(msg);this.code=code;} }
const httpsError=(code,msg)=>new HttpsError(code,msg);
const field=(type,choices)=>{
  const v={kind:type,choices};
  for(const method of ['trim','min','max','regex','optional','default','int']) v[method]=function(value){
    if(method==='default')v.defaultValue=value;
    else if(method==='min')v.minVal=value;
    else if(method==='max')v.maxVal=value;
    else if(method==='optional')v.isOptional=true;
    return v;
  };
  return v;
};
const z={
  string:()=>field('string'),number:()=>field('number'),enum:values=>field('enum',values),
  object:fields=>({strict(){return this;},safeParse(input){
    if(!input || typeof input!=='object' || Array.isArray(input))return {success:false,error:{flatten:()=>({})}};
    const obj={...input};
    for(const key of Object.keys(obj)) if(!(key in fields))return {success:false,error:{flatten:()=>({})}};
    for(const [key,f] of Object.entries(fields)) {
      let v=obj[key];
      if(v===undefined&&Object.hasOwn(f,'defaultValue')){v=f.defaultValue;obj[key]=v;}
      if(v===undefined&&f.isOptional)continue;
      if(v===undefined)return {success:false,error:{flatten:()=>({})}};
      if(f.kind==='string'&&typeof v!=='string')return {success:false,error:{flatten:()=>({})}};
      if(f.kind==='number'&&typeof v!=='number')return {success:false,error:{flatten:()=>({})}};
      if(f.kind==='enum'&&!f.choices.includes(v))return {success:false,error:{flatten:()=>({})}};
      if(f.minVal!==undefined && (typeof v==='string'?v.length:v)<f.minVal)return {success:false,error:{flatten:()=>({})}};
      if(f.maxVal!==undefined && (typeof v==='string'?v.length:v)>f.maxVal)return {success:false,error:{flatten:()=>({})}};
    }
    return{success:true,data:obj};
  }})
};

let currentState=null;
function snap(id,data){return {id,exists:data!==null&&data!==undefined,data:()=>data};}
function createFirestore(state){
 const docs=[{id:'request-a',data:()=>({ownerUid:'owner-a',status:'PENDING',requestType:'EXPORT'})},
   {id:'request-b',data:()=>({ownerUid:'owner-b',status:'APPROVED',requestType:'DELETE'})}];
 function userRef(uid){return{kind:'user',id:uid,async get(){state.events.push('wrapper-read');return snap(uid,state.entryUser);}};}
 function reqRef(id){return{kind:'request',id,async get(){state.events.push('self-service-read');return snap(id,state.requestRecords?.[id]);}};}
 function query(){const q={kind:'query',filterStatus:null,max:50,
  where(field,op,value){state.events.push('build-filter');assert.equal(field,'status');assert.equal(op,'==');this.filterStatus=value;return this;},
  orderBy(field,dir){state.events.push('build-sort');assert.equal(field,'createdAt');assert.equal(dir,'desc');return this;},
  limit(n){state.events.push('build-limit');this.max=n;return this;}};return q;}
 const db={
  collection(name){if(name==='users')return{doc:userRef};if(name==='dataRightsRequests')return{doc:reqRef, ...query()};throw Error('unexpected collection '+name);},
  async runTransaction(run){state.events.push('transaction-begin');if(state.afterEntry)state.liveUser=state.afterEntry(state.entryUser);
   const tx={async get(ref){if(ref.kind==='user'){state.events.push('transaction-user-read');return snap(ref.id,state.liveUser);}
    if(ref.kind==='query'){state.events.push('transaction-protected-query');let selected=docs;if(ref.filterStatus)selected=selected.filter(d=>d.data().status===ref.filterStatus);
      return{docs:selected.slice(0,ref.max)};} throw Error('unexpected transaction ref '+ref.kind)}};
   return run(tx);}
 };return db;
}
const helper=moduleFromOriginal('functions/src/jobs/currentJobCallerAuthority.ts',{});
const authModule=moduleFromOriginal('functions/src/core/auth.ts',{
 'firebase-functions/v1':{https:{onCall:fn=>fn}},
 './errors.js':{httpsError},
 './firestore-paths.js':{userDoc:uid=>createFirestore(currentState).collection('users').doc(uid)},
});
const callable=moduleFromOriginal('functions/src/privacy/dataRights.ts',{
 'node:crypto':require('node:crypto'),
 'firebase-admin/firestore':{FieldValue:{serverTimestamp:()=>({fakeTime:true})},getFirestore:()=>createFirestore(currentState)},
 'zod':{z},
 '../core/auth.js':authModule,
 '../core/errors.js':{httpsError},
 '../jobs/currentJobCallerAuthority.js':helper,
});
const active={uid:'operator-1',role:'operator',disabled:false,accountStatus:'active',tenantId:'t1',orgId:'o1'};
const context={auth:{uid:'operator-1',token:{role:'user'}}};
function fixture(entryUser=active,afterEntry=()=>entryUser){currentState={entryUser,liveUser:entryUser,afterEntry,events:[],requestRecords:{'request-a':{ownerUid:'operator-1',requestType:'EXPORT',status:'PENDING'},'request-b':{ownerUid:'owner-b',requestType:'DELETE',status:'PENDING'}}};return currentState;}
const deny=e=>e?.code==='permission-denied';
const deniedWithoutQuery=async (state,auth=context)=>{await assert.rejects(()=>callable.listDataRightsRequests({},auth),deny);assert.equal(state.events.includes('transaction-protected-query'),false,'must not run protected cross-owner query');};
test('R899 source hashes match exact Jobs R898 PR #373',()=>{
 assert.equal(gitBlob('functions/src/privacy/dataRights.ts'),'5f3240db49159ba94fd6aeaae205a3f7c243cc58');
 assert.equal(gitBlob('functions/src/core/auth.ts'),'434ffe34830d9e4db745ac51c18ff1615cf9d533');
 assert.equal(gitBlob('functions/src/jobs/currentJobCallerAuthority.ts'),'b791017fcb291e8a793b2b85fa9ee37991277c9d');
});
test('R899 current active operator can list cross-owner protected requests',async()=>{
 const s=fixture();const result=await callable.listDataRightsRequests({},context);
 assert.equal(result.requests.length,2);assert.equal(result.requests[0].ownerUid,'owner-a');
 assert.deepEqual(s.events.filter(e=>e.includes('read')||e.includes('query')),['wrapper-read','transaction-user-read','transaction-protected-query']);
});
test('R899 current admin is allowed even with stale low-role token',async()=>{
 fixture({...active,role:'admin'});const r=await callable.listDataRightsRequests({},context);assert.equal(r.requests.length,2);
});
test('R899 server role downgrade during wrapper-to-transaction gap denies protected list',async()=>{
 const s=fixture(active,()=>({...active,role:'user'}));await deniedWithoutQuery(s);
 assert.deepEqual(s.events.filter(e=>e.includes('read')||e.includes('query')),['wrapper-read','transaction-user-read']);
});
for(const [name,update] of [
 ['disabled',u=>({...u,disabled:true})],
 ['deleted',u=>({...u,deleted:true})],
 ['marked-for-deletion',u=>({...u,markedForDeletion:true})],
 ['privacy deletion pending',u=>({...u,dataRightsDeletionPendingCentralPrivacy:true})],
 ['account suspended',u=>({...u,accountStatus:'suspended'})],
 ['account status deleted',u=>({...u,accountStatus:'deleted'})],
 ['malformed disabled',u=>({...u,disabled:'false'})],
 ['malformed tenant',u=>({...u,tenantId:{id:'t1'}})],
 ['malformed organization',u=>({...u,orgId:42})],
 ['uid changed',u=>({...u,uid:'different-user'})]
])test('R899 protected list rejects '+name+' between wrapper and transaction',async()=>{const s=fixture(active,update);await deniedWithoutQuery(s);});
test('R899 protected list rejects current missing user after wrapper',async()=>{
 const s=fixture(active,()=>null);await deniedWithoutQuery(s);
});
test('R899 protected list rejects malformed role before list transaction',async()=>{
 const s=fixture({...active,role:'unexpected'});await deniedWithoutQuery(s);assert.equal(s.events.includes('transaction-begin'),false);
});
test('R899 protected list rejects ordinary user with operator token claim',async()=>{
 const s=fixture({...active,role:'user'});await deniedWithoutQuery(s,{auth:{uid:'operator-1',token:{role:'operator'}}});
});
test('R899 protected list rejects absent authentication',async()=>{
 const s=fixture();await assert.rejects(()=>callable.listDataRightsRequests({}, {auth:null}),e=>e?.code==='unauthenticated');
 assert.deepEqual(s.events,[]);
});
test('R899 list filters status and honors limit in same transaction',async()=>{
 const s=fixture();const r=await callable.listDataRightsRequests({status:'APPROVED',limit:1},context);
 assert.equal(r.requests.length,1);assert.equal(r.requests[0].requestId,'request-b');
 assert.ok(s.events.indexOf('transaction-user-read') < s.events.indexOf('transaction-protected-query'));
});
test('R899 malformed list status is rejected before protected read',async()=>{
 const s=fixture();await assert.rejects(()=>callable.listDataRightsRequests({status:'BOGUS'},context),e=>e?.code==='invalid-argument');
 assert.deepEqual(s.events,['wrapper-read']);
});
test('R899 malformed limit is rejected before protected read',async()=>{
 const s=fixture();await assert.rejects(()=>callable.listDataRightsRequests({limit:500},context),e=>e?.code==='invalid-argument');
 assert.deepEqual(s.events,['wrapper-read']);
});
test('R899 owner data-rights self-service get remains available',async()=>{
 fixture({...active,role:'user'});const result=await callable.getDataRightsRequest({requestId:'request-a'},context);
 assert.equal(result.request.requestId,'request-a');
});
test('R899 cross-owner self-service get remains denied',async()=>{
 fixture({...active,role:'user'});await assert.rejects(()=>callable.getDataRightsRequest({requestId:'request-b'},context),deny);
});
console.log('R899 original exact-Git-blob patched list callable with synthetic Firestore transaction; no native Firebase runtime or production identity');