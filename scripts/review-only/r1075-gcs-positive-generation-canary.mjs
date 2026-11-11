/**
 * R1075: narrowly scoped, intentionally NONPRODUCTION GCS positive canary.
 * This is a diagnostic used alongside R1040 old-principal denial. It never
 * grants IAM, proves inherited permissions are absent, drains other writers,
 * authorizes private-media writes, or acknowledges customer deletion.
 *
 * Only an explicitly approved urai-security-canary-* project and its exactly
 * named -private bucket are usable. Creates an EMPTY canary with a generation
 * zero precondition, reads that exact generation, deletes exactly that
 * generation with a precondition, and observes a generation-specific 404.
 * Any failure is HOLD and may require manual canary reconciliation.
 * Never pass account-wide long-lived credentials. Use a reviewed short-lived
 * workload token supplied over stdin; no token, response body or raw provider
 * exception is printed. No production bucket names or customer media.
 */
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const APPROVAL='reviewed-disposable-staging-positive-v1';
export const DENIED='R1075_GCS_POSITIVE_CANARY_HOLD';
const PROJECT=/^urai-security-canary-[a-z0-9]{4,24}$/;
const PRINCIPAL=/^[a-z][a-z0-9-]{2,45}@[a-z][a-z0-9-]{4,49}\.iam\.gserviceaccount\.com$/;
const GENERATION=/^[1-9][0-9]{0,19}$/;
const NONCE=/^[a-f0-9]{32}$/;
const reject=code=>{throw new Error(DENIED+':'+code);};
const strict=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(x))&&
  Reflect.ownKeys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k)&&typeof x[k]==='string');
export function validatePositiveCanaryScope(scope){
  if(!strict(scope,['approval','projectId','bucket','claimedBrokerPrincipal'])||
    scope.approval!==APPROVAL || !PROJECT.test(scope.projectId)||
    scope.bucket!==scope.projectId+'-private'||!PRINCIPAL.test(scope.claimedBrokerPrincipal)||
    !scope.claimedBrokerPrincipal.endsWith('@'+scope.projectId+'.iam.gserviceaccount.com'))reject('SCOPE_INVALID');
  return Object.freeze({...scope});
}
export function positiveCanaryTargets(scope,nonce){
  const s=validatePositiveCanaryScope(scope);
  if(typeof nonce!=='string'||!NONCE.test(nonce))reject('NONCE_INVALID');
  const objectName='security-broker-positive/'+nonce+'/generation-proof.bin';
  const base='https://storage.googleapis.com/storage/v1/b/'+s.bucket+'/o/'+encodeURIComponent(objectName);
  const media=new URL('https://storage.googleapis.com/upload/storage/v1/b/'+s.bucket+'/o');
  media.searchParams.set('uploadType','media');
  media.searchParams.set('name',objectName);
  media.searchParams.set('ifGenerationMatch','0');
  return Object.freeze({objectName,mediaUrl:media.toString(),metadataUrl:base});
}
async function bodyJSON(resp){
  // Bounded, non-logging parse; never interpolate untrusted GCS response.
  if(!resp||typeof resp.text!=='function')reject('INVALID_RESPONSE');
  let txt;
  try{txt=await resp.text();}catch{reject('UNREADABLE_RESPONSE');}
  if(typeof txt!=='string'||txt.length>8192||txt.length===0)reject('INVALID_JSON_RESPONSE');
  let json;
  try{json=JSON.parse(txt);}catch{reject('INVALID_JSON_RESPONSE');}
  if(!json||typeof json!=='object'||Array.isArray(json))reject('INVALID_JSON_RESPONSE');
  return json;
}
function checkMetadata(data,scope,objectName,expectedGeneration=null){
  if(data.bucket!==scope.bucket || data.name!==objectName ||
     typeof data.generation!=='string'||!GENERATION.test(data.generation)||
     data.size!=='0'||
     (expectedGeneration!==null&&data.generation!==expectedGeneration))reject('GENERATION_OR_OBJECT_MISMATCH');
  return data.generation;
}
/** Transport injectability is for synthetic native tests, not cloud authority. */
export async function probePositiveGenerationCanary({scope,token,transport=fetch,nonce=randomUUID().replaceAll('-','')}){
  const s=validatePositiveCanaryScope(scope);
  if(typeof token!=='string'||token.length<10||token.length>8192||/[\s\x00-\x1f]/.test(token))reject('SHORT_LIVED_TOKEN_UNAVAILABLE');
  if(typeof transport!=='function')reject('TRANSPORT_UNAVAILABLE');
  const target=positiveCanaryTargets(s,nonce);
  const headers={Authorization:'Bearer '+token};
  const request=async (url,method,body)=>{
    try{return await transport(url,{method,headers:{...headers,...(method==='POST'?{'Content-Type':'application/octet-stream'}:{})},
      ...(body!==undefined?{body}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});}
    catch{reject('PROVIDER_TRANSPORT_UNAVAILABLE_OR_CANARY_RECONCILIATION_REQUIRED');}
  };
  // Zero-length body avoids placing user/customer data on any live provider.
  const created=await request(target.mediaUrl,'POST',new Uint8Array(0));
  if(!created||![200,201].includes(created.status))reject('CREATE_NOT_CONFIRMED_CANARY_RECONCILIATION_REQUIRED');
  const uploaded=await bodyJSON(created);
  const generation=checkMetadata(uploaded,s,target.objectName);
  const objectUrl=new URL(target.metadataUrl);
  objectUrl.searchParams.set('generation',generation);
  const read=await request(objectUrl.toString(),'GET');
  if(!read||read.status!==200)reject('READBACK_NOT_CONFIRMED_CANARY_RECONCILIATION_REQUIRED');
  checkMetadata(await bodyJSON(read),s,target.objectName,generation);
  const deleteUrl=new URL(objectUrl.toString());
  deleteUrl.searchParams.set('ifGenerationMatch',generation);
  const removed=await request(deleteUrl.toString(),'DELETE');
  // 404 or 412 is NOT deletion confirmation; an old stream may remain live.
  if(!removed||removed.status!==204)reject('PINNED_DELETE_NOT_CONFIRMED_CANARY_RECONCILIATION_REQUIRED');
  const absent=await request(objectUrl.toString(),'GET');
  if(!absent||absent.status!==404)reject('GENERATION_STILL_PRESENT_OR_UNKNOWN_RECONCILIATION_REQUIRED');
  return Object.freeze({schema:'R1075_DISPOSABLE_POSITIVE_GENERATION_V1',
    verdict:'OBSERVED_CANARY_LIFECYCLE_NOT_RELEASE_PROOF',
    objectName:target.objectName,objectGeneration:generation,
    scopeDigest:createHash('sha256').update(s.projectId+'\n'+s.bucket+'\n'+s.claimedBrokerPrincipal).digest('hex'),
    observedCreate:true,observedPinnedReadback:true,observedPinnedDelete:true,
    observedPinned404:true,attemptedIdentityIndependentlyVerified:false,
    effectiveIamIndependentlyVerified:false,oldOrAlternateWritersDenied:false,
    otherWritersDrained:false,customerDataDeletionAcknowledged:false,
    productionAuthorized:false,launchApproved:false});
}
export function positiveCanaryScopeFromEnvironment(env){
  return validatePositiveCanaryScope({approval:env.URAI_GCS_POSITIVE_APPROVAL,
    projectId:env.URAI_GCS_POSITIVE_PROJECT,bucket:env.URAI_GCS_POSITIVE_BUCKET,
    claimedBrokerPrincipal:env.URAI_GCS_POSITIVE_BROKER_PRINCIPAL});
}
async function main(){
  if(process.argv.length!==3||process.argv[2]!=='--protected-disposable-positive-only')reject('EXPLICIT_FLAG_REQUIRED');
  const scope=positiveCanaryScopeFromEnvironment(process.env);
  for(const k of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
    if(process.env[k])reject('EMULATOR_NOT_GCS_PROOF');
  for(const k of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','CLOUDSDK_CORE_PROJECT'])
    if(process.env[k]&&process.env[k]!==scope.projectId)reject('PROJECT_ENV_CONFLICT');
  let n=0;const chunks=[];
  for await(const chunk of process.stdin){n+=chunk.length;if(n>8192)reject('TOKEN_TOO_LONG');chunks.push(chunk);}
  const token=Buffer.concat(chunks).toString('utf8').trim();
  const result=await probePositiveGenerationCanary({scope,token});
  process.stdout.write(JSON.stringify(result)+'\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(e=>{const msg=String(e?.message||'');
    process.stderr.write((msg.startsWith(DENIED)?msg:DENIED+':UNKNOWN')+'\n');process.exitCode=1;});
}
