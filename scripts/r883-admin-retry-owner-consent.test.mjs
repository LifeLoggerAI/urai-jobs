/**
 * R883 original admin retry handlers under controlled Firestore/Functions substitutes.
 * Local source-level regression, NOT authenticated Firebase or cloud IAM evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const root = new URL('../',import.meta.url);
const requireFunctions = createRequire(new URL('../functions/package.json',import.meta.url));
const ts = requireFunctions('typescript');

class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
function compile(path){
 const f=new URL(path,root);
 const result=ts.transpileModule(readFileSync(f,'utf8'),{fileName:f.pathname,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.deepEqual(errors.map(d=>'TS'+d.code+' '+ts.flattenDiagnosticMessageText(d.messageText,' ')),[],path);
 return result.outputText;
}
function execute(js,stubs){const m={exports:{}};new Function('require','module','exports',js)(n=>{if(!(n in stubs))throw Error('Unexpected module '+n);return stubs[n];},m,m.exports);return m.exports;}
const helper=execute(compile('functions/src/jobs/currentJobCallerAuthority.ts'),{});

function fixture({ owner={uid:'owner',role:'user',disabled:false,tenantId:'tenant-a',orgId:'org-a'},
    job={ownerUid:'owner',status:'FAILED',jobType:'web.fetch',type:'web.fetch',tenantId:'tenant-a',orgId:'org-a'},
    operator={uid:'operator',role:'operator',disabled:false},
 }={}){
 const state={users:{operator,...(owner?{owner}: {})},job,writes:[],reads:[]};
 state.users.operator=operator;
 function doc(name,id){return {name,id,collection(sub){assert.equal(sub,'logs');return {doc(){return {name:'logs',id:'audit'}}}},async get(){
  state.reads.push(`${name}/${id}`);
  const data=name==='users'?state.users[id]:name==='jobs'?state.job:undefined;
  return {id,exists:data!==undefined&&data!==null,data:()=>data};
 }};}
 const db={collection(name){return {doc:id=>doc(name,id)}},async runTransaction(fn){
  const changes=[],tx={get:ref=>ref.get(),set:(ref,patch)=>changes.push({path:ref.name+'/'+ref.id,patch}),create:(ref,patch)=>changes.push({path:ref.name+'/'+ref.id,patch})};
  const result=await fn(tx);state.writes.push(...changes);return result;
 }};
 const stubs={
  'firebase-admin/app':{getApps:()=>[{}],initializeApp(){}},
  'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({timestamp:true})}},
  'firebase-functions/v1':{https:{HttpsError,onCall:fn=>fn}},
  'firebase-functions/v2/https':{HttpsError,onCall:(_opts,fn)=>fn},
  './currentJobCallerAuthority.js':helper,
 };
 const v1=execute(compile('functions/src/jobs/admin.ts'),stubs);
 const v2=execute(compile('functions/src/jobs/admin-v2.ts'),stubs);
 return {state,call:(gen)=>gen==='v1'?v1.retryJob({jobId:'job-one'},{auth:{uid:'operator',token:{role:'operator'}}}):v2.retryJobV2({data:{jobId:'job-one'},auth:{uid:'operator',token:{role:'operator'}}})};
}
const denied=e=>e?.code==='permission-denied'||e?.code==='failed-precondition';
for (const gen of ['v1','v2']) {
 test(`R883 ${gen} ordinary FAILED nonprivate job with active owner is retryable`,async()=>{
   const fx=fixture();assert.equal((await fx.call(gen)).status,'PENDING');assert.equal(fx.state.writes.length,3);
 });
 test(`R883 ${gen} revoked/deleted owner cannot be requeued`,async()=>{
   const fx=fixture({owner:{uid:'owner',role:'user',deleted:true,tenantId:'tenant-a',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} disabled owner cannot be requeued`,async()=>{
   const fx=fixture({owner:{uid:'owner',role:'user',disabled:true,tenantId:'tenant-a',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} missing owner record denies before queue write`,async()=>{
   const fx=fixture({owner:null});await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} transferred tenant denies before requeue`,async()=>{
   const fx=fixture({owner:{uid:'owner',role:'user',disabled:false,tenantId:'tenant-b',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} previous organization denies before requeue`,async()=>{
   const fx=fixture({owner:{uid:'owner',role:'user',disabled:false,tenantId:'tenant-a',orgId:'org-b'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} private Studio job cannot bypass dedicated owner consent bridge`,async()=>{
   const fx=fixture({job:{ownerUid:'owner',status:'FAILED',jobType:'studio.render.video',type:'studio.render.video',tenantId:'tenant-a',orgId:'org-a',sourceSystem:'urai-studio'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} original private-source job cannot be manually retried`,async()=>{
   const fx=fixture({job:{ownerUid:'owner',status:'FAILED',jobType:'memory.private-source.transcribe',type:'memory.private-source.transcribe',tenantId:'tenant-a',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} private narration cannot be requeued without positive authority`,async()=>{
   const fx=fixture({job:{ownerUid:'owner',status:'FAILED',jobType:'narrator.tts',type:'narrator.tts',tenantId:'tenant-a',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} conflicting job type aliases fail closed`,async()=>{
   const fx=fixture({job:{ownerUid:'owner',status:'FAILED',jobType:'web.fetch',type:'studio.render.video',tenantId:'tenant-a',orgId:'org-a'}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} job carrying consent metadata requires fresh source authorization`,async()=>{
   const fx=fixture({job:{ownerUid:'owner',status:'FAILED',jobType:'web.fetch',type:'web.fetch',tenantId:'tenant-a',orgId:'org-a',consent:{purpose:'memory.storage',decisionReceiptId:'old'}}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
 test(`R883 ${gen} downgraded operator cannot retry even with stale token`,async()=>{
   const fx=fixture({operator:{uid:'operator',role:'user',disabled:false}});
   await assert.rejects(()=>fx.call(gen),denied);assert.equal(fx.state.writes.length,0);
 });
}
