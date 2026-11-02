import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
// The real worker is read at test time. Extract the actual committed callback
// rather than trusting a reimplemented version of its transaction logic.
const worker = readFileSync(new URL('../workers/captured-reality-worker/index.js', import.meta.url), 'utf8');
const helperStart = worker.indexOf('function checkedCapturedRealityConsentBlockState(snapshot){');
const helperEnd = worker.indexOf('function consentBlockId(', helperStart);
const callbackStart = worker.indexOf("app.post('/engine-callback',callbackRateLimit,async(req,res)=>{");
const callbackEnd = worker.indexOf("\napp.use((_req,res)=>", callbackStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'checked consent-block classifier missing from worker');
assert.ok(callbackStart >= 0 && callbackEnd > callbackStart, 'original callback handler missing from worker');
assert.equal(worker.split('function checkedCapturedRealityConsentBlockState(').length, 2);
assert.equal(worker.split("app.post('/engine-callback'").length, 2);
assert.doesNotMatch(worker, /const blocked=blockSnaps\.find\(x=>x\.snapshot\.exists&&x\.snapshot\.data\(\)\?\.active===true\)/);
const input = worker.slice(helperStart, helperEnd) + '\n' + worker.slice(callbackStart, callbackEnd);
const own=(v)=>({exists:true,data:()=>v});
const clear={exists:false,data:()=>{throw Error('an absent block must not read data');}};
const affirmative=own({active:true});
const inactive=own({active:false});
function callbackHarness(blockMap={},opts={}){
  const token='synthetic-callback-test-token';
  let handler;
  const job={
    jobId:'job-fixture',ownerUid:'owner-fixture',status:'RUNNING',
    execution:{callbackTokenHash:crypto.createHash('sha256').update(token).digest('hex'),asyncCallbackPending:true,callbackDeadlineAt:{toMillis:()=>Date.now()+60_000}},
    consents:[{purpose:'memory.storage'},{purpose:'location.context'}]
  };
  const writes=[];const reads=[];
  const app={post(path,middleware,fn){if(path==='/engine-callback')handler=fn;}};
  const db={
    collection(name){return {doc(id){return {name,id}}}},
    async runTransaction(fn){
      const staged=[];
      const transaction={
        async get(ref){
          reads.push(`${ref.name}/${ref.id}`);
          if(ref.name==='jobs')return {exists:true,data:()=>job};
          if(ref.name==='jobConsentBlocks')return Object.prototype.hasOwnProperty.call(blockMap,ref.id)?blockMap[ref.id]:clear;
          throw Error('unexpected document '+ref.name);
        },
        update(ref,data){staged.push({type:'update',name:ref.name,id:ref.id,data})},
        set(ref,data){staged.push({type:'set',name:ref.name,id:ref.id,data})}
      };
      const result=await fn(transaction);
      writes.push(...staged);
      return result;
    }
  };
  const admin={firestore:{FieldValue:{serverTimestamp:()=>({_type:'timestamp'}),delete:()=>({_type:'delete'})}}};
  const ctx={
    app,callbackRateLimit:()=>{},db,admin,crypto,
    timingSafeString:(a,b)=>a===b,
    requiredConsentPurposes:j=>j.consents.map(x=>x.purpose),
    consentBlockId:(owner,purpose)=>purpose,
    validArtifact:x=>Boolean(x),
    PRIVATE_HANDLE:/^gs:\/\//,
    boundedArtifact:x=>x,
    console:{error:()=>{},log:()=>{}},
    Date,Error,Object,Array,String,JSON
  };
  vm.runInNewContext(input,ctx,{timeout:3000,filename:'worker.callback.js'});
  assert.equal(typeof handler,'function');
  const req={body:{jobId:'job-fixture',status:opts.status??'success',result:{
    archival:{ref:'gs://unit/a'},runtime:{ref:'gs://unit/r'},collision:{ref:'gs://unit/c'},
    cameraSolveReceiptRef:'gs://unit/qa',trainingReceiptRef:'gs://unit/training',sourceVsReconstructionReceiptRef:'gs://unit/compare'
  }},query:{callbackToken:opts.badToken?'wrong':token}};
  const res={code:200,status(n){this.code=n;return this},send(body){return {code:this.code,body}}};
  return {send:()=>handler(req,res),writes,reads,job};
}
async function check(map,code,expectedStatus,opts={}){
 const h=callbackHarness(map,opts);const res=await h.send();
 assert.equal(res.code,code,JSON.stringify(res));
 if(expectedStatus){assert.equal(h.writes.find(x=>x.name==='jobs')?.data.status,expectedStatus);assert.ok(h.writes.find(x=>x.name==='jobQueue'));}
 else assert.equal(h.writes.length,0,'callback must commit no Firestore writes if authority is unreadable');
 return h;
}
const scenarios=[
 ['missing blocks verified absent',{},200,'SUCCESS'],
 ['both blocks expressly inactive',{'memory.storage':inactive,'location.context':inactive},200,'SUCCESS'],
 ['first purpose explicitly revoked',{'memory.storage':affirmative},200,'CANCELLED'],
 ['second purpose explicitly revoked',{'location.context':affirmative},200,'CANCELLED'],
 ['present block missing active',{'memory.storage':own({})},403,null],
 ['present block string false',{'memory.storage':own({active:'false'})},403,null],
 ['present block numeric zero',{'memory.storage':own({active:0})},403,null],
 ['present block null false-like',{'memory.storage':own({active:null})},403,null],
 ['present block array',{'memory.storage':own([])},403,null],
 ['present block null data',{'memory.storage':own(null)},403,null],
 ['inherited inactive field',{'memory.storage':own(Object.create({active:false}))},403,null],
 ['inherited active true field',{'memory.storage':own(Object.create({active:true}))},403,null],
 ['present block has throwing getter',{'memory.storage':own(Object.defineProperty({},'active',{get(){throw Error('getter fired')}}))},403,null],
 ['data read fails',{'memory.storage':{exists:true,data:()=>{throw Error('read denied')}}},403,null],
 ['present snapshot cannot read data',{'memory.storage':{exists:true,data:null}},403,null],
 ['snapshot undefined',{'memory.storage':undefined},403,null],
 ['block exists value malformed',{'memory.storage':{exists:'false',data:()=>({active:false})}},403,null],
 ['snapshot null',{'memory.storage':null},403,null],
 ['snapshot array',{'memory.storage':[]},403,null],
 ['snapshot data getter throws',{'memory.storage':Object.defineProperty({exists:true},'data',{get(){throw Error('getter denied')}})},403,null],
 ['revoked even if other block malformed',{'memory.storage':affirmative,'location.context':own({})},200,'CANCELLED'],
 ['other block malformed, first inactive',{'memory.storage':inactive,'location.context':own({})},403,null],
 ['failed callback with malformed consent block',{'memory.storage':own({active:'false'})},403,null,{status:'failed'}],
 ['failed callback with verified inactive blocks',{'memory.storage':inactive,'location.context':inactive},200,'FAILED',{status:'failed'}],
];
for(const [name,map,code,state,options] of scenarios){test(name,async()=>await check(map,code,state,options))}
test('malformed callback token leaves Firestore unchanged',async()=>{await check({},403,null,{badToken:true})});
