import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { consentBlockRef } from '../privacy/consentBlocks.js';

const publisherToken = defineSecret('URAI_CAPTURED_REALITY_PUBLISHER_TOKEN');
const engineToken = defineSecret('CAPTURED_REALITY_ENGINE_TOKEN');

const PublishSchema = z.object({
  jobId: z.string().trim().regex(/^[A-Za-z0-9._:-]{8,512}$/),
  assetId: z.string().trim().regex(/^[A-Za-z0-9._-]{1,128}$/),
  expectedRuntimeSha256: z.string().trim().regex(/^[a-f0-9]{64}$/),
}).strict();

const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const ARTIFACT=/^cr-artifact:[a-f0-9]{64}:[a-f0-9]{64}$/;
const MAX_RUNTIME_BYTES=512*1024*1024;

function productionRuntime(){
  return new Set(['staging','prod','production']).has(String(process.env.URAI_ENV||process.env.NODE_ENV||'').toLowerCase());
}
function secretValue(secret: ReturnType<typeof defineSecret>, envName:string){
  try{return secret.value()||String(process.env[envName]||'');}catch{return String(process.env[envName]||'');}
}
function authorized(header:string){
  const token=secretValue(publisherToken,'URAI_CAPTURED_REALITY_PUBLISHER_TOKEN');
  if(!token) return !productionRuntime()&&process.env.FUNCTIONS_EMULATOR==='true';
  const a=createHash('sha256').update(header||'').digest();
  const b=createHash('sha256').update('Bearer '+token).digest();
  return timingSafeEqual(a,b);
}
function configuredEngineUrl(){
  const raw=String(process.env.CAPTURED_REALITY_ENGINE_URL||'').trim();
  const url=new URL(raw);
  if((productionRuntime()&&url.protocol!=='https:')||url.username||url.password||url.search||url.hash) throw new Error('captured_reality_engine_endpoint_invalid');
  return url.toString().replace(/\/$/,'');
}
function configuredBucket(){
  const bucket=String(process.env.CAPTURED_REALITY_RUNTIME_BUCKET||'').trim();
  if(!bucket||bucket.includes('/')||bucket.includes('..')) throw new Error('captured_reality_runtime_bucket_unconfigured');
  return bucket;
}
async function boundedArtifact(jobId:string,ref:string,expectedSha:string,expectedSize:number){
  const response=await fetch(configuredEngineUrl()+'/artifact',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{'content-type':'application/json',authorization:'Bearer '+secretValue(engineToken,'CAPTURED_REALITY_ENGINE_TOKEN')},
    body:JSON.stringify({jobId,ref}),
  });
  if(!response.ok||!response.body) throw new Error('captured_reality_artifact_redemption_failed');
  const chunks:Uint8Array[]=[]; let size=0; const hash=createHash('sha256');
  const reader=response.body.getReader();
  try{
    for(;;){
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>expectedSize||size>MAX_RUNTIME_BYTES){await reader.cancel();throw new Error('captured_reality_artifact_size_mismatch');}
      hash.update(value); chunks.push(value);
    }
  }finally{reader.releaseLock();}
  if(size!==expectedSize||hash.digest('hex')!==expectedSha) throw new Error('captured_reality_artifact_fixity_mismatch');
  return Buffer.concat(chunks);
}
async function runtimeConsentCurrent(ownerUid:string){
  const db=getFirestore();
  const [memory,location]=await Promise.all([
    consentBlockRef(ownerUid,'memory.storage').get(),
    consentBlockRef(ownerUid,'location.context').get(),
  ]);
  return memory.data()?.active!==true&&location.data()?.active!==true;
}

export const publishCapturedRealityRuntime=onRequest({
  secrets:[publisherToken,engineToken],cors:false,timeoutSeconds:120,memory:'1GiB',
},async(request,response)=>{
  if(request.method!=='POST'){response.status(405).json({ok:false,error:'method-not-allowed'});return;}
  if(!authorized(String(request.headers.authorization||''))){response.status(401).json({ok:false,error:'unauthorized'});return;}
  const parsed=PublishSchema.safeParse(request.body);
  if(!parsed.success){response.status(400).json({ok:false,error:'invalid-request'});return;}
  const {jobId,assetId,expectedRuntimeSha256}=parsed.data;
  try{
    const db=getFirestore();
    const jobRef=db.collection('jobs').doc(jobId);
    const receiptId=createHash('sha256').update(jobId+'\n'+assetId).digest('hex');
    const receiptRef=db.collection('capturedRealityRuntimeAdmissions').doc(receiptId);
    const [job,existing]=await Promise.all([jobRef.get(),receiptRef.get()]);
    if(!job.exists) throw new Error('captured_reality_job_missing');
    const data=job.data() as Record<string,any>;
    if((data.jobType||data.type)!=='memory.private-source.reconstruct-place'||data.status!=='SUCCESS') throw new Error('captured_reality_job_not_successful');
    const ownerUid=String(data.ownerUid||'');
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(ownerUid)) throw new Error('captured_reality_owner_invalid');
    if(!(await runtimeConsentCurrent(ownerUid))) throw new Error('captured_reality_consent_blocked');
    const runtime=data.output?.runtime||data.result?.runtime;
    const runtimeSha=String(runtime?.sha256||'').toLowerCase();
    const byteSize=Number(runtime?.byteSize);
    const artifactRef=String(runtime?.ref||'');
    const spatialAuthorityHead=String(data.payload?.spatialAuthorityHead||'');
    if(runtimeSha!==expectedRuntimeSha256||!SHA256.test(runtimeSha)||!Number.isSafeInteger(byteSize)||byteSize<1||byteSize>MAX_RUNTIME_BYTES||!ARTIFACT.test(artifactRef)||!SHA40.test(spatialAuthorityHead)) throw new Error('captured_reality_runtime_binding_invalid');
    if(!SHA256.test(String(data.execution?.capturedRealityAcceptedCallbackHash||''))) throw new Error('captured_reality_callback_authority_missing');

    const bucketName=configuredBucket();
    const objectPath=`private-captured-reality/${ownerUid}/${assetId}/runtime/${runtimeSha}.splat`;
    if(existing.exists){
      if(existing.get('ownerUid')!==ownerUid||existing.get('jobId')!==jobId||existing.get('assetId')!==assetId||existing.get('runtimeSha256')!==runtimeSha||existing.get('storageBucket')!==bucketName||existing.get('runtimeObject')!==objectPath||existing.get('revokedAt')) throw new Error('captured_reality_runtime_admission_conflict');
      response.status(200).json({ok:true,replayed:true,admissionId:receiptId,assetId,runtimeSha256:runtimeSha,storageGeneration:String(existing.get('storageGeneration')||'')});
      return;
    }

    const bytes=await boundedArtifact(jobId,artifactRef,runtimeSha,byteSize);
    if(!(await runtimeConsentCurrent(ownerUid))) throw new Error('captured_reality_consent_changed_before_publish');
    const file=getStorage().bucket(bucketName).file(objectPath);
    let generation='';
    try{
      await file.save(bytes,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0},metadata:{
        contentType:'application/octet-stream',cacheControl:'private, no-store',
        metadata:{uraiRuntimeSha256:runtimeSha,uraiCapturedRealityJobId:jobId,uraiSpatialAuthorityHead:spatialAuthorityHead},
      }});
      const [meta]=await file.getMetadata(); generation=String(meta.generation||'');
    }catch(error:any){
      if(error?.code!==412) throw error;
      const [meta]=await file.getMetadata();
      if(String(meta.metadata?.uraiRuntimeSha256||'')!==runtimeSha||String(meta.metadata?.uraiCapturedRealityJobId||'')!==jobId) throw new Error('captured_reality_runtime_object_conflict');
      generation=String(meta.generation||'');
    }
    if(!/^\d+$/.test(generation)) throw new Error('captured_reality_storage_generation_missing');
    if(!(await runtimeConsentCurrent(ownerUid))){await file.delete({ignoreNotFound:true});throw new Error('captured_reality_consent_changed_after_publish');}

    await db.runTransaction(async tx=>{
      const [freshJob,freshReceipt]=await Promise.all([tx.get(jobRef),tx.get(receiptRef)]);
      if(freshReceipt.exists) throw new Error('captured_reality_runtime_admission_race');
      const current=freshJob.data() as Record<string,any>;
      if(!freshJob.exists||current.ownerUid!==ownerUid||current.status!=='SUCCESS'||String((current.output?.runtime||current.result?.runtime)?.sha256||'')!==runtimeSha) throw new Error('captured_reality_job_changed_before_receipt');
      tx.create(receiptRef,{
        schemaVersion:'urai-captured-reality-runtime-admission-v1',ownerUid,jobId,assetId,
        runtimeSha256:runtimeSha,runtimeByteSize:byteSize,storageBucket:bucketName,runtimeObject:objectPath,storageGeneration:generation,
        spatialAuthorityHead,reconstructionMethod:String(current.payload?.reconstructionMethod||'3dgs'),
        truthClass:'SPATIALLY_RECONSTRUCTABLE',reviewState:'technical-unreviewed',releaseState:'hard-off',
        candidateAcceptance:false,publicReleaseAuthorized:false,metricScaleVerified:false,navigationAccepted:false,
        browserCertified:false,mobileCertified:false,xrCertified:false,createdAt:FieldValue.serverTimestamp(),
      });
    });
    response.status(200).json({ok:true,replayed:false,admissionId:receiptId,assetId,runtimeSha256:runtimeSha,storageGeneration:generation});
  }catch(error){
    console.error('Captured Reality runtime publication failed',{jobId,assetId,error});
    response.status(409).json({ok:false,error:'captured-reality-runtime-publication-rejected'});
  }
});
