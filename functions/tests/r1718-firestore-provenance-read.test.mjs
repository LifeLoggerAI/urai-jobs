import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protectedBindingDocumentId as makeKey,readCurrentProtectedMemoryRenderConsistency as read} from '../lib/functions/jobs/studioMemoryProvenanceFirestoreRead.js';
const owner='ownerA',tenant='tenantA',jobId='job_12345678901',digest='a'.repeat(64),receipt='receipt_review_1718';
const selected=()=>({verifiedOwnerUid:owner,verifiedTenantId:tenant,selectedMemoryId:'memoryA',selectedManifestId:'manifestA',selectedManifestVersion:2});
const key=makeKey(selected()),bindingPath='studioMemoryRenderProvenanceReviewBindings/'+key;
const jobPath='jobs/'+jobId,block='jobConsentBlocks/'+createHash('sha256').update(owner+'\nlife-movie.render').digest('hex');
const binding=()=>({source:'jobs-protected-record',ownerUid:owner,tenantId:tenant,jobId,memoryId:'memoryA',replayManifestId:'manifestA',
 manifestVersion:2,renderPlanDigest:digest,decisionReceiptId:receipt,policyVersion:'policy-v2',revoked:false});
const job=()=>({sourceSystem:'urai-studio',ownerUid:owner,tenantId:tenant,jobId,jobType:'studio.render.video',status:'SUCCESS',
 consent:{purpose:'life-movie.render',policyVersion:'policy-v2',decisionReceiptId:receipt},output:{renderPlanDigest:digest},outputDeletedAt:null});
function makeDb(){
 const docs={[bindingPath]:binding(),[jobPath]:job()};
 let reads=0;
 const paths=[];let onRead=null;
 const db={collection(collection){return{doc(id){const path=collection+'/'+id;return{get:async()=>{
   reads++;if(onRead)onRead(path,reads,docs);
   paths.push(path);
   const snap=Object.hasOwn(docs,path)?structuredClone(docs[path]):undefined;
   return {exists:snap!==undefined,data:()=>snap};
 }}}}}};
 return {db,docs,paths,setHook:fn=>onRead=fn,reads:()=>reads};
}
test('deterministic hashed lookup and minimal non-capability response',async()=>{
 const f=makeDb(),v=await read(f.db,selected());assert.deepEqual(v,{status:'consistent'});
 assert.equal(v.jobId,undefined);assert.equal(v.url,undefined);
 assert.deepEqual(f.paths,[bindingPath,'accountDeletionFences/'+owner,'privacyDeletionTombstones/'+owner,
 block,jobPath,bindingPath,'accountDeletionFences/'+owner,'privacyDeletionTombstones/'+owner,block,jobPath]);
 assert.equal(key.length,64);
});
test('missing binding fails without Jobs enumeration',async()=>{
 const f=makeDb();delete f.docs[bindingPath];assert.deepEqual(await read(f.db,selected()),{status:'unavailable'});
 assert.equal(f.paths.includes(jobPath),false);
});
const negatives=[
 ['fenced deletion',f=>f.docs['accountDeletionFences/'+owner]={active:true}],
 ['tombstoned owner',f=>f.docs['privacyDeletionTombstones/'+owner]={active:false}],
 ['blocked render',f=>f.docs[block]={active:true}],
 ['unknown consent block',f=>f.docs[block]={meaning:'unknown'}],
 ['revoked binding',f=>f.docs[bindingPath].revoked=true],
 ['wrong tenant binding',f=>f.docs[bindingPath].tenantId='foreign'],
 ['wrong selected memory',f=>f.selection={...selected(),selectedMemoryId:'foreign'}],
 ['wrong selected manifest',f=>f.selection={...selected(),selectedManifestId:'foreign'}],
 ['wrong manifest version',f=>f.selection={...selected(),selectedManifestVersion:1}],
 ['non-success Job',f=>f.docs[jobPath].status='FAILED'],
 ['deleted media',f=>f.docs[jobPath].outputDeletedAt='gone'],
 ['mismatched consent',f=>f.docs[jobPath].consent.decisionReceiptId='other'],
 ['wrong render plan',f=>f.docs[jobPath].output.renderPlanDigest='c'.repeat(64)],
 ['wrong Job source',f=>f.docs[jobPath].sourceSystem='external'],
 ['absent Job',f=>delete f.docs[jobPath]],
];
for(const [name,mutate] of negatives)test('denies '+name,async()=>{
 const f=makeDb();f.selection=selected();mutate(f);
 assert.deepEqual(await read(f.db,f.selection),{status:'unavailable'});
});
const mutations=[
 ['job revoked mid-read',d=>d[jobPath].status='CANCELLED'],
 ['binding revoked mid-read',d=>d[bindingPath].revoked=true],
 ['manifest changed mid-read',d=>d[bindingPath].manifestVersion=3],
 ['output changed mid-read',d=>d[jobPath].output.renderPlanDigest='c'.repeat(64)],
 ['deletion fence appears mid-read',d=>d['accountDeletionFences/'+owner]={active:true}],
 ['consent block appears mid-read',d=>d[block]={active:true}],
 ['tombstone appears mid-read',d=>d['privacyDeletionTombstones/'+owner]={active:true}],
 ['otherwise valid binding changes mid-read',d=>d[bindingPath].policyVersion='policy-v3'],
];
for(const [name,mutate] of mutations)test('denies '+name,async()=>{
 const f=makeDb();f.setHook((_path,n,d)=>{if(n===6)mutate(d)});
 assert.deepEqual(await read(f.db,selected()),{status:'unavailable'});
});
test('rejects missing or unsafe selection before any protected reads',async()=>{
 for(const changed of [{selectedMemoryId:'../../other'},{verifiedOwnerUid:null},
 {verifiedTenantId:'x/y'},{selectedManifestVersion:0},{selectedManifestVersion:1.5}]){
   const f=makeDb();
   assert.deepEqual(await read(f.db,{...selected(),...changed}),{status:'unavailable'});
   assert.equal(f.reads(),0);
 }
});
test('reader exception fails closed',async()=>{
 const f=makeDb();f.setHook(()=>{throw Error('denied')});
 assert.deepEqual(await read(f.db,selected()),{status:'unavailable'});
});
