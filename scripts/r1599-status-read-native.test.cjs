'use strict'
const {test,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const crypto=require('node:crypto')
const {createRequire}=require('node:module')
const root=path.resolve(__dirname,'..')
const load=createRequire(root+'/functions/package.json')
const ts=load('typescript'), {initializeApp,deleteApp}=load('firebase-admin/app')
const {getFirestore}=load('firebase-admin/firestore')
assert.equal(process.env.GCLOUD_PROJECT,'demo-urai-status-r1599')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8669')
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'r1599-status-read')
const db=getFirestore(app)
after(()=>deleteApp(app))
const hash=(uid,purpose)=>crypto.createHash('sha256').update(uid+'\n'+purpose).digest('hex')
const consentBlockRef=(uid,purpose)=>db.collection('jobConsentBlocks').doc(hash(uid,purpose))
const ownerDeletionFenceRefs=uid=>[db.collection('accountDeletionFences').doc(uid),db.collection('privacyDeletionTombstones').doc(uid)]
const ownerDeletionFenced=xs=>xs.some(x=>x.exists)
const isConsentContext=x=>!!x && typeof x.purpose==='string' && typeof x.policyVersion==='string' && typeof x.decisionReceiptId==='string'
const modules={
 zod:load('zod'),
 '../core/auth.js':{withAuthenticatedRole:(roles,fn)=>fn},
 '../core/errors.js':{httpsError:(code,message)=>Object.assign(new Error(message),{code})},
 '../core/firestore-paths.js':{jobDoc:id=>db.collection('jobs').doc(id)},
 '../privacy/consentBlocks.js':{consentBlockRef,isConsentContext},
 '../privacy/ownerDeletionFence.js':{ownerDeletionFenceRefs,ownerDeletionFenced}
}
const src=fs.readFileSync(root+'/functions/src/jobs/getJobStatus.ts','utf8')
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const modExports={};vm.runInNewContext(compiled,{exports:modExports,require:n=>{if(!(n in modules))throw Error('Unexpected dependency '+n);return modules[n]},console}, {filename:'actual-getJobStatus.js'})
const handler=modExports.getJobStatus
let sequence=0
async function fixture(uid='owner-r1599',purpose='memory.storage'){
 const jobId='r1599-job-'+(++sequence)
 await db.collection('jobs').doc(jobId).set({jobId,ownerUid:uid,status:'SUCCESS',result:{artifact:'SYNTHETIC_PRIVATE_RESULT'},output:{artifact:'SYNTHETIC_PRIVATE_OUTPUT'},consent:{purpose,policyVersion:'r1599-test',decisionReceiptId:'synthetic-receipt'}})
 return {jobId,uid,purpose}
}
async function read(jobId,uid='owner-r1599',role='user'){return handler({jobId},{auth:{uid}},{role})}
async function denied(jobId,uid='owner-r1599',role='user'){await assert.rejects(read(jobId,uid,role),e=>e.code==='failed-precondition')}
test('native: authorized owner sees own unfenced result',async()=>{const x=await fixture();assert.equal((await read(x.jobId)).job.result.artifact,'SYNTHETIC_PRIVATE_RESULT')})
test('native: foreign user denied even when unfenced',async()=>{const x=await fixture();await assert.rejects(read(x.jobId,'other-user'),e=>e.code==='permission-denied')})
test('native: owner deletion fence denies stored output',async()=>{const x=await fixture();await db.collection('accountDeletionFences').doc(x.uid).set({state:'revoked'});await denied(x.jobId)})
test('native: Privacy tombstone denies stored output',async()=>{const x=await fixture('grandma-r1599');await db.collection('privacyDeletionTombstones').doc(x.uid).set({active:true});await denied(x.jobId,x.uid)})
test('native: malformed false-active tombstone remains fail closed',async()=>{const x=await fixture('false-active-r1599');await db.collection('privacyDeletionTombstones').doc(x.uid).set({active:false});await denied(x.jobId,x.uid)})
test('native: revoked purpose denies old successful output',async()=>{const x=await fixture('revoked-r1599');await consentBlockRef(x.uid,x.purpose).set({active:true});await denied(x.jobId,x.uid)})
test('native: other owner revocation does not affect this owner',async()=>{const x=await fixture('allowed-r1599');await consentBlockRef('not-allowed-r1599',x.purpose).set({active:true});assert.equal((await read(x.jobId,x.uid)).job.status,'SUCCESS')})
test('native: operator cannot bypass owner deletion fence',async()=>{const x=await fixture('operator-target-r1599');await db.collection('accountDeletionFences').doc(x.uid).set({state:'revoked'});await denied(x.jobId,'operator-r1599','operator')})
test('native: plural consent one revoked denies stored output',async()=>{const x=await fixture('plural-r1599');await db.collection('jobs').doc(x.jobId).update({consents:[{purpose:'location.context',policyVersion:'r1599-test',decisionReceiptId:'s2'}]});await consentBlockRef(x.uid,'location.context').set({active:true});await denied(x.jobId,x.uid)})
test('native: missing ownerUid fails closed',async()=>{const x=await fixture('missing-owner-r1599');await db.collection('jobs').doc(x.jobId).update({ownerUid: load('firebase-admin/firestore').FieldValue.delete()});await assert.rejects(read(x.jobId,x.uid),e=>e.code==='permission-denied')})
