/**
 * R1716 HOLD. Pure read-side consistency check for a future Jobs-issued
 * immutable Memory -> Studio render binding. Jobs #538 currently does NOT
 * persist or issue this Memory/manifest binding. This module is deliberately
 * NOT registered as a callable, database writer, API, signer or permission.
 *
 * BOTH inputs must come from independent protected Jobs server reads.
 * A client-provided record, "issuer" string, reduced status projection, or
 * matching owner/tenant alone MUST NEVER establish provenance.
 *
 * "consistent" is not consent, generation, private media, or playback rights.
 * Final Studio/Jobs media delivery must reauthorize owner, consent and deletion.
 */
export type RenderMemoryBindingEvidence = Readonly<{
  source: 'jobs-protected-record';
  ownerUid: string;
  tenantId: string;
  jobId: string;
  memoryId: string;
  replayManifestId: string;
  manifestVersion: number;
  renderPlanDigest: string;
  decisionReceiptId: string;
  revoked: false;
}>;
export type RenderJobEvidence = Readonly<{
  sourceSystem: string;
  ownerUid: string;
  tenantId: string;
  jobId: string;
  jobType: string;
  status: string;
  outputDeletedAt?: unknown;
  consent: { purpose: string; policyVersion: string; decisionReceiptId: string };
  output: { renderPlanDigest: string };
}>;
type Result = Readonly<{status:'unavailable'} | {status:'consistent'}>;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const JOB=/^[A-Za-z0-9_-]{10,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const deny=():Result=>({status:'unavailable'});
const valid=(v:unknown,re=ID):v is string=>typeof v==='string'&&re.test(v);
function record(value:unknown):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)return false;
 return Reflect.ownKeys(value).every(k=>typeof k==='string'
   &&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)??{},'value'));
}
export function checkProtectedMemoryRenderProvenance(input:{
  verifiedOwnerUid:unknown; verifiedTenantId:unknown;
  selectedMemoryId:unknown; selectedManifestId:unknown;
  selectedManifestVersion:unknown;
  protectedBinding:unknown; currentJobsReadback:unknown;
  ownerDeletionFenced:unknown;
}):Result{
 try{
  if(!record(input)||!valid(input.verifiedOwnerUid)||!valid(input.verifiedTenantId)
    ||!valid(input.selectedMemoryId)||!valid(input.selectedManifestId)
    ||!Number.isSafeInteger(input.selectedManifestVersion)
    ||(input.selectedManifestVersion as number)<1||input.ownerDeletionFenced!==false)return deny();
  const b=input.protectedBinding,j=input.currentJobsReadback;
  if(!record(b)||!record(j)||!record(j.consent)||!record(j.output))return deny();
  if(b.source!=='jobs-protected-record'||b.revoked!==false
    ||!valid(b.jobId,JOB)||!valid(b.renderPlanDigest,HASH)||!valid(b.decisionReceiptId,HASH)
    ||b.ownerUid!==input.verifiedOwnerUid||b.tenantId!==input.verifiedTenantId
    ||b.memoryId!==input.selectedMemoryId||b.replayManifestId!==input.selectedManifestId
    ||b.manifestVersion!==input.selectedManifestVersion)return deny();
  if(j.sourceSystem!=='urai-studio'||j.ownerUid!==input.verifiedOwnerUid
    ||j.tenantId!==input.verifiedTenantId||j.jobId!==b.jobId
    ||j.jobType!=='studio.render.video'||j.status!=='SUCCESS'
    ||j.outputDeletedAt!=null||j.consent.purpose!=='life-movie.render'
    ||j.consent.policyVersion!=='1.1.0'
    ||j.consent.decisionReceiptId!==b.decisionReceiptId
    ||j.output.renderPlanDigest!==b.renderPlanDigest)return deny();
  return {status:'consistent'};
 }catch{return deny();}
}
