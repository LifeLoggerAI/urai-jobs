'use strict'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const {createRequire}=require('node:module')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const sourcePath=path.join(root,'functions/src/jobs/createJob.ts')
const requireRoot=createRequire(path.join(root,'functions/package.json'))
const ts=requireRoot('typescript')
let records, created, transactions, afterFirstTransaction
function reset(){records=new Map();created=[];transactions=0;afterFirstTransaction=null}
function snapshot(key){return {exists:records.has(key),data:()=>records.get(key)}}
function ref(key){return {key,get:async()=>snapshot(key),collection:x=>({doc:y=>ref(key+'/'+x+'/'+y)})}}
const db={
 collection:name=>({doc:id=>ref(name+'/'+id),where:()=>({where:()=>({limit:()=>({get:async()=>({size:0})})})})}),
 runTransaction:async callback=>{
  transactions++
  const transaction={
   get:async r=>snapshot(r.key),
   create:(r,data)=>{created.push(r.key);records.set(r.key,data)},
   set:(r,data)=>{records.set(r.key,data)},
   update:(r,data)=>{records.set(r.key,{...records.get(r.key),...data})},
  }
  const value=await callback(transaction)
  if(transactions===1 && afterFirstTransaction)afterFirstTransaction()
  return value
 }
}
const modules={
 'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({server:true})},Timestamp:{fromMillis:x=>x}},
 'firebase-functions/v1/https':{HttpsError:class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}},
 '@urai-jobs/shared-types':{},
 '../core/auth.js':{withAuthenticatedRole:(roles,handler)=>handler},
 '../core/errors.js':{httpsError:(code,message)=>new modules['firebase-functions/v1/https'].HttpsError(code,message)},
 '../core/firestore-paths.js':{jobDoc:id=>ref('jobs/'+id),jobQueueEntryDoc:id=>ref('jobQueueEntries/'+id)},
 '../core/jobsReliability.js':{bindingMatches:(b,e)=>b.ownerUid===e.ownerUid&&b.jobType===e.jobType&&b.requestFingerprint===e.requestFingerprint,buildIdempotencyBindingId:()=> 'same-key',buildRequestFingerprint:()=> 'fingerprint'},
 './studioLifeMovieContract.js':{StudioLifeMovieRenderPayloadSchema:{safeParse:()=>({success:true})}},
 '../core/runtimeJobTypes.js':{isActiveRuntimeJobType:()=>true,RUNTIME_JOB_REGISTRY:new Proxy({},{get:()=>({maxAttempts:1})})},
 '../privacy/consentBlocks.js':{consentBlockRef:(uid,purpose)=>ref('jobConsentBlocks/'+uid+'::'+purpose)}
}
function mockRequire(name){return modules[name] || requireRoot(name)}
const compiled=ts.transpileModule(fs.readFileSync(sourcePath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const sandbox={exports:{},require:mockRequire,process,console,Buffer}
vm.runInNewContext(compiled,sandbox,{filename:sourcePath})
const handler=sandbox.exports.createJob
const user={role:'user',permissions:['jobs:create']}
const auth={auth:{uid:'owner-a'}}
const context=(uid)=>({auth:{uid}})
const consent=(receipt='receipt-old')=>({purpose:'memory.storage',policyVersion:'policy-v1',decisionReceiptId:receipt})
const request=(overrides={})=>({jobType:'demo.test',payload:{},consent:consent(),...overrides})
const block=(uid='owner-a',purpose='memory.storage')=>records.set('jobConsentBlocks/'+uid+'::'+purpose,{active:true,schemaVersion:'consent.revoked.v2'})
async function denied(p,ctx=auth){await assert.rejects(handler(p,ctx,user),e=>e.code==='failed-precondition'&&e.message.includes('revoked'))}
test('revoked single-purpose job denied at admission',async()=>{reset();block();await denied(request());assert.equal(created.length,0)})
test('new receipt after revocation cannot reactivate admission',async()=>{reset();block();await denied(request({consent:consent('receipt-new')}));assert.equal(created.length,0)})
test('blocked idempotent retry denied, not an accepted dedupe',async()=>{reset();block();records.set('jobIdempotencyBindings/same-key',{ownerUid:'owner-a',jobType:'demo.test',requestFingerprint:'fingerprint',jobId:'job-old'});await denied(request({idempotencyKey:'key'}));assert.equal(created.length,0)})
test('unblocked idempotent retry keeps same job reference',async()=>{reset();records.set('jobIdempotencyBindings/same-key',{ownerUid:'owner-a',jobType:'demo.test',requestFingerprint:'fingerprint',jobId:'job-old'});let x=await handler(request({idempotencyKey:'key'}),auth,user);assert.equal(x.jobId,'job-old');assert.equal(created.length,0)})
test('unblocked consent job enters queue',async()=>{reset();let x=await handler(request(),auth,user);assert.ok(x.jobId);assert.ok(created.some(p=>p.startsWith('jobs/')));assert.ok(created.some(p=>p.startsWith('jobQueueEntries/')))})
test('other owner block does not veto a different owner',async()=>{reset();block('owner-b');let x=await handler(request(),auth,user);assert.ok(x.jobId)})
test('one blocked purpose denies plural-consent job',async()=>{reset();block('owner-a','location.context');await denied(request({consent:undefined,consents:[consent(),{purpose:'location.context',policyVersion:'policy-v1',decisionReceiptId:'other'}]}));assert.equal(created.length,0)})
test('race: block appearing after idempotent precheck prevents queue commit',async()=>{reset();afterFirstTransaction=()=>block();await denied(request({idempotencyKey:'key'}));assert.equal(created.length,0)})
test('no consent job preserves legacy idempotent binding',async()=>{reset();records.set('jobIdempotencyBindings/same-key',{ownerUid:'owner-a',jobType:'demo.test',requestFingerprint:'fingerprint',jobId:'job-old'});let x=await handler(request({consent:undefined,idempotencyKey:'key'}),auth,user);assert.equal(x.jobId,'job-old');assert.equal(transactions,0)})
