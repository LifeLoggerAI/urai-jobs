'use strict'
const {test,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {createRequire}=require('node:module')
const root=path.resolve(__dirname,'..'),load=createRequire(root+'/functions/package.json')
const ts=load('typescript'),{initializeApp,deleteApp}=load('firebase-admin/app'),{getFirestore}=load('firebase-admin/firestore')
assert.equal(process.env.GCLOUD_PROJECT,'demo-urai-movie-r1603')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8709')
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT},'movie-r1603'),db=getFirestore(app)
after(()=>deleteApp(app))
const source=fs.readFileSync(root+'/functions/src/jobs/studioLifeMovieBridge.ts','utf8')
const start=source.indexOf('async function loadBoundJob('),end=source.indexOf('async function deleteBoundMovieOutput(',start)
assert.ok(start>0 && end>start)
const snippet=source.slice(start,end)+'\nreturn {assertCurrentMovieReadAuthority,signedMovieAccess};'
const compiled=ts.transpileModule(snippet,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const hash=(uid,purpose)=>crypto.createHash('sha256').update(uid+'\n'+purpose).digest('hex')
const consentBlockRef=(uid,purpose)=>db.collection('jobConsentBlocks').doc(hash(uid,purpose))
const ownerDeletionFenceRefs=uid=>[db.collection('accountDeletionFences').doc(uid),db.collection('privacyDeletionTombstones').doc(uid)]
const ownerDeletionFenced=xs=>xs.some(x=>x.exists)
const isConsentContext=x=>!!x && x.purpose==='life-movie.render' && typeof x.policyVersion==='string' && typeof x.decisionReceiptId==='string'
const jobDoc=id=>db.collection('jobs').doc(id)
let hook=null;let storageCalls=[]
const getStorage=()=>({bucket:b=>({file:o=>({
 async getSignedUrl(){storageCalls.push('SIGN');if(hook)await hook('SIGN');return ['https://invalid.example/synthetic-signed-movie']},
 async download(){storageCalls.push('SUBTITLE');if(hook)await hook('SUBTITLE');return [Buffer.from('synthetic caption')]}
})})})
const env={GCS_BUCKET_NAME:'r1603-synthetic-bucket',URAI_STUDIO_OUTPUT_BUCKETS:''}
const movie=new Function('jobDoc','consentBlockRef','ownerDeletionFenceRefs','ownerDeletionFenced','isConsentContext','getStorage','process',compiled)(jobDoc,consentBlockRef,ownerDeletionFenceRefs,ownerDeletionFenced,isConsentContext,getStorage,{env})
let n=0
async function fixture({subtitle=false}={}){n++;const tenantId='synthetic-tenant-'+n,userId='synthetic-owner-'+n,jobId='synthetic-job-'+n
 const p='gs://r1603-synthetic-bucket/tenants/'+tenantId+'/life-movies/'
 await jobDoc(jobId).set({jobId,ownerUid:userId,tenantId,sourceSystem:'urai-studio',jobType:'studio.render.video',status:'SUCCESS',consent:{purpose:'life-movie.render',policyVersion:'r1603',decisionReceiptId:'synthetic'},output:{outputs:[{kind:'mp4',ref:p+'video.mp4',mimeType:'video/mp4'},...(subtitle?[{kind:'srt',ref:p+'video.srt'}]:[])]}})
 return {tenantId,userId,jobId}
}
async function access(f,mode='attachment'){return movie.signedMovieAccess(f.tenantId,f.userId,f.jobId,mode)}
async function denied(f,match){await assert.rejects(access(f),new RegExp(match))}
test('authorized synthetic owner can obtain a short lived signed movie URL',async()=>{const f=await fixture();storageCalls=[];hook=null;const x=await access(f);assert.equal(x.video.url,'https://invalid.example/synthetic-signed-movie');assert.equal(x.publicReleaseAuthorized,false);assert.deepEqual(storageCalls,['SIGN'])})
test('owner account deletion blocks signing',async()=>{const f=await fixture();await db.collection('accountDeletionFences').doc(f.userId).set({state:'revoked'});storageCalls=[];await denied(f,'life_movie_owner_deleted');assert.deepEqual(storageCalls,[])})
test('Privacy tombstone even false-active blocks signing',async()=>{const f=await fixture();await db.collection('privacyDeletionTombstones').doc(f.userId).set({active:false});storageCalls=[];await denied(f,'life_movie_owner_deleted');assert.deepEqual(storageCalls,[])})
test('render purpose revocation blocks signing',async()=>{const f=await fixture();await consentBlockRef(f.userId,'life-movie.render').set({active:true});storageCalls=[];await denied(f,'life_movie_consent_revoked');assert.deepEqual(storageCalls,[])})
test('deletion during in-flight signing denies return of newly signed URL',async()=>{const f=await fixture();storageCalls=[];hook=async phase=>{if(phase==='SIGN'){await db.collection('accountDeletionFences').doc(f.userId).set({active:true})}};await denied(f,'life_movie_owner_deleted');assert.deepEqual(storageCalls,['SIGN']);hook=null})
test('revocation while subtitles download denies signed URL and captions',async()=>{const f=await fixture({subtitle:true});storageCalls=[];hook=async phase=>{if(phase==='SUBTITLE'){await consentBlockRef(f.userId,'life-movie.render').set({active:true})}};await denied(f,'life_movie_consent_revoked');assert.deepEqual(storageCalls,['SIGN','SUBTITLE']);hook=null})
test('foreign owner and tenant cannot retrieve another owner movie',async()=>{const f=await fixture();storageCalls=[];await assert.rejects(movie.signedMovieAccess(f.tenantId,'foreign-owner',f.jobId,'inline'),/job_boundary_mismatch/);await assert.rejects(movie.signedMovieAccess('foreign-tenant',f.userId,f.jobId,'inline'),/job_boundary_mismatch/);assert.deepEqual(storageCalls,[])})
test('owner deletion guard also denies Studio status projection',async()=>{const f=await fixture();await db.collection('accountDeletionFences').doc(f.userId).set({active:true});const job=(await jobDoc(f.jobId).get()).data();await assert.rejects(movie.assertCurrentMovieReadAuthority(job,f.userId),/life_movie_owner_deleted/)})
test('other owner deletion does not block authorized movie',async()=>{const f=await fixture();await db.collection('accountDeletionFences').doc('unrelated-owner').set({active:true});hook=null;const x=await access(f);assert.equal(x.publicReleaseAuthorized,false)})
