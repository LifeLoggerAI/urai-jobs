/**
 * R1719: DISPOSABLE EMULATOR ONLY, never register in routes, workers,
 * or real render flows. This is NOT a production provenance issuer.
 * External Studio/Spatial/Privacy attestations remain unauthenticated.
 */
import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {getApps} from 'firebase-admin/app';
import {checkProtectedMemoryRenderProvenance} from './studioMemoryProvenanceRead.js';
import {protectedBindingDocumentId} from './studioMemoryProvenanceFirestoreRead.js';
const JOB=/^[A-Za-z0-9_-]{10,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const BINDINGS='studioMemoryRenderProvenanceReviewBindings';
const CLAIMS='studioMemoryRenderProvenanceReviewJobClaims';
const deny=()=>({status:'unavailable'} as const);
type Result={status:'unavailable'}|{status:'created'};
type Selection=Readonly<{
 verifiedOwnerUid:string;verifiedTenantId:string;
 selectedMemoryId:string;selectedManifestId:string;selectedManifestVersion:number;
 jobId:string;renderPlanDigest:string;decisionReceiptId:string;policyVersion:string;
 syntheticSpatialChecked:true;syntheticStudioChecked:true;syntheticPrivacyChecked:true;
}>;
function emulatorOnly(){
 return process.env.GCLOUD_PROJECT==='demo-urai-r1719'
  &&process.env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:28771'
  &&process.env.URAI_PRIVATE_MEMORY_WRITES_ENABLED==='false'
  &&process.env.GOOGLE_APPLICATION_CREDENTIALS===undefined;
}
export async function createSyntheticProvenanceBindingInDemoOnly(db:Firestore,input:Selection):Promise<Result>{
 if(!emulatorOnly()||!db||!input||!getApps().some(a=>a.options.projectId==='demo-urai-r1719'))return deny();
 const selected={
  verifiedOwnerUid:input.verifiedOwnerUid,verifiedTenantId:input.verifiedTenantId,
  selectedMemoryId:input.selectedMemoryId,selectedManifestId:input.selectedManifestId,
  selectedManifestVersion:input.selectedManifestVersion
 };
 const key=protectedBindingDocumentId(selected);
 if(!key||!JOB.test(String(input.jobId))||!HASH.test(String(input.renderPlanDigest))
  ||typeof input.policyVersion!=='string'||!input.policyVersion.trim()
  ||typeof input.decisionReceiptId!=='string'||!input.decisionReceiptId.trim()
  ||input.policyVersion.length>80||input.decisionReceiptId.length>160
  ||input.syntheticSpatialChecked!==true||input.syntheticStudioChecked!==true
  ||input.syntheticPrivacyChecked!==true)return deny();
 try{
  const uid=input.verifiedOwnerUid;
  const bRef=db.collection(BINDINGS).doc(key);
  const claimRef=db.collection(CLAIMS).doc(input.jobId);
  const jRef=db.collection('jobs').doc(input.jobId);
  // This separate record is synthetic test evidence only, NOT Spatial authority.
  const memoryKey=createHash('sha256').update(uid+'\n'+input.selectedMemoryId).digest('hex');
  const mRef=db.collection('studioMemoryRenderProvenanceReviewMemories').doc(memoryKey);
  const fRef=db.collection('accountDeletionFences').doc(uid);
  const tRef=db.collection('privacyDeletionTombstones').doc(uid);
  const cRef=db.collection('jobConsentBlocks').doc(
   createHash('sha256').update(uid+'\nlife-movie.render').digest('hex')
  );
  const binding={
   source:'jobs-protected-record',ownerUid:uid,tenantId:input.verifiedTenantId,
   jobId:input.jobId,memoryId:input.selectedMemoryId,
   replayManifestId:input.selectedManifestId,manifestVersion:input.selectedManifestVersion,
   renderPlanDigest:input.renderPlanDigest,decisionReceiptId:input.decisionReceiptId,
   policyVersion:input.policyVersion,revoked:false
  };
  return await db.runTransaction(async tx=>{
   const [old,claim,job,memory,fence,tomb,block]=await Promise.all([
    tx.get(bRef),tx.get(claimRef),tx.get(jRef),tx.get(mRef),tx.get(fRef),tx.get(tRef),tx.get(cRef)
   ]);
   const m=memory.data();
   if(old.exists||claim.exists||!job.exists||!memory.exists
    ||!m||m.ownerUid!==uid||m.memoryId!==input.selectedMemoryId
    ||m.replayManifestId!==input.selectedManifestId
    ||m.manifestVersion!==input.selectedManifestVersion
    ||m.demo!==false||m.deleted!==false
    ||fence.exists||tomb.exists
    ||(block.exists&&block.data()?.active!==false))return deny();
   if(checkProtectedMemoryRenderProvenance({
    ...selected,protectedBinding:binding,currentJobsReadback:job.data(),
    ownerDeletionFenced:false
   }).status!=='consistent')return deny();
   tx.create(bRef,binding);
   tx.create(claimRef,{ownerUid:uid,tenantId:input.verifiedTenantId,
    memoryId:input.selectedMemoryId,replayManifestId:input.selectedManifestId,
    manifestVersion:input.selectedManifestVersion,bindingKey:key});
   return {status:'created'};
  });
 }catch{return deny();}
}
