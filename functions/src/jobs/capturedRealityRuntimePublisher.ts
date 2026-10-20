import { createHash, timingSafeEqual } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { consentBlockRef } from '../privacy/consentBlocks.js';

if (getApps().length === 0) initializeApp();

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

type RuntimeBinding = {
  ownerUid: string; runtimeSha: string; byteSize: number; artifactRef: string;
  spatialAuthorityHead: string; acceptedCallbackHash: string; reconstructionMethod: string;
};
const authorityHash=(binding:RuntimeBinding)=>createHash('sha256').update(JSON.stringify(binding)).digest('hex');
function runtimeBinding(data: Record<string,any>, expectedSha: string): RuntimeBinding {
  if((data.jobType||data.type)!=='memory.private-source.reconstruct-place'||data.status!=='SUCCESS'
    ||String(data.derivativeAccessState||'').startsWith('REVOKED')) throw new Error('captured_reality_job_not_successful');
  const ownerUid=String(data.ownerUid||'');
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(ownerUid)) throw new Error('captured_reality_owner_invalid');
  const runtime=data.output?.runtime||data.result?.runtime;
  const runtimeSha=String(runtime?.sha256||'').toLowerCase();
  const byteSize=Number(runtime?.byteSize);
  const artifactRef=String(runtime?.ref||'');
  const spatialAuthorityHead=String(data.payload?.spatialAuthorityHead||'');
  const acceptedCallbackHash=String(data.execution?.capturedRealityAcceptedCallbackHash||'');
  if(runtimeSha!==expectedSha||!SHA256.test(runtimeSha)||!Number.isSafeInteger(byteSize)||byteSize<1
    ||byteSize>MAX_RUNTIME_BYTES||!ARTIFACT.test(artifactRef)||!SHA40.test(spatialAuthorityHead)) throw new Error('captured_reality_runtime_binding_invalid');
  if(!SHA256.test(acceptedCallbackHash)) throw new Error('captured_reality_callback_authority_missing');
  return {ownerUid,runtimeSha,byteSize,artifactRef,spatialAuthorityHead,acceptedCallbackHash,
    reconstructionMethod:String(data.payload?.reconstructionMethod||'3dgs')};
}
async function currentAuthority(transaction:any,db:ReturnType<typeof getFirestore>,jobRef:any,
  expectedSha:string,expected?:RuntimeBinding):Promise<RuntimeBinding>{
  const job=await transaction.get(jobRef);
  if(!job.exists) throw new Error('captured_reality_job_missing');
  const binding=runtimeBinding(job.data(),expectedSha);
  if(expected&&JSON.stringify(binding)!==JSON.stringify(expected)) throw new Error('captured_reality_job_changed_before_receipt');
  // These reads are part of the transaction that admits or replays the receipt.
  // Firestore must retry if revocation/deletion changes authority before commit.
  const ownerFence=db.collection('uraiPrivateLifeModelOwnerFences').doc(createHash('sha256').update(binding.ownerUid).digest('hex'));
  const [memory,location,fence]=await Promise.all([
    transaction.get(consentBlockRef(binding.ownerUid,'memory.storage')),
    transaction.get(consentBlockRef(binding.ownerUid,'location.context')),
    transaction.get(ownerFence),
  ]);
  if(memory.data()?.active===true||location.data()?.active===true) throw new Error('captured_reality_consent_blocked');
  if(fence.data()?.deleted===true) throw new Error('captured_reality_owner_deleted');
  return binding;
}
function replayGeneration(receipt:any,binding:RuntimeBinding,jobId:string,assetId:string,bucketName:string,objectPath:string){
  if(receipt.get('schemaVersion')!=='urai-captured-reality-runtime-admission-v1'||receipt.get('ownerUid')!==binding.ownerUid
    ||receipt.get('jobId')!==jobId||receipt.get('assetId')!==assetId||receipt.get('runtimeSha256')!==binding.runtimeSha
    ||receipt.get('runtimeByteSize')!==binding.byteSize||receipt.get('storageBucket')!==bucketName
    ||receipt.get('runtimeObject')!==objectPath||receipt.get('spatialAuthorityHead')!==binding.spatialAuthorityHead
    ||receipt.get('runtimeAuthorityHash')!==authorityHash(binding)
    ||receipt.get('revokedAt')||receipt.get('releaseState')==='revoked'
    ||!/^\d+$/.test(String(receipt.get('storageGeneration')||''))) throw new Error('captured_reality_runtime_admission_conflict');
  return String(receipt.get('storageGeneration'));
}
function validatePublicationIntent(intent:any,binding:RuntimeBinding,jobId:string,assetId:string,bucketName:string,objectPath:string,allowFenced=false){
  if(intent.get('schemaVersion')!=='urai-captured-reality-runtime-cleanup-v1'||intent.get('ownerUid')!==binding.ownerUid
    ||intent.get('jobId')!==jobId||intent.get('assetId')!==assetId||intent.get('storageBucket')!==bucketName
    ||intent.get('runtimeObject')!==objectPath||intent.get('runtimeAuthorityHash')!==authorityHash(binding)
    ||intent.get('runtimeSha256')!==binding.runtimeSha||intent.get('runtimeByteSize')!==binding.byteSize
    ||intent.get('spatialAuthorityHead')!==binding.spatialAuthorityHead
    ||(!allowFenced&&(intent.get('revokedAt')||intent.get('cleanupAcknowledgedAt')))) throw new Error('captured_reality_publication_intent_conflict');
}

export const publishCapturedRealityRuntime=onRequest({
  secrets:[publisherToken,engineToken],cors:false,timeoutSeconds:120,memory:'1GiB',
},async(request,response)=>{
  if(request.method!=='POST'){response.status(405).json({ok:false,error:'method-not-allowed'});return;}
  if(!authorized(String(request.headers.authorization||''))){response.status(401).json({ok:false,error:'unauthorized'});return;}
  const parsed=PublishSchema.safeParse(request.body);
  if(!parsed.success){response.status(400).json({ok:false,error:'invalid-request'});return;}
  const {jobId,assetId,expectedRuntimeSha256}=parsed.data;
  let publishedObject:{bucketName:string;objectPath:string;generation:string;binding:RuntimeBinding}|undefined;
  let publicationIntent:FirebaseFirestore.DocumentReference|undefined;
  try{
    const db=getFirestore();
    const jobRef=db.collection('jobs').doc(jobId);
    const receiptId=createHash('sha256').update(jobId+'\n'+assetId).digest('hex');
    const receiptRef=db.collection('capturedRealityRuntimeAdmissions').doc(receiptId);
    const bucketName=configuredBucket();
    const admission=await db.runTransaction(async tx=>{
      const binding=await currentAuthority(tx,db,jobRef,expectedRuntimeSha256);
      const existing=await tx.get(receiptRef);
      const path=`private-captured-reality/${binding.ownerUid}/${assetId}/runtime/${binding.runtimeSha}.splat`;
      return {binding,generation:existing.exists?replayGeneration(existing,binding,jobId,assetId,bucketName,path):undefined};
    });
    const binding=admission.binding;
    const {ownerUid,runtimeSha,byteSize,artifactRef,spatialAuthorityHead}=binding;
    const objectPath=`private-captured-reality/${ownerUid}/${assetId}/runtime/${runtimeSha}.splat`;
    if(admission.generation){
      response.status(200).json({ok:true,replayed:true,admissionId:receiptId,assetId,runtimeSha256:runtimeSha,storageGeneration:admission.generation});
      return;
    }

    const bytes=await boundedArtifact(jobId,artifactRef,runtimeSha,byteSize);
    if(!(await runtimeConsentCurrent(ownerUid))) throw new Error('captured_reality_consent_changed_before_publish');
    // Reserve a durable, private non-admission target BEFORE Storage can hold
    // bytes. A successful save followed by a metadata outage must remain owned.
    const cleanupId=createHash('sha256').update(jobId+'\n'+assetId+'\n'+authorityHash(binding)).digest('hex');
    publicationIntent=db.collection('capturedRealityRuntimeCleanup').doc(cleanupId);
    const intentRef=publicationIntent;
    await db.runTransaction(async tx=>{
      await currentAuthority(tx,db,jobRef,expectedRuntimeSha256,binding);
      const existing=await tx.get(intentRef);
      if(existing.exists){
        validatePublicationIntent(existing,binding,jobId,assetId,bucketName,objectPath);
        return;
      }
      tx.create(intentRef,{
        schemaVersion:'urai-captured-reality-runtime-cleanup-v1',ownerUid,jobId,assetId,
        runtimeSha256:runtimeSha,runtimeByteSize:byteSize,spatialAuthorityHead,runtimeAuthorityHash:authorityHash(binding),
        storageBucket:bucketName,runtimeObject:objectPath,publicationPending:true,cleanupPending:true,
        candidateAcceptance:false,publicReleaseAuthorized:false,createdAt:FieldValue.serverTimestamp(),
      });
    });
    const file=getStorage().bucket(bucketName).file(objectPath);
    let generation='';
    try{
      await file.save(bytes,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0},metadata:{
        contentType:'application/octet-stream',cacheControl:'private, no-store',
        metadata:{uraiRuntimeSha256:runtimeSha,uraiCapturedRealityJobId:jobId,uraiSpatialAuthorityHead:spatialAuthorityHead,
          uraiRuntimeAuthorityHash:authorityHash(binding)},
      }});
      const [meta]=await file.getMetadata(); generation=String(meta.generation||'');
    }catch(error:any){
      if(error?.code!==412) throw error;
      const [meta]=await file.getMetadata();
      if(String(meta.metadata?.uraiRuntimeSha256||'')!==runtimeSha||String(meta.metadata?.uraiCapturedRealityJobId||'')!==jobId
        ||String(meta.metadata?.uraiSpatialAuthorityHead||'')!==spatialAuthorityHead
        ||String(meta.metadata?.uraiRuntimeAuthorityHash||'')!==authorityHash(binding)
        ||Number(meta.size)!==byteSize) throw new Error('captured_reality_runtime_object_conflict');
      generation=String(meta.generation||'');
    }
    if(!/^\d+$/.test(generation)) throw new Error('captured_reality_storage_generation_missing');
    publishedObject={bucketName,objectPath,generation,binding};
    if(!(await runtimeConsentCurrent(ownerUid))) throw new Error('captured_reality_consent_changed_after_publish');

    const result=await db.runTransaction(async tx=>{
      await currentAuthority(tx,db,jobRef,expectedRuntimeSha256,binding);
      const [freshReceipt,freshIntent]=await Promise.all([tx.get(receiptRef),tx.get(intentRef)]);
      if(freshIntent.exists) validatePublicationIntent(freshIntent,binding,jobId,assetId,bucketName,objectPath);
      else if(!freshReceipt.exists) throw new Error('captured_reality_publication_intent_missing');
      if(freshReceipt.exists){
        const admittedGeneration=replayGeneration(freshReceipt,binding,jobId,assetId,bucketName,objectPath);
        tx.delete(intentRef);
        return {replayed:true,generation:admittedGeneration};
      }
      tx.create(receiptRef,{
        schemaVersion:'urai-captured-reality-runtime-admission-v1',ownerUid,jobId,assetId,
        runtimeSha256:runtimeSha,runtimeByteSize:byteSize,storageBucket:bucketName,runtimeObject:objectPath,storageGeneration:generation,
        spatialAuthorityHead,reconstructionMethod:binding.reconstructionMethod,runtimeAuthorityHash:authorityHash(binding),
        truthClass:'SPATIALLY_RECONSTRUCTABLE',reviewState:'technical-unreviewed',releaseState:'hard-off',
        candidateAcceptance:false,publicReleaseAuthorized:false,metricScaleVerified:false,navigationAccepted:false,
        browserCertified:false,mobileCertified:false,xrCertified:false,createdAt:FieldValue.serverTimestamp(),
      });
      tx.delete(intentRef);
      return {replayed:false,generation};
    });
    publishedObject=undefined;
    response.status(200).json({ok:true,replayed:result.replayed,admissionId:receiptId,assetId,runtimeSha256:runtimeSha,storageGeneration:result.generation});
  }catch(error){
    if(publishedObject){
      try{
        // Do not delete a newer replacement generation while compensating for a
        // rejected admission. A simultaneous identical winner is replayed above.
        await getStorage().bucket(publishedObject.bucketName).file(publishedObject.objectPath)
          .delete({ignoreNotFound:true,ifGenerationMatch:publishedObject.generation});
        if(publicationIntent){
          const target=publishedObject,intentRef=publicationIntent;
          await getFirestore().runTransaction(async tx=>{
            const intent=await tx.get(intentRef);
            if(!intent.exists) throw new Error('captured_reality_publication_intent_missing');
            validatePublicationIntent(intent,target.binding,jobId,assetId,target.bucketName,target.objectPath,true);
            tx.set(intentRef,{storageGeneration:target.generation,publicationPending:false,cleanupPending:false,
              cleanupAcknowledgedAt:FieldValue.serverTimestamp()}, {merge:true});
          });
        }
      }catch{
        // Persist exact cleanup identity separately from admissions. A rejected
        // publication must never be represented as a usable runtime receipt,
        // and a Storage outage must leave a durable owner-scoped retry target.
        try{
          if(!publicationIntent) throw new Error('captured_reality_publication_intent_missing');
          const target=publishedObject,intentRef=publicationIntent;
          await getFirestore().runTransaction(async tx=>{
          const intent=await tx.get(intentRef);
          if(intent.exists) validatePublicationIntent(intent,target.binding,jobId,assetId,target.bucketName,target.objectPath,true);
          tx.set(intentRef,{
            schemaVersion:'urai-captured-reality-runtime-cleanup-v1',ownerUid:publishedObject.binding.ownerUid,
            jobId,assetId,runtimeSha256:publishedObject.binding.runtimeSha,
            storageBucket:publishedObject.bucketName,runtimeObject:publishedObject.objectPath,
            storageGeneration:publishedObject.generation,publicationPending:false,cleanupPending:true,
            candidateAcceptance:false,publicReleaseAuthorized:false,createdAt:FieldValue.serverTimestamp(),
          },{merge:true});
          });
        }catch{
          console.error('Captured Reality rejected-runtime cleanup persistence failed',{jobId,assetId,code:'CR_RUNTIME_CLEANUP_PERSISTENCE_FAILED'});
        }
        console.error('Captured Reality rejected-runtime cleanup pending',{jobId,assetId,code:'CR_RUNTIME_CLEANUP_PENDING'});
      }
    }
    console.error('Captured Reality runtime publication failed',{jobId,assetId,code:'CR_RUNTIME_PUBLICATION_REJECTED'});
    response.status(409).json({ok:false,error:'captured-reality-runtime-publication-rejected'});
  }
});
