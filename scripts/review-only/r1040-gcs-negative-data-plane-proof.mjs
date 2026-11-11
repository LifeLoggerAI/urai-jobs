/**
 * R1040: staging-only actual GCS negative data-plane probe.
 * This does not certify IAM, token identity, in-flight drain, deletion or GO.
 * The original Studio private-output write hard-off is NOT modified.
 */
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const DENIED='R1040_GCS_NEGATIVE_PROBE_BLOCKED';
export const APPROVAL='reviewed-disposable-staging-negative-v1';
const projectRule=/^urai-security-canary-[a-z0-9]{4,24}$/;
const emailRule=/^[a-z][a-z0-9-]{2,45}@[a-z][a-z0-9-]{4,49}\.iam\.gserviceaccount\.com$/;
function refuse(reason){throw new Error(DENIED+':'+reason);}
export function validateScope(config){
  const fields=['approval','projectId','bucket','claimedPrincipal','role'];
  if(!config||typeof config!=='object'||Array.isArray(config)||
     Reflect.ownKeys(config).length!==fields.length||
     fields.some(k=>!Object.hasOwn(config,k)||typeof config[k]!=='string'))refuse('SCOPE_FIELDS');
  if(config.approval!==APPROVAL)refuse('REVIEW_APPROVAL_REQUIRED');
  if(!projectRule.test(config.projectId))refuse('NON_DISPOSABLE_PROJECT');
  if(config.bucket!==config.projectId+'-private')refuse('NON_DISPOSABLE_BUCKET');
  if(!emailRule.test(config.claimedPrincipal))refuse('PRINCIPAL_INVALID');
  if(!['legacy','alternate'].includes(config.role))refuse('ROLE_INVALID');
  return Object.freeze({...config});
}
export function makeCanaryTarget(scope,nonce){
  const approved=validateScope(scope);
  if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce))refuse('NONCE_INVALID');
  const name='security-denial/'+nonce+'/deny-probe.bin';
  const url=new URL('https://storage.googleapis.com/upload/storage/v1/b/'+approved.bucket+'/o');
  url.searchParams.set('uploadType','media');url.searchParams.set('name',name);
  url.searchParams.set('ifGenerationMatch','0');
  return Object.freeze({url:url.toString(),objectName:name});
}
export async function probeDeniedCreate({scope,token,transport=fetch,nonce=randomUUID().replaceAll('-','')}){
  const approved=validateScope(scope);
  if(typeof token!=='string'||token.length<10||token.length>8192||/[\s\x00-\x1f]/.test(token))refuse('TOKEN_UNAVAILABLE');
  if(typeof transport!=='function')refuse('TRANSPORT_INVALID');
  const target=makeCanaryTarget(approved,nonce);
  let response;
  try {
    response=await transport(target.url,{method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},
      body:new Uint8Array(0),redirect:'error',signal:AbortSignal.timeout(15000)});
  } catch {refuse('DATA_PLANE_REQUEST_UNAVAILABLE');}
  if(!response||!Number.isInteger(response.status))refuse('INVALID_RESPONSE');
  if(response.status===200||response.status===201)
    refuse('DIRECT_WRITER_STILL_AUTHORIZED_CANARY_RECONCILIATION_REQUIRED');
  if(response.status!==403)refuse('DENIAL_INCONCLUSIVE_HTTP_'+response.status);
  return Object.freeze({schema:'R1040_GCS_DISPOSABLE_NEGATIVE_V1',
    verdict:'OBSERVED_HTTP_403_CAUSE_UNVERIFIED',httpStatus:403,
    scopeDigest:createHash('sha256').update(approved.projectId+'\n'+approved.bucket+'\n'+approved.claimedPrincipal+'\n'+approved.role).digest('hex'),
    attemptedCredentialIdentityIndependentlyVerified:false,
    effectiveIamIndependentlyVerified:false,
    bucketExistenceIndependentlyVerified:false,
    brokerSoleWriterVerified:false,
    activeStreamsDrained:false,
    deletionAcknowledged:false,
    productionAuthorized:false,
    launchApproved:false});
}
export function scopeFromEnvironment(env){
  return validateScope({approval:env.URAI_GCS_NEGATIVE_APPROVAL,
    projectId:env.URAI_GCS_NEGATIVE_PROJECT,bucket:env.URAI_GCS_NEGATIVE_BUCKET,
    claimedPrincipal:env.URAI_GCS_NEGATIVE_CLAIMED_PRINCIPAL,
    role:env.URAI_GCS_NEGATIVE_WRITER_ROLE});
}
async function main(){
  if(process.argv.length!==3||process.argv[2]!=='--protected-staging-negative-only')refuse('LIVE_EXPLICIT_FLAG_REQUIRED');
  const scope=scopeFromEnvironment(process.env);
  for(const k of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
    if(process.env[k])refuse('EMULATOR_NOT_PROVIDER_PROOF');
  for(const k of ['GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT','CLOUDSDK_CORE_PROJECT','FIREBASE_PROJECT_ID'])
    if(process.env[k]&&process.env[k]!==scope.projectId)refuse('PROJECT_ENV_CONFLICT');
  const chunks=[];let bytes=0;
  for await(const part of process.stdin){bytes+=part.length;if(bytes>8192)refuse('TOKEN_TOO_LONG');chunks.push(part);}
  const token=Buffer.concat(chunks).toString('utf8').trim();
  const result=await probeDeniedCreate({scope,token});
  process.stdout.write(JSON.stringify(result)+'\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{
    process.stderr.write(String(error?.message||DENIED).replace(/Bearer\s+\S+/g,'Bearer [REDACTED]')+'\n');
    process.exitCode=1;
  });
}
