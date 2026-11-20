'use strict'
const {test,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const {createRequire}=require('node:module')
const repo=path.resolve(__dirname,'..')
const requireFrom=createRequire(repo+'/functions/package.json')
const ts=requireFrom('typescript')
const admin=requireFrom('firebase-admin/app')
const {getFirestore,FieldValue}=requireFrom('firebase-admin/firestore')
assert.equal(process.env.GCLOUD_PROJECT,'demo-urai-execution-r1598')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8649')
const app=admin.initializeApp({projectId:process.env.GCLOUD_PROJECT},'r1598-execution-review')
const db=getFirestore(app)
after(()=>admin.deleteApp(app))
const source=fs.readFileSync(repo+'/functions/src/jobs/executeJob.ts','utf8')
const begin=source.indexOf('const finalized = await db.runTransaction(async (transaction) => {')
const end=source.indexOf('\n    });\n\n    if (!finalized)',begin)
assert.ok(begin>0 && end>begin,'extract actual current-source finalization callback')
const expression=source.slice(begin+'const finalized = await db.runTransaction('.length,end+6)
const digest=x=>crypto.createHash('sha256').update(x).digest('hex')
const ownerDeletionFenceRefs=uid=>[db.collection('accountDeletionFences').doc(uid),db.collection('privacyDeletionTombstones').doc(uid)]
const ownerDeletionFenced=snapshots=>snapshots.some(x=>x.exists)
const consentBlockRef=(uid,purpose)=>db.collection('jobConsentBlocks').doc(digest(uid+'\n'+purpose))
const jobConsentContexts=job=>[...(job.consent?[job.consent]:[]),...(job.consents||[])]
const canFinalizeExecution=(job,lease)=>job.status==='RUNNING' && job.execution?.leaseToken===lease
const js=ts.transpileModule('const callback = '+expression+'; return callback;',
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const makeCallback=(jobRef,queueRef,leaseToken,jobId,result)=>new Function('jobRef','queueRef','leaseToken','jobId','result','FieldValue','ownerDeletionFenceRefs','ownerDeletionFenced','consentBlockRef','jobConsentContexts','canFinalizeExecution',js)(jobRef,queueRef,leaseToken,jobId,result,FieldValue,ownerDeletionFenceRefs,ownerDeletionFenced,consentBlockRef,jobConsentContexts,canFinalizeExecution)
let next=0
async function fixture(){const id='r1598-job-'+(++next),uid='r1598-owner-'+next,lease='synthetic-lease-'+next
 const jobRef=db.collection('jobs').doc(id),queueRef=db.collection('jobQueueEntries').doc(id)
 await jobRef.set({jobId:id,ownerUid:uid,status:'RUNNING',type:'synthetic.test',execution:{leaseToken:lease},consent:{purpose:'memory.storage',policyVersion:'1.0',decisionReceiptId:'synthetic'}})
 await queueRef.set({jobId:id,status:'RUNNING'})
 return {id,uid,lease,jobRef,queueRef}
}
async function finalize(f){const cb=makeCallback(f.jobRef,f.queueRef,f.lease,f.id,{artifact:'synthetic-result'});return db.runTransaction(cb)}

test('native finalization: owner deletion fence cancels running result',async()=>{
 const f=await fixture();await db.collection('accountDeletionFences').doc(f.uid).set({state:'revoked'})
 assert.equal(await finalize(f),false)
 const a=(await f.jobRef.get()).data(),q=(await f.queueRef.get()).data()
 assert.equal(a.status,'CANCELLED');assert.equal(q.status,'CANCELLED');assert.equal(a.result,undefined);assert.equal(a.output,undefined)
})
test('native finalization: Privacy deletion tombstone denies result',async()=>{
 const f=await fixture();await db.collection('privacyDeletionTombstones').doc(f.uid).set({active:false})
 assert.equal(await finalize(f),false)
 assert.equal((await f.jobRef.get()).data().status,'CANCELLED')
})
test('native finalization: consent revocation arrives during worker -> denies result',async()=>{
 const f=await fixture();await consentBlockRef(f.uid,'memory.storage').set({active:true,schemaVersion:'consent.revoked.v2'})
 assert.equal(await finalize(f),false)
 assert.equal((await f.jobRef.get()).data().status,'CANCELLED')
})
test('native finalization: unfenced owner is allowed with lease',async()=>{
 const f=await fixture();assert.equal(await finalize(f),true)
 const a=(await f.jobRef.get()).data();assert.equal(a.status,'SUCCESS');assert.equal(a.result.artifact,'synthetic-result')
})
test('native finalization: stale execution lease cannot publish result',async()=>{
 const f=await fixture();f.lease='incorrect-lease';assert.equal(await finalize(f),false)
 const a=(await f.jobRef.get()).data();assert.equal(a.status,'RUNNING');assert.equal(a.result,undefined)
})
