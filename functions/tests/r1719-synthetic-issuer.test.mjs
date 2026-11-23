import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {after} from 'node:test';
const app=initializeApp({projectId:'demo-urai-r1719'},'r1719-unit');
after(async()=>deleteApp(app));
import {createSyntheticProvenanceBindingInDemoOnly as create} from '../lib/functions/jobs/studioMemoryProvenanceIssuerEmulatorReview.js';
const digest='a'.repeat(64),receipt='receipt_demo_r1719',jid='job_12345678901';
const input=()=>({verifiedOwnerUid:'ownerA',verifiedTenantId:'tenantA',selectedMemoryId:'memoryA',
 selectedManifestId:'manifestA',selectedManifestVersion:2,jobId:jid,renderPlanDigest:digest,
 decisionReceiptId:receipt,policyVersion:'review-v2',
 syntheticSpatialChecked:true,syntheticStudioChecked:true,syntheticPrivacyChecked:true});
const job=()=>({sourceSystem:'urai-studio',ownerUid:'ownerA',tenantId:'tenantA',jobId:jid,
 jobType:'studio.render.video',status:'SUCCESS',
 consent:{purpose:'life-movie.render',policyVersion:'review-v2',decisionReceiptId:receipt},
 output:{renderPlanDigest:digest},outputDeletedAt:null});
function fakeDb(){
 const memoryPath='studioMemoryRenderProvenanceReviewMemories/'+createHash('sha256').update('ownerA\nmemoryA').digest('hex');
 const records={['jobs/'+jid]:job(),[memoryPath]:{ownerUid:'ownerA',memoryId:'memoryA',
 replayManifestId:'manifestA',manifestVersion:2,demo:false,deleted:false}};let reads=0,commits=0;
 const doc=(path)=>({path});
 const db={projectId:'demo-urai-r1719',collection(name){return{doc(id){return doc(name+'/'+id)}}},
 async runTransaction(fn){
  const changes=[];
  const tx={
   async get(ref){reads++;const v=records[ref.path];return {exists:v!==undefined,data:()=>v&&structuredClone(v)}},
   create(ref,v){changes.push([ref.path,v])}
  };
  const result=await fn(tx);
  if(changes.some(([p])=>records[p]!==undefined))throw Error('duplicate');
  for(const [p,v] of changes)records[p]=v;
  if(changes.length)commits++;
  return result;
 }};
 return {db,records,stats:()=>({reads,commits})};
}
test('production-shaped environment is unconditionally denied before database I/O',async()=>{
 const saved={GCLOUD_PROJECT:process.env.GCLOUD_PROJECT,FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST,
  URAI_PRIVATE_MEMORY_WRITES_ENABLED:process.env.URAI_PRIVATE_MEMORY_WRITES_ENABLED};
 const f=fakeDb();delete process.env.FIRESTORE_EMULATOR_HOST;
 try{assert.deepEqual(await create(f.db,input()),{status:'unavailable'});assert.equal(f.stats().reads,0)}
 finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
async function withDemo(fn){
 const env={GCLOUD_PROJECT:'demo-urai-r1719',FIRESTORE_EMULATOR_HOST:'127.0.0.1:28771',URAI_PRIVATE_MEMORY_WRITES_ENABLED:'false'};
 const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 const cred=process.env.GOOGLE_APPLICATION_CREDENTIALS;
 delete process.env.GOOGLE_APPLICATION_CREDENTIALS;Object.assign(process.env,env);
 try{await fn()}finally{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 if(cred===undefined)delete process.env.GOOGLE_APPLICATION_CREDENTIALS;else process.env.GOOGLE_APPLICATION_CREDENTIALS=cred}
}
test('single synthetic atomic forward/reverse claim in exact disposable demo only',async()=>withDemo(async()=>{
 const f=fakeDb();assert.deepEqual(await create(f.db,input()),{status:'created'});
 assert.equal(f.stats().commits,1);assert.equal(Object.keys(f.records).length,4);
 assert.deepEqual(await create(f.db,input()),{status:'unavailable'});
 assert.equal(f.stats().commits,1);
}));
const negatives=[
 ['missing Spatial synthetic precondition',x=>x.syntheticSpatialChecked=false],
 ['missing Studio synthetic precondition',x=>x.syntheticStudioChecked=false],
 ['missing Privacy synthetic precondition',x=>x.syntheticPrivacyChecked=false],
 ['wrong selected manifest',x=>x.selectedManifestId='other'],
 ['wrong selected version',x=>x.selectedManifestVersion=3],
 ['wrong tenant',x=>x.verifiedTenantId='foreign'],
 ['wrong owner',x=>x.verifiedOwnerUid='foreign'],
 ['wrong receipt',x=>x.decisionReceiptId='other'],
 ['wrong policy',x=>x.policyVersion='other'],
 ['invalid job ID',x=>x.jobId='../../bad'],
 ['invalid digest',x=>x.renderPlanDigest='invalid'],
];
for(const [name,mutation] of negatives)test('synthetic issuance denies '+name,async()=>withDemo(async()=>{
 const f=fakeDb(),v=input();mutation(v);
 assert.deepEqual(await create(f.db,v),{status:'unavailable'});
 assert.equal(f.stats().commits,0);
}));
const fences=[
 ['deletion fence','accountDeletionFences/ownerA',{active:true}],
 ['tombstone','privacyDeletionTombstones/ownerA',{active:true}],
 ['consent block','jobConsentBlocks/'+createHash('sha256').update('ownerA\nlife-movie.render').digest('hex'),{active:true}],
];
for(const [name,path,data] of fences)test('synthetic issuance denies '+name,async()=>withDemo(async()=>{
 const f=fakeDb();f.records[path]=data;
 assert.deepEqual(await create(f.db,input()),{status:'unavailable'});
 assert.equal(f.stats().commits,0);
}));
test('missing current Job fails closed',async()=>withDemo(async()=>{
 const f=fakeDb();delete f.records['jobs/'+jid];
 assert.deepEqual(await create(f.db,input()),{status:'unavailable'});
}));
test('reverse claim blocks reusing a job for another Memory',async()=>withDemo(async()=>{
 const f=fakeDb();assert.equal((await create(f.db,input())).status,'created');
 const x=input();x.selectedMemoryId='memoryB';
 const secondPath='studioMemoryRenderProvenanceReviewMemories/'+createHash('sha256').update('ownerA\nmemoryB').digest('hex');
 f.records[secondPath]={ownerUid:'ownerA',memoryId:'memoryB',replayManifestId:'manifestA',manifestVersion:2,demo:false,deleted:false};
 assert.deepEqual(await create(f.db,x),{status:'unavailable'});
 assert.equal(f.stats().commits,1);
}));

const memoryCases=[
 ['missing separate Memory proof',f=>{for(const k of Object.keys(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))delete f.records[k]}],
 ['Memory deleted',f=>{for(const [k,v] of Object.entries(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))v.deleted=true}],
 ['Memory demo ambiguous',f=>{for(const [k,v] of Object.entries(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))delete v.demo}],
 ['Memory manifest changed',f=>{for(const [k,v] of Object.entries(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))v.replayManifestId='changed'}],
 ['Memory version replaced',f=>{for(const [k,v] of Object.entries(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))v.manifestVersion=3}],
 ['Memory owner changed',f=>{for(const [k,v] of Object.entries(f.records))if(k.startsWith('studioMemoryRenderProvenanceReviewMemories/'))v.ownerUid='foreign'}],
];
for(const [name,mutate] of memoryCases)test('denies '+name,async()=>withDemo(async()=>{
 const f=fakeDb();mutate(f);assert.deepEqual(await create(f.db,input()),{status:'unavailable'});
 assert.equal(f.stats().commits,0);
}));
test('missing Firebase project app configuration denies',async()=>withDemo(async()=>{
 const f=fakeDb();const old=process.env.GCLOUD_PROJECT;process.env.GCLOUD_PROJECT='other-project';
 try{assert.deepEqual(await create(f.db,input()),{status:'unavailable'});assert.equal(f.stats().reads,0)}
 finally{process.env.GCLOUD_PROJECT=old}
}));
