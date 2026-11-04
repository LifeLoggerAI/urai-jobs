import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
import vm from 'node:vm';

// Actual worker functions with in-memory Firestore; no provider or private data.
const worker=readFileSync(new URL('../workers/studio-worker/index.js',import.meta.url),'utf8');
const start=worker.indexOf('function checkedStudioConsentBlockState(snapshot) {');
const end=worker.indexOf('\nfunction timingSafeTokenMatch(',start);
assert.ok(start>=0&&end>start);
const original=readFileSync(new URL('../functions/src/privacy/ownerDeletionFence.ts',import.meta.url),'utf8');
const canon=(await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(original)).toString('base64'))).ownerDeletionFenceState;
const present=value=>({exists:true,data:()=>value});
function fixture(type='studio.render.video'){
 const job={jobId:'synthetic-job',jobType:type,tenantId:'synthetic-tenant',ownerUid:'synthetic-owner',leaseToken:'synthetic-lease',payload:{id:'synthetic'}};
 const current={...job,status:'RUNNING',execution:{leaseToken:job.leaseToken},consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)}};
 let owner=present({dataRightsDeletionPendingCentralPrivacy:false}),block={exists:false},failed=null,stalled=null;
 const env={};
 const reads={jobs:0,users:0,jobConsentBlocks:0};
 const admin={firestore:()=>({collection:name=>({doc:id=>({async get(){
   assert.ok(Object.hasOwn(reads,name));reads[name]++;
   if(name==='users')assert.equal(id,job.ownerUid);
   if(name==='jobs')assert.equal(id,job.jobId);
   if(name==='jobConsentBlocks')assert.equal(id,createHash('sha256').update(job.ownerUid+'\nlife-movie.render').digest('hex'));
   if(name===failed)throw Error('synthetic_firestore_failure');
   if(name===stalled)return new Promise(()=>{});
   return name==='jobs'?present(current):name==='users'?owner:block;
 }})})})};
 const module={exports:{}};
 vm.runInNewContext(worker.slice(start,end)+'\nmodule.exports={createRenderControl,checkedStudioOwnerDeletionFenceState};',{
  module,admin,Buffer,Object,Array,Promise,Error,AbortController,setTimeout,clearTimeout,
  process:{env},crypto:{createHash},
  safeSegment:x=>x,canonicalJson:JSON.stringify,
 },{timeout:2000,filename:'worker-guard-exact-source.js'});
 return {job,current,reads,make:()=>module.exports.createRenderControl(job),state:module.exports.checkedStudioOwnerDeletionFenceState,
  owner:x=>owner=x,block:x=>block=x,fail:x=>failed=x,stall:x=>stalled=x,env};
}

test('worker state matches authoritative owner fence and never runs getters',()=>{
 const f=fixture();let called=0;
 const trap=Object.defineProperty({},'dataRightsDeletionPendingCentralPrivacy',{get(){called++;return false}});
 const cases=[
  [null,'unverified'],[undefined,'unverified'],[{},'unverified'],[{exists:false},'unverified'],
  [present(null),'unverified'],[present([]),'unverified'],[present({}),'clear'],
  [present({dataRightsDeletionPendingCentralPrivacy:false}),'clear'],
  [present({dataRightsDeletionPendingCentralPrivacy:true}),'pending'],
  [present({dataRightsDeletionPendingCentralPrivacy:'false'}),'unverified'],
  [present(Object.create({dataRightsDeletionPendingCentralPrivacy:false})),'unverified'],
  [present(trap),'unverified'],
  [{exists:true,data:()=>{throw Error('unavailable')}},'unverified'],
  [present(new Proxy({dataRightsDeletionPendingCentralPrivacy:false},{getOwnPropertyDescriptor(){throw Error('trap')}})),'unverified']
 ];
 for(const [input,status] of cases){assert.equal(f.state(input),status);assert.equal(canon(input),status)}
 assert.equal(called,0);
});
for(const type of ['studio.render.video','studio.assemble.video']){
 test(type+' checks owner before media, and aborts after deletion',async()=>{
  const f=fixture(type),c=f.make();try{
   await c.check();assert.equal(f.reads.users,1);assert.equal(f.reads.jobConsentBlocks,1);
   f.owner(present({dataRightsDeletionPendingCentralPrivacy:true}));
   await assert.rejects(c.check(),/render_owner_deletion_pending/);
   assert.equal(c.signal.aborted,true);assert.equal(f.reads.jobConsentBlocks,1);
  }finally{c.stop()}
 });
 for(const [label,owner,code] of [
  ['pending',present({dataRightsDeletionPendingCentralPrivacy:true}),'render_owner_deletion_pending'],
  ['missing',{exists:false},'render_authority_unavailable'],
  ['malformed',present({dataRightsDeletionPendingCentralPrivacy:'false'}),'render_authority_unavailable'],
  ['inherited',present(Object.create({dataRightsDeletionPendingCentralPrivacy:false})),'render_authority_unavailable'],
 ])test(type+' rejects '+label+' owner',async()=>{
  const f=fixture(type);f.owner(owner);const c=f.make();
  try{await assert.rejects(c.check(),new RegExp(code));assert.equal(f.reads.jobConsentBlocks,0)}finally{c.stop()}
 });
 test(type+' denies unreadable owner backend',async()=>{
  const f=fixture(type);f.fail('users');const c=f.make();
  try{await assert.rejects(c.check(),/render_authority_unavailable/);assert.equal(f.reads.jobConsentBlocks,0)}finally{c.stop()}
 });
}
for(const [label,change] of [
 ['missing consent',v=>delete v.consent],
 ['wrong purpose',v=>v.consent.purpose='other'],
 ['wrong policy',v=>v.consent.policyVersion='1.0.0'],
 ['forged receipt',v=>v.consent.decisionReceiptId='invalid'],
 ['missing owner',v=>v.ownerUid=''],
])test('worker denies '+label+' before owner lookup',async()=>{
 const f=fixture();change(f.current);const c=f.make();
 try{await assert.rejects(c.check(),/render_authority_unavailable|render_job_binding_mismatch/);assert.equal(f.reads.users,0)}finally{c.stop()}
});
for(const [label,block,expected] of [
 ['revoked',present({active:true}),'render_consent_revoked'],
 ['malformed',present({active:'false'}),'render_authority_unavailable'],
])test('worker rejects '+label+' consent block',async()=>{
 const f=fixture();f.block(block);const c=f.make();
 try{await assert.rejects(c.check(),new RegExp(expected));assert.equal(f.reads.users,1)}finally{c.stop()}
});

// Additional synthetic race, binding and deadline regressions for R424.
for(const [label,change,expected] of [
 ['revoked lease',v=>v.execution.leaseToken='stale-lease','render_lease_revoked'],
 ['cross-tenant',v=>v.tenantId='wrong-tenant','render_job_binding_mismatch'],
 ['altered payload',v=>v.payload={...v.payload,id:'replaced'},'render_job_binding_mismatch'],
])test('worker rejects '+label+' before private media authority reads',async()=>{
 const f=fixture();change(f.current);const c=f.make();
 try{await assert.rejects(c.check(),new RegExp(expected));assert.equal(f.reads.users,0);assert.equal(f.reads.jobConsentBlocks,0);assert.equal(c.signal.aborted,true)}finally{c.stop()}
});

test('worker rejects Firestore consent backend failure after owner clears',async()=>{
 const f=fixture();f.fail('jobConsentBlocks');const c=f.make();
 try{await assert.rejects(c.check(),/render_authority_unavailable/);assert.equal(f.reads.users,1);assert.equal(c.signal.aborted,true)}finally{c.stop()}
});

test('worker revocation between polls aborts future media access',async()=>{
 const f=fixture(),c=f.make();try{
  await c.check();assert.equal(f.reads.users,1);
  f.block(present({active:true}));
  await assert.rejects(c.check(),/render_consent_revoked/);
  assert.equal(c.signal.aborted,true);
  await assert.rejects(c.check(),/render_consent_revoked/);
 }finally{c.stop()}
});

test('worker deadline aborts stalled owner backend before consent or media read',async()=>{
 const f=fixture();f.env.URAI_STUDIO_RENDER_TIMEOUT_MS='20';f.stall('users');
 const c=f.make();try{
  await assert.rejects(c.check(),/render_deadline_exceeded/);
  assert.equal(c.signal.aborted,true);
  assert.equal(f.reads.users,1);
  assert.equal(f.reads.jobConsentBlocks,0);
 }finally{c.stop()}
});
