/**
 * ONE URAI R1122: review-only, disposable GCS resumable-session cancellation.
 * A resumable session URI is itself a bearer credential: do not log it, pass
 * it to clients, store it in public receipts, or infer that IAM revocation
 * invalidates it. This probe is a zero-customer-data canary, not an upload
 * broker or physical all-stream drain proof. The production write interlock
 * remains hard OFF; this module NEVER acknowledges memory deletion.
 *
 * Cloud Storage JSON API: initiate -> DELETE session (499) -> query (410/404)
 * -> attempt to resume with one synthetic byte (410/404) -> object GET 404.
 */
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const APPROVAL='reviewed-disposable-staging-session-cancel-v1';
export const DENIED='R1122_GCS_SESSION_CANCEL_HOLD';
const PROJECT=/^urai-security-canary-[a-z0-9]{4,24}$/;
const PRINCIPAL=/^[a-z][a-z0-9-]{2,45}@[a-z][a-z0-9-]{4,49}\.iam\.gserviceaccount\.com$/;
const NONCE=/^[a-f0-9]{32}$/;
const UPLOAD_ID=/^[A-Za-z0-9_-]{10,512}$/;
const reject=()=>{throw new Error(DENIED);};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(v))&&
  Reflect.ownKeys(v).length===keys.length&&
  keys.every(k=>Object.hasOwn(v,k)&&typeof v[k]==='string');
export function validateSessionCanaryScope(v){
  if(!exact(v,['approval','projectId','bucket','claimedBrokerPrincipal'])||
    v.approval!==APPROVAL||!PROJECT.test(v.projectId)||
    v.bucket!==v.projectId+'-private'||!PRINCIPAL.test(v.claimedBrokerPrincipal)||
    !v.claimedBrokerPrincipal.endsWith('@'+v.projectId+'.iam.gserviceaccount.com'))reject();
  return Object.freeze({...v});
}
export function makeSessionCanaryTargets(scope,nonce){
  const s=validateSessionCanaryScope(scope);
  if(typeof nonce!=='string'||!NONCE.test(nonce))reject();
  const objectName='security-broker-session-drain/'+nonce+'/cancel-probe.bin';
  const start=new URL('https://storage.googleapis.com/upload/storage/v1/b/'+s.bucket+'/o');
  start.searchParams.set('uploadType','resumable');
  start.searchParams.set('name',objectName);
  start.searchParams.set('ifGenerationMatch','0');
  const metadata=new URL('https://storage.googleapis.com/storage/v1/b/'+s.bucket+'/o/'+encodeURIComponent(objectName));
  return Object.freeze({objectName,startUrl:start.toString(),metadataUrl:metadata.toString()});
}
// Session URI is an AUTHENTICATION TOKEN. Never return it or include it in
// error strings, logs or audit snapshots. Strictly validate before use.
function parseSessionLocation(raw,scope,objectName){
  if(typeof raw!=='string'||raw.length<40||raw.length>4096)reject();
  let u;try{u=new URL(raw);}catch{reject();}
  if(u.protocol!=='https:'||u.hostname!=='storage.googleapis.com'||
     u.port||u.username||u.password||u.hash||
     u.pathname!=='/upload/storage/v1/b/'+scope.bucket+'/o')reject();
  const keys=[...u.searchParams.keys()];
  if(keys.length<3||keys.length>4||new Set(keys).size!==keys.length||
     keys.some(k=>!['uploadType','name','ifGenerationMatch','upload_id'].includes(k))||
     u.searchParams.get('uploadType')!=='resumable'||
     u.searchParams.get('name')!==objectName||
     !UPLOAD_ID.test(u.searchParams.get('upload_id')||'')||
     (u.searchParams.has('ifGenerationMatch')&&u.searchParams.get('ifGenerationMatch')!=='0'))reject();
  return u.toString();
}
const tokenValid=t=>typeof t==='string'&&t.length>=10&&t.length<=8192&&!/[\s\x00-\x1f]/.test(t);
const noBody=(method)=>({method,redirect:'error',signal:AbortSignal.timeout(15000),
  headers:{'Content-Length':'0'}});
async function request(transport,url,options){
  try{const r=await transport(url,options);if(!r||!Number.isInteger(r.status))reject();return r;}
  catch{reject();}
}
export async function probeSessionCancellation({
  scope,token,transport=fetch,nonce=randomUUID().replaceAll('-','')
}){
  const s=validateSessionCanaryScope(scope);
  if(!tokenValid(token)||typeof transport!=='function')reject();
  const target=makeSessionCanaryTargets(s,nonce);
  let uri=null,cancelled=false;
  try{
    const initiated=await request(transport,target.startUrl,{
      ...noBody('POST'),
      headers:{'Authorization':'Bearer '+token,'Content-Length':'0',
        'X-Upload-Content-Type':'application/octet-stream'}
    });
    if(initiated.status!==200||typeof initiated.headers?.get!=='function')reject();
    uri=parseSessionLocation(initiated.headers.get('location'),s,target.objectName);
    // No customer data uploaded. Do not send Authorization when using the
    // session URI; the URI itself is a bearer credential.
    const cancelledResponse=await request(transport,uri,noBody('DELETE'));
    if(cancelledResponse.status!==499)reject();
    cancelled=true;
    const status=await request(transport,uri,{
      ...noBody('PUT'),headers:{'Content-Length':'0','Content-Range':'bytes */*'}
    });
    if(![404,410].includes(status.status))reject();
    const resumed=await request(transport,uri,{
      method:'PUT',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{'Content-Length':'1','Content-Range':'bytes 0-0/1'},
      body:new Uint8Array([0])
    });
    if(![404,410].includes(resumed.status))reject();
    const absent=await request(transport,target.metadataUrl,{
      ...noBody('GET'),headers:{'Authorization':'Bearer '+token}
    });
    if(absent.status!==404)reject();
    return Object.freeze({
      schema:'R1122_DISPOSABLE_RESUMABLE_CANCEL_V1',
      verdict:'OBSERVED_SINGLE_SYNTHETIC_SESSION_CANCEL_NOT_FULL_DRAIN',
      objectName:target.objectName,
      scopeDigest:createHash('sha256').update(s.projectId+'\n'+s.bucket+'\n'+s.claimedBrokerPrincipal).digest('hex'),
      sessionCancelledHttp499Observed:true,
      sessionStatusRejectedAfterCancel:true,
      syntheticByteResumeRejectedAfterCancel:true,
      objectMetadata404Observed:true,
      // No session URI, credentials, actual principal or token is emitted.
      providerPrincipalIdentityVerified:false,
      allResumableSessionsInventoried:false,
      inFlightUploadRaceCertified:false,
      effectiveIamExclusivityVerified:false,
      signedUrlAndCacheRevocationVerified:false,
      privateMediaWritesEnabled:false,
      customerDataDeletionAcknowledged:false,
      productionAuthorized:false,
      launchApproved:false
    });
  }catch{
    // If the session was initiated but the canary failed midstream, make a
    // best-effort cleanup attempt without ever logging or returning its URL.
    // Cleanup is NOT verified; a reviewer must reconcile outstanding sessions.
    if(uri&&!cancelled){try{await transport(uri,noBody('DELETE'));}catch{}}
    reject();
  }
}
export function scopeFromEnvironment(env){
  return validateSessionCanaryScope({
    approval:env.URAI_GCS_SESSION_APPROVAL,
    projectId:env.URAI_GCS_SESSION_PROJECT,
    bucket:env.URAI_GCS_SESSION_BUCKET,
    claimedBrokerPrincipal:env.URAI_GCS_SESSION_BROKER_PRINCIPAL
  });
}
async function main(){
  if(process.argv.length!==3||process.argv[2]!=='--protected-disposable-session-cancel-only')reject();
  const scope=scopeFromEnvironment(process.env);
  for(const name of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
    if(process.env[name])reject();
  for(const name of ['GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT','CLOUDSDK_CORE_PROJECT','FIREBASE_PROJECT_ID'])
    if(process.env[name]&&process.env[name]!==scope.projectId)reject();
  const chunks=[];let length=0;
  for await(const b of process.stdin){length+=b.length;if(length>8192)reject();chunks.push(b);}
  const token=Buffer.concat(chunks).toString('utf8').trim();
  const result=await probeSessionCancellation({scope,token});
  process.stdout.write(JSON.stringify(result)+'\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(()=>{process.stderr.write(DENIED+'\n');process.exitCode=1;});
}
