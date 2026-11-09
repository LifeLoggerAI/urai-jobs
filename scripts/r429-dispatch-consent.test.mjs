import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
// In the real Jobs workspace, TypeScript is owned by Functions; no global fallback.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const srcDir = resolve(import.meta.dirname, '../functions/src');
const raw = path => readFileSync(resolve(srcDir,path),'utf8');
const compiled = path => {
  const source=raw(path);
  const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
  assert.equal(file.parseDiagnostics.length,0,`Syntax in ${path}`);
  return ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
};

function setup(snapshotState){
 const refs={ job:{kind:'job'}, queue:{kind:'queue'}, consent:{kind:'consent'} };
 refs.job.collection=()=>({doc:()=>({kind:'log'})});
 const state={job:{jobId:'synthetic-one',type:'narrator.tts',status:'PENDING',ownerUid:'synthetic-owner',
   consent:{purpose:'voice.synthesis',policyVersion:'1',decisionReceiptId:'receipt-one'}},
   queue:{jobId:'synthetic-one',status:'PENDING',availableAt:new Date(Date.now()-1000)},
   consent:snapshotState, consentReads:0, published:0, workerCalls:0, updates:[]};
 const users={
   'synthetic-owner':{uid:'synthetic-owner',role:'user',accountStatus:'active',disabled:false,deleted:false,markedForDeletion:false,dataRightsDeletionPendingCentralPrivacy:false},
   'synthetic-operator':{uid:'synthetic-operator',role:'operator',accountStatus:'active',disabled:false,deleted:false,markedForDeletion:false,dataRightsDeletionPendingCentralPrivacy:false},
 };
 let seq=0;
 const apply=(ref,props)=>{state.updates.push({kind:ref.kind,props});
  for(const [name,value] of Object.entries(props)){
   const parts=name.split('.');let node=state[ref.kind];
   for(const part of parts.slice(0,-1)){node[part]??={};node=node[part]}
   node[parts.at(-1)]=value;
  }
 };
 const snap=(kind)=>kind==='consent'
  ? (Array.isArray(state.consent) ? state.consent[Math.min(state.consentReads++,state.consent.length-1)] : state.consent)
  : {exists:true,data:()=>state[kind]};
 refs.consent.get=async()=>snap('consent');
 const db={
   collection:n=>{if(n==='logs')return {add:async()=>({id:'synthetic-log'})};
   if(n==='users')return {doc:uid=>({kind:'user',uid,get:async()=>({exists:!!users[uid],data:()=>users[uid]})})};
   assert.equal(n,'jobQueue');const chain={where(){return chain},orderBy(){return chain},limit(){return chain},
    async get(){return {empty:false,size:1,docs:[{id:'synthetic-one',data:()=>state.queue}]}}};return chain},
   runTransaction:async cb=>cb({
    get:async ref=>ref.kind==='user'?{exists:!!users[ref.uid],data:()=>users[ref.uid]}:snap(ref.kind),
    update:apply,
    set:apply,
    create:()=>{},
   })
 };
 const firebase={getFirestore:()=>db,FieldValue:{serverTimestamp:()=>new Date(),delete:()=>null,increment:n=>n}};
 const defaultConsent={getFirestore:()=>db};
 const env={SYNTHETIC_WORKER_URL:'https://synthetic.invalid'};
 const modules={
  'firebase-admin/firestore':firebase,
  'firebase-functions/v2/https':{onCall:(opts,cb)=>cb,HttpsError:class HttpsError extends Error{}},
  'firebase-functions/v2/scheduler':{onSchedule:(opts,cb)=>cb},
  'firebase-functions/params':{defineSecret:()=>({value:()=>''})},
  'firebase-functions/v2/pubsub':{onMessagePublished:(opts,cb)=>cb},
  'zod':{z:{object:()=>({safeParse:value=>({success:true,data:value})}),string:()=>({min(){return this}})}},
  'axios':{post:async()=>{state.workerCalls++;return {status:200,data:{ok:true}}}},
  '../core/runtimeJobTypes.js':{workerEnvKeyForJobType:()=> 'SYNTHETIC_WORKER_URL',workerRouteForJobType:()=>'/execute'},
  '../providers/tinyfish.js':{isTinyFishJobType:()=>false,executeTinyFishJob:async()=>{},tinyFishApiKeySecret:{value:()=>''}},
  '@google-cloud/pubsub':{PubSub:class {topic(){return {publishMessage:async ()=>{state.published++}}}}},
  'ulid':{ulid:()=>`synthetic-lease-${++seq}`},
  '../core/dispatchRecovery.js':{returnLeaseAfterPublishFailure:async()=>{}},
  '../core/firestore-paths.js':{jobDoc:()=>refs.job,jobQueueEntryDoc:()=>refs.queue},
  './executionGuards.js':{isTerminalJobStatus:()=>false,canRequeueUnstartedLease:()=>false,
    decideExecutionStart:()=>({action:'start'}),canFinalizeExecution:()=>true},
  '../privacy/lifeMovieConsentGate.js':{deferLifeMovieJob:()=>false,LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE:'life_movie_consent_authority_unavailable',LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS:10000},
 };
 const consentModule={exports:{}};
 const evalSource=(js,moduleObj,req)=>vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{
   console,process:{env},Date,Buffer,setTimeout,clearTimeout,Promise,JSON,Error,Set,Map,Number,Object,Array,String,Boolean,
 },{timeout:3000})(req,moduleObj,moduleObj.exports);
 evalSource(compiled('privacy/consentBlocks.ts'),consentModule,k=>{
   if(k==='node:crypto')return require(k);
   if(k==='firebase-admin/firestore')return defaultConsent;
   throw Error('Unexpected consent module '+k);
 });
 modules['../privacy/consentBlocks.js']={
   ...consentModule.exports,
   consentBlockRef:()=>refs.consent,
 };
 // Keep the real rejected-output validator in the executor import graph.
 // These dispatch fixtures never authorize Storage compensation.
 const rejectedOutputModule={exports:{}};
 evalSource(compiled('jobs/rejectedNarratorOutput.ts'),rejectedOutputModule,k=>{
   assert.equal(k,'firebase-admin/storage');
   return {getStorage(){throw Error('dispatch fixture must not access Storage');}};
 });
 modules['./rejectedNarratorOutput.js']=rejectedOutputModule.exports;
 // R925: exercise the ORIGINAL current-owner/tenant/org and operator-role helper.
 // No always-allow mock is permitted for this authority boundary.
 const currentOwnerModule={exports:{}};
 evalSource(compiled('jobs/currentJobCallerAuthority.ts'),currentOwnerModule,k=>{
   throw Error('Unexpected current owner helper import '+k);
 });
 modules['./currentJobCallerAuthority.js']=currentOwnerModule.exports;
 const load=path=>{
   const moduleObj={exports:{}};
   evalSource(compiled('jobs/'+path+'.ts'),moduleObj,k=>{
      if(k in modules)return modules[k];
      throw Error('Unexpected mock import '+k);
   });return moduleObj.exports;
 };
 return{state,load,snap};
}
const absent={exists:false};
const present=data=>({exists:true,data:()=>data});
for(const [label,block,shouldPublish,shouldCancel] of [
 ['absent block',absent,true,false],
 ['explicit clear',present({active:false}),true,false],
 ['revoked',present({active:true}),false,true],
 ['string active',present({active:'true'}),false,false],
 ['missing active',present({}),false,false],
 ['unreadable active',present(Object.defineProperty({},'active',{get(){throw Error('read')}})),false,false],
 ['no snapshot',null,false,false],
]){
 for(const mode of ['manual','scheduled']){
  test(`${mode}: ${label} ${shouldPublish?'publishes':'does not publish'}`,async()=>{
    const f=setup(block);
    const fn=f.load(mode==='manual'?'processQueueNow':'processQueueTick');
    if(mode==='manual')await fn.processQueueNow({auth:{uid:'synthetic-operator',token:{role:'operator'}},data:{limit:1}});
    else await fn.processQueueTick();
    assert.equal(f.state.published,shouldPublish?1:0);
    assert.equal(f.state.job.status,shouldCancel?'CANCELLED':shouldPublish?'LEASED':'PENDING');
    assert.equal(f.state.queue.status,shouldCancel?'CANCELLED':shouldPublish?'LEASED':'PENDING');
    if(!shouldPublish&&!shouldCancel){
      assert.equal(f.state.queue.dispatch?.blockedReason,'job_consent_block_unverified');
      assert.ok(f.state.queue.availableAt > new Date());
    }
  });
 }
}

test('execution start and worker dispatch use the same strict guard, never the old boolean-only check',()=>{
 const s=raw('jobs/executeJob.ts');
 assert.equal(s.split('checkedJobConsentBlockState(snapshot)').length-1,2);
 assert.equal(s.split('snapshot.data()?.active === true').length-1,0);
 assert.match(s,/throw new Error\('job_consent_block_unverified'\)/);
 assert.ok(s.indexOf("throw new Error('job_consent_block_unverified')")<s.indexOf('axios.post(`${workerUrl}${route}`'));
});

for(const [label,blocks,expectStatus,expectCalls] of [
 ['revoked at execution start',present({active:true}),'CANCELLED',0],
 ['malformed at execution start',present({active:'true'}),'PENDING',0],
 ['unverifiable at execution start',present({}),'PENDING',0],
 ['valid until pre-worker read then malformed',[present({active:false}),present({active:'true'})],'PENDING',0],
 ['valid until pre-worker read then revoked',[present({active:false}),present({active:true})],'CANCELLED',0],
 ['clear at both boundaries',[present({active:false}),present({active:false})],'SUCCESS',1],
]){
 test('executor: '+label,async()=>{
  const f=setup(blocks);
  f.state.job.status='LEASED'; f.state.job.lease={leaseToken:'synthetic-lease'};
  f.state.job.execution={attemptCount:0,maxAttempts:2};
  f.state.queue.status='LEASED';f.state.queue.lease={leaseToken:'synthetic-lease'};
  const fn=f.load('executeJob');
  await fn.executeJob({data:{message:{json:{jobId:'synthetic-one',leaseToken:'synthetic-lease'}}}});
  assert.equal(f.state.workerCalls,expectCalls);
  assert.equal(f.state.job.status,expectStatus);
  assert.equal(f.state.queue.status,expectStatus==='SUCCESS'?'DONE':expectStatus);
 });
}


const malformedStoredContexts = [
  ['incomplete single consent', job => { job.consent = {purpose:'voice.synthesis',policyVersion:'1',decisionReceiptId:''}; }],
  ['invalid plural consent', job => { delete job.consent; job.consents = [{purpose:'voice.synthesis',policyVersion:'1',decisionReceiptId:''}]; }],
  ['valid single mixed with invalid plural', job => { job.consents = [{purpose:'other',policyVersion:'1',decisionReceiptId:''}]; }],
  ['missing owner with populated consent', job => { job.ownerUid = ''; }],
];

for (const [label, corrupt] of malformedStoredContexts) {
  for (const mode of ['manual','scheduled']) {
    test(mode + ': stored job with malformed consent ' + label + ' cannot lease', async () => {
      const f = setup(absent);
      corrupt(f.state.job);
      const fn = f.load(mode === 'manual' ? 'processQueueNow' : 'processQueueTick');
      if (mode === 'manual') await fn.processQueueNow({auth:{uid:'synthetic-operator',token:{role:'operator'}},data:{limit:1}});
      else await fn.processQueueTick();
      assert.equal(f.state.published, 0);
      assert.equal(f.state.job.status, 'PENDING');
      assert.equal(f.state.queue.status, 'PENDING');
      assert.equal(f.state.queue.dispatch?.blockedReason, 'job_consent_context_unverified');
    });
  }
  test('executor: stored job with malformed consent ' + label + ' cannot start', async () => {
    const f = setup(absent);
    corrupt(f.state.job);
    f.state.job.status = 'LEASED';
    f.state.job.lease = {leaseToken:'synthetic-lease'};
    f.state.job.execution = {attemptCount:0,maxAttempts:2};
    f.state.queue.status = 'LEASED';
    f.state.queue.lease = {leaseToken:'synthetic-lease'};
    await f.load('executeJob').executeJob({data:{message:{json:{
      jobId:'synthetic-one',leaseToken:'synthetic-lease',
    }}}});
    assert.equal(f.state.workerCalls, 0);
    assert.equal(f.state.job.status, 'PENDING');
    assert.equal(f.state.queue.status, 'PENDING');
    assert.equal(f.state.queue.dispatch?.blockedReason, 'job_consent_context_unverified');
  });
}

// Multi-purpose consent: a revoked purpose must cancel even if another
// purpose's block is malformed. Unknown authority still never dispatches.
function withSecondConsent(f){
 f.state.job.consents=[{purpose:'camera.capture',policyVersion:'1',decisionReceiptId:'receipt-two'}];
 return f;
}
for(const [mode,fnName] of [['manual','processQueueNow'],['scheduled','processQueueTick']]){
 for(const [order,blocks] of [
  ['unknown-first',[present({active:'false'}),present({active:true})]],
  ['revoked-first',[present({active:true}),present({active:'false'})]],
 ]){
  test(`${mode}: explicit revocation cancels even with ${order} additional consent`,async()=>{
   const f=withSecondConsent(setup(blocks));
   const fn=f.load(fnName);
   if(mode==='manual')await fn.processQueueNow({auth:{uid:'synthetic-operator',token:{role:'operator'}},data:{limit:1}});
   else await fn.processQueueTick();
   assert.equal(f.state.job.status,'CANCELLED');
   assert.equal(f.state.queue.status,'CANCELLED');
   assert.equal(f.state.published,0);
  });
 }
}
for(const [label,blocks] of [
 ['at execution start',[present({active:'false'}),present({active:true})]],
 ['immediately before worker',[present({active:false}),present({active:false}),
    present({active:'false'}),present({active:true})]],
]){
 test(`executor: multi-purpose revocation ${label} cancels instead of retrying`,async()=>{
  const f=withSecondConsent(setup(blocks));
  f.state.job.status='LEASED';f.state.job.lease={leaseToken:'synthetic-lease'};
  f.state.job.execution={attemptCount:0,maxAttempts:2};
  f.state.queue.status='LEASED';f.state.queue.lease={leaseToken:'synthetic-lease'};
  await f.load('executeJob').executeJob({data:{message:{json:{jobId:'synthetic-one',leaseToken:'synthetic-lease'}}}});
  assert.equal(f.state.job.status,'CANCELLED');
  assert.equal(f.state.queue.status,'CANCELLED');
  assert.equal(f.state.workerCalls,0);
 });
}
