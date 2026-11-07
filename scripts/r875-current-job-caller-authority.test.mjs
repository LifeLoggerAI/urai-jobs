/**
 * R875: original callable TypeScript run with controlled Firestore and Functions
 * substitutes. This is a source-level regression, NOT Firebase emulator or IAM proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=new URL('../', import.meta.url);
const requireFunctions=createRequire(new URL('../functions/package.json', import.meta.url));
const ts=requireFunctions('typescript');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
function compile(path){const f=new URL(path,root);const result=ts.transpileModule(readFileSync(f,'utf8'),{fileName:f.pathname,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});const diagnostics=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(diagnostics.length)throw Error('TypeScript parse failed for '+path+': '+diagnostics.map(d=>'TS'+d.code+' '+ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));return result.outputText;}
function runModule(source,stubs){const mod={exports:{}};new Function('require','module','exports',source)((name)=>{if(!(name in stubs))throw Error('unexpected module '+name);return stubs[name];},mod,mod.exports);return mod.exports;}
const helper=runModule(compile('functions/src/jobs/currentJobCallerAuthority.ts'),{});
function fixture({status='RUNNING',ownerUid='victim',user={uid:'caller',role:'user',disabled:true}}={}){
 const state={user,reads:[],writes:[],job:{jobId:'job-one',ownerUid,status,payload:{marker:'synthetic-only'}},logs:[{id:'l1',data:()=>({message:'synthetic-only-log'})}]};
 function doc(name,id){return {name,id,async get(){state.reads.push(name+'/'+id);const data=name==='users'?state.user:name==='jobs'?state.job:undefined;return {id,exists:data!==undefined,data:()=>data};},collection(){return {doc:()=>({name:'logs',id:'audit-id'}),orderBy(){return {limit(){return {get:async()=>({docs:state.logs})};}};},limit(){return {get:async()=>({docs:state.logs})};}};}};}
 const db={collection(name){return {doc:id=>doc(name,id),where(){return this;},limit(){return this;},async get(){state.reads.push(name+'/QUERY');return {docs:[{id:'job-one',data:()=>state.job}]};}};},async runTransaction(fn){const writes=[];const tx={get:r=>r.get(),set:(r,v)=>writes.push({r,v}),create:(r,v)=>writes.push({r,v})};const result=await fn(tx);writes.forEach(({r,v})=>{state.writes.push({path:r.name+'/'+r.id,patch:v});if(r.name==='jobs'&&v.status)state.job.status=v.status;});return result;}};
 return {db,state};
}
function load(path,db){const stubs={
 'firebase-admin/app':{getApps:()=>[{}],initializeApp(){}},
 'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({syntheticTime:true})}},
 'firebase-functions/v1':{https:{HttpsError,onCall:fn=>fn}},
 'firebase-functions/v2/https':{HttpsError,onCall:(_opt,fn)=>fn},
 './currentJobCallerAuthority.js':helper,
 };return runModule(compile('functions/src/jobs/'+path+'.ts'),stubs);}
const stale={uid:'caller',token:{role:'operator',uraiJobsAdmin:true}};
const activeToken={uid:'caller',token:{role:'user'}};
const active={uid:'caller',role:'operator',disabled:false,accountStatus:'active'};
const denied=e=>e?.code==='permission-denied';
test('R875 authority helper rejects stale claim override, deleted user and deletion fence',()=>{
 assert.deepEqual(helper.checkedCurrentJobCaller(stale,{uid:'caller',role:'user',disabled:false}),{uid:'caller',operator:false});
 assert.deepEqual(helper.checkedCurrentJobCaller(activeToken,active),{uid:'caller',operator:true});
 for(const key of ['disabled','deleted','markedForDeletion','dataRightsDeletionPendingCentralPrivacy'])
  assert.equal(helper.checkedCurrentJobCaller(stale,{uid:'caller',role:'operator',[key]:true}),null);
 assert.equal(helper.checkedCurrentJobCaller(stale,{uid:'stranger',role:'operator'}),null);
});
test('R875 getJob rejects stale operator and disabled user before disclosing foreign private job/logs',async()=>{
 const {db,state}=fixture();await assert.rejects(()=>load('getJob',db).getJob({auth:stale,data:{jobId:'job-one'}}),denied);
 assert.ok(state.reads.includes('users/caller'));assert.equal(state.writes.length,0);
});
test('R875 cancelJob rejects stale operator and disabled user without changing foreign job',async()=>{
 const {db,state}=fixture();await assert.rejects(()=>load('cancelJob',db).cancelJob({auth:stale,data:{jobId:'job-one'}}),denied);
 assert.equal(state.job.status,'RUNNING');assert.equal(state.writes.length,0);
});
for(const [gen,names] of [['admin',['listJobs','listJobLogs','retryJob']],['admin-v2',['listJobsV2','listJobLogsV2','retryJobV2']]]){
 test(`R875 ${gen} refuses stale operator read/list/log/retry`,async()=>{
  for(const name of names){
   const {db,state}=fixture({status:'FAILED'});const m=load(gen,db);
   const data=name.toLowerCase().includes('joblogs')||name.toLowerCase().includes('retry')?{jobId:'job-one'}:{};
   const action=gen==='admin'?()=>m[name](data,{auth:stale}):()=>m[name]({data,auth:stale});
   await assert.rejects(action,denied,gen+' '+name);assert.equal(state.writes.length,0);
   assert.ok(state.reads.includes('users/caller'));
  }
 });
}
test('R875 active current operator can read foreign job and cancel with transactional log',async()=>{
 for(const name of ['getJob','cancelJob']){
  const {db,state}=fixture({user:active});const m=load(name,db);
  const result=await m[name]({auth:activeToken,data:{jobId:'job-one'}});
  if(name==='getJob'){assert.equal(result.job.ownerUid,'victim');assert.equal(result.logs[0].message,'synthetic-only-log');}
  else{assert.equal(result.status,'CANCELLED');assert.equal(state.job.status,'CANCELLED');assert.ok(state.writes.some(x=>x.path==='logs/audit-id'));}
 }
});
test('R875 active current operator can list and retry in both exported admin generations',async()=>{
 for(const [gen,names] of [['admin',['listJobs','listJobLogs','retryJob']],['admin-v2',['listJobsV2','listJobLogsV2','retryJobV2']]]){
  const {db,state}=fixture({status:'FAILED',user:active});const m=load(gen,db);
  const call=(name,data)=>gen==='admin'?m[name](data,{auth:activeToken}):m[name]({data,auth:activeToken});
  assert.equal((await call(names[0],{})).jobs[0].ownerUid,'victim');
  assert.equal((await call(names[1],{jobId:'job-one'})).logs[0].message,'synthetic-only-log');
  assert.equal((await call(names[2],{jobId:'job-one'})).status,'PENDING');
  assert.ok(state.writes.some(x=>x.path==='logs/audit-id'));
 }
});
test('R875 ordinary active owner keeps access to owned job, ordinary foreign caller denied',async()=>{
 for(const name of ['getJob','cancelJob']){
  const a=fixture({ownerUid:'caller',user:{uid:'caller',role:'user',disabled:false}});
  const result=await load(name,a.db)[name]({auth:activeToken,data:{jobId:'job-one'}});
  assert.ok(result.job?.ownerUid==='caller'||result.status==='CANCELLED');
  const b=fixture({user:{uid:'caller',role:'user',disabled:false}});
  await assert.rejects(()=>load(name,b.db)[name]({auth:activeToken,data:{jobId:'job-one'}}),denied);
 }
});
