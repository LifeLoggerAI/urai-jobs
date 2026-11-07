/** R884 exact processQueueNow source with controlled Firestore/Functions/PubSub substitutes.
 * NOT a native Firebase emulator, cloud IAM proof, or deployed endpoint execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const root=new URL('../',import.meta.url);
const requireFunctions=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFunctions('typescript');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
function compile(path){
 const f=new URL(path,root);
 const result=ts.transpileModule(readFileSync(f,'utf8'),{fileName:f.pathname,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.deepEqual(errors.map(d=>'TS'+d.code+':'+ts.flattenDiagnosticMessageText(d.messageText,' ')),[],path);
 return result.outputText;
}
function load(source,stubs){
 const module={exports:{}};
 new Function('require','module','exports',source)(name=>{if(!Object.prototype.hasOwnProperty.call(stubs,name))throw Error('Unexpected dependency: '+name);return stubs[name];},module,module.exports);
 return module.exports;
}
const scope=load(compile('functions/src/jobs/currentJobCallerAuthority.ts'),{});
let nextId=0;
function fixture({token={uid:'op',token:{role:'operator',uraiJobsAdmin:true}},
  initialUser={uid:'op',role:'operator',disabled:false},
  currentUser=initialUser,
  queued=true,
  pendingJob={jobId:'job-1',ownerUid:'owner',type:'web.fetch',jobType:'web.fetch',status:'PENDING'},
}={}){
 const state={preflightReads:0,transactionReads:[],writes:[],published:[],txStarted:0,queueQueryCount:0};
 const ref=(name,id)=>({name,id});
 const snapshots=(name,id,inTransaction)=>{
  const data=name==='users'?(inTransaction?currentUser:initialUser):name==='jobs'?pendingJob:name==='jobQueue'?{jobId:'job-1',status:'PENDING'}:null;
  return {id,exists:data!==null&&data!==undefined,data:()=>data};
 };
 const db={collection(name){return {
  doc(id){return {...ref(name,id),async get(){if(name==='users')state.preflightReads++;return snapshots(name,id,false)}}},
  where(){return this},orderBy(){return this},limit(){return this},
  async get(){state.queueQueryCount++;return {size:queued?1:0,docs:queued?[{id:'job-1',data:()=>({jobId:'job-1'})}]:[]}}
 },async runTransaction(fn){
  state.txStarted++;
  const pending=[];
  const transaction={
   async get(r){state.transactionReads.push(r.name+'/'+r.id);return snapshots(r.name,r.id,true)},
   update(r,v){pending.push({path:r.name+'/'+r.id,fields:v})},
   set(r,v){pending.push({path:r.name+'/'+r.id,fields:v})},
  };
  const result=await fn(transaction);state.writes.push(...pending);return result;
 }};
 const stubs={
  'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({testTime:true}),delete:()=>({deletion:true})}},
  'firebase-functions/v2/https':{onCall:(_options,fn)=>fn,HttpsError},
  '@google-cloud/pubsub':{PubSub:class {topic(){return {publishMessage:async v=>{state.published.push(v);return 'id'}}}}},
  'ulid':{ulid:()=>`test-${++nextId}`},
  '../core/dispatchRecovery.js':{returnLeaseAfterPublishFailure:async()=>{throw Error('Unexpected dispatch recovery')}},
  '../core/firestore-paths.js':{jobDoc:id=>ref('jobs',id),jobQueueEntryDoc:id=>ref('jobQueue',id)},
  './executionGuards.js':{isTerminalJobStatus:()=>false},
  '../privacy/consentBlocks.js':{consentBlockRef:()=>ref('consent','block'),isConsentContext:()=>false,checkedJobConsentBlockState:()=> 'clear'},
  '../privacy/lifeMovieConsentGate.js':{deferLifeMovieJob:()=>false,LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE:'review-only',LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS:2000},
  './currentJobCallerAuthority.js':scope,
 };
 const handle=load(compile('functions/src/jobs/processQueueNow.ts'),stubs).processQueueNow;
 return {state,invoke:()=>handle({auth:token,data:{limit:1}})};
}
const denied=e=>e?.code==='permission-denied';
const user=(role='operator',other={})=>({uid:'op',role,disabled:false,...other});
function testDenied(name,opts){test(name,async()=>{const f=fixture(opts);await assert.rejects(f.invoke(),denied);assert.equal(f.state.published.length,0);assert.equal(f.state.writes.length,0)})}
for(const [name,profile] of [
 ['role withdrawn',user('user')],
 ['role unknown',user('unknown')],
 ['operator disabled',user('operator',{disabled:true})],
 ['operator deleted',user('operator',{deleted:true})],
 ['operator privacy deletion pending',user('operator',{dataRightsDeletionPendingCentralPrivacy:true})],
 ['operator tenant identity malformed',user('operator',{tenantId:{id:'evil'}})],
 ['operator account suspended',user('operator',{accountStatus:'suspended'})],
 ['operator record removed',null],
]) testDenied('R884 stale operator token: '+name+' denies preflight', {initialUser:profile,currentUser:profile});
testDenied('R884 authenticated role withdrawn between preflight and lease transaction cannot publish',{initialUser:user(),currentUser:user('user')});
testDenied('R884 operator deleted between preflight and lease transaction cannot publish',{initialUser:user(),currentUser:null});
testDenied('R884 operator scope malformed during transaction cannot publish',{initialUser:user(),currentUser:user('operator',{orgId:987})});
test('R884 valid current operator with low-claim token still leases exactly once',async()=>{
 const f=fixture({token:{uid:'op',token:{role:'user'}},initialUser:user(),currentUser:user()});
 const result=await f.invoke();assert.equal(result.published.length,1);assert.equal(f.state.published.length,1);
 assert.equal(f.state.transactionReads.includes('users/op'),true);
 assert.equal(f.state.writes.length,2);
});
test('R884 current admin role without operator token can lease',async()=>{
 const f=fixture({token:{uid:'op',token:{role:'user'}},initialUser:user('admin'),currentUser:user('admin')});
 assert.equal((await f.invoke()).published.length,1);
});
test('R884 no pending queue still validates current operator, refuses revoked token',async()=>{
 const f=fixture({queued:false,initialUser:user('user'),currentUser:user('user')});
 await assert.rejects(f.invoke(),denied);assert.equal(f.state.queueQueryCount,0);
});
test('R884 no pending queue still returns no publishes for authorized operator',async()=>{
 const f=fixture({queued:false});assert.deepEqual((await f.invoke()).published,[]);assert.equal(f.state.queueQueryCount,1);
});
test('R884 unauthenticated request is denied',async()=>{
 const f=fixture({token:null});await assert.rejects(f.invoke(),e=>e?.code==='unauthenticated');assert.equal(f.state.writes.length,0);
});
