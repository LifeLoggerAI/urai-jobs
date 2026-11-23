/**
 * R1718 REVIEW ONLY: an internal read-side proof-of-consistency path, NOT a
 * provenance issuer, signer, callable, route, consent decision or private media
 * capability. The collection below does not have an authorized production
 * writer. Absence means unavailable. Callers must independently authenticate
 * owner and tenant; passing a UID/tenant string is NEVER authentication.
 *
 * Consent blocks are denial fences, NOT affirmative render consent. Even a
 * 'consistent' result does not grant life-movie.render or access to any media.
 */
import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { checkProtectedMemoryRenderProvenance } from './studioMemoryProvenanceRead.js';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_VERSION=Number.MAX_SAFE_INTEGER;
const REVIEW_BINDINGS='studioMemoryRenderProvenanceReviewBindings';
const valid=(v:unknown):v is string=>typeof v==='string'&&ID.test(v);
const deny=()=>({status:'unavailable'} as const);
type Selection=Readonly<{
  verifiedOwnerUid:unknown;
  verifiedTenantId:unknown;
  selectedMemoryId:unknown;
  selectedManifestId:unknown;
  selectedManifestVersion:unknown;
}>;
type Result=Readonly<{status:'unavailable'}|{status:'consistent'}>;

/** Deterministic lookup to avoid enumerating other owners' Jobs or bindings. */
export function protectedBindingDocumentId(input:Selection):string|null{
 try{
  if(!valid(input?.verifiedOwnerUid)||!valid(input.verifiedTenantId)
    ||!valid(input.selectedMemoryId)||!valid(input.selectedManifestId)
    ||!Number.isSafeInteger(input.selectedManifestVersion)
    ||(input.selectedManifestVersion as number)<1
    ||(input.selectedManifestVersion as number)>MAX_VERSION)return null;
  return createHash('sha256').update([
    input.verifiedOwnerUid,input.verifiedTenantId,input.selectedMemoryId,
    input.selectedManifestId,String(input.selectedManifestVersion)
  ].join('\n')).digest('hex');
 }catch{return null;}
}
function consentBlockId(uid:string,purpose:string):string{
  return createHash('sha256').update(uid+'\n'+purpose).digest('hex');
}
const JOB=/^[A-Za-z0-9_-]{10,64}$/;
type Snap={exists:boolean; data():Record<string,unknown>|undefined};
function consistent(a:Snap,b:Snap,input:Selection):boolean{
  if(!a.exists||!b.exists)return false;
  return checkProtectedMemoryRenderProvenance({
    ...input,
    protectedBinding:a.data(),
    currentJobsReadback:b.data(),
    ownerDeletionFenced:false
  }).status==='consistent';
}
/**
 * Two complete protected read rounds; the second must match the first exact
 * binding and Jobs document. No result is exposed through an HTTP endpoint.
 */
export async function readCurrentProtectedMemoryRenderConsistency(
  db:Firestore,input:Selection
):Promise<Result>{
  const key=protectedBindingDocumentId(input);
  if(!key||!db)return deny();
  const uid=input.verifiedOwnerUid as string;
  try{
    const bindingRef=db.collection(REVIEW_BINDINGS).doc(key);
    const fenceRef=db.collection('accountDeletionFences').doc(uid);
    const tombRef=db.collection('privacyDeletionTombstones').doc(uid);
    const blockRef=db.collection('jobConsentBlocks').doc(consentBlockId(uid,'life-movie.render'));
    const initial=await Promise.all([bindingRef.get(),fenceRef.get(),tombRef.get(),blockRef.get()]);
    const [binding1,fence1,tomb1,block1]=initial;
    if(!binding1.exists||fence1.exists||tomb1.exists
      ||(block1.exists&&block1.data()?.active!==false))return deny();
    const jobId=binding1.data()?.jobId;
    if(typeof jobId!=='string'||!JOB.test(jobId))return deny();
    const jobRef=db.collection('jobs').doc(jobId);
    const job1=await jobRef.get();
    if(!consistent(binding1,job1,input))return deny();

    const [binding2,fence2,tomb2,block2,job2]=await Promise.all([
      bindingRef.get(),fenceRef.get(),tombRef.get(),blockRef.get(),jobRef.get()
    ]);
    if(!binding2.exists||fence2.exists||tomb2.exists
      ||(block2.exists&&block2.data()?.active!==false))return deny();
    if(!consistent(binding2,job2,input)
      ||binding2.data()?.jobId!==jobId
      ||JSON.stringify(binding1.data())!==JSON.stringify(binding2.data())
      ||JSON.stringify(job1.data())!==JSON.stringify(job2.data()))return deny();
    return {status:'consistent'};
  }catch{
    return deny();
  }
}
