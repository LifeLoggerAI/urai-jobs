/**
 * R1088: nonproduction data-plane separation sequence only.
 * No key inspection, project IAM changes, signed URLs, or private customer media.
 * This module cannot certify token identity, revoke access, drain streams,
 * publish production objects, or enable the Studio worker hard-off.
 */
import {randomUUID,createHash} from 'node:crypto';
import {APPROVAL as NEGATIVE_APPROVAL,validateScope,probeDeniedCreate} from './r1040-gcs-negative-data-plane-proof.mjs';
import {APPROVAL as POSITIVE_APPROVAL,validatePositiveCanaryScope,probePositiveGenerationCanary} from './r1075-gcs-positive-generation-canary.mjs';
export const DENIED='R1088_WRITER_SEPARATION_HOLD';
const fail=()=>{throw new Error(DENIED);};
const shape=(obj,fields)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(obj))&&
  Reflect.ownKeys(obj).length===fields.length&&fields.every(k=>Object.hasOwn(obj,k));
const digest=x=>createHash('sha256').update(x).digest('hex');
const token=t=>typeof t==='string'&&t.length>=10&&t.length<=8192&&!/[\s\x00-\x1f]/.test(t);
const NONCE=/^[a-f0-9]{32}$/;
export function validateSeparationScope(raw){
  if(!shape(raw,['positive','legacy','alternate']))fail();
  let p,l,a;
  try{
    p=validatePositiveCanaryScope(raw.positive);
    l=validateScope(raw.legacy);
    a=validateScope(raw.alternate);
  }catch{fail()}
  if(p.approval!==POSITIVE_APPROVAL || l.approval!==NEGATIVE_APPROVAL ||
    a.approval!==NEGATIVE_APPROVAL || l.role!=='legacy' || a.role!=='alternate'||
    p.projectId!==l.projectId || p.projectId!==a.projectId ||
    p.bucket!==l.bucket || p.bucket!==a.bucket ||
    new Set([p.claimedBrokerPrincipal,l.claimedPrincipal,a.claimedPrincipal]).size!==3)fail();
  return Object.freeze({positive:p,legacy:l,alternate:a});
}
/**
 * Existing provider canaries are composed in ONE trust-limited sequence.
 * The caller must separately prove, using provider-side authentication audit,
 * that each supplied short-lived token belongs to the claimed principal.
 * Never claim authorization from GCS 403 alone (bucket absence also fails).
 */
export async function probeWriterSeparation({
  scope, brokerToken, legacyToken, alternateToken,
  transport=fetch, nonces=[randomUUID().replaceAll('-',''),
    randomUUID().replaceAll('-',''),randomUUID().replaceAll('-','')]
}){
  const s=validateSeparationScope(scope);
  if(!token(brokerToken)||!token(legacyToken)||!token(alternateToken) ||
     new Set([brokerToken,legacyToken,alternateToken]).size!==3 ||
     typeof transport!=='function' || !Array.isArray(nonces) || nonces.length!==3 ||
     nonces.some(n=>typeof n!=='string'||!NONCE.test(n)) ||
     new Set(nonces).size!==3)fail();
  let old,other,positive;
  try{
    // Verify both disallowed identities BEFORE the intended writer performs
    // any data-plane mutation. Every request targets zero customer bytes.
    old=await probeDeniedCreate({scope:s.legacy,token:legacyToken,nonce:nonces[0],transport});
    if(old.httpStatus!==403 || old.verdict!=='OBSERVED_HTTP_403_CAUSE_UNVERIFIED')fail();
    other=await probeDeniedCreate({scope:s.alternate,token:alternateToken,nonce:nonces[1],transport});
    if(other.httpStatus!==403||other.verdict!=='OBSERVED_HTTP_403_CAUSE_UNVERIFIED')fail();
    positive=await probePositiveGenerationCanary({scope:s.positive,token:brokerToken,
      nonce:nonces[2],transport});
    if(positive.observedCreate!==true||positive.observedPinnedReadback!==true||
       positive.observedPinnedDelete!==true||positive.observedPinned404!==true)fail();
  }catch{fail()}
  return Object.freeze({
    schema:'R1088_DISPOSABLE_WRITER_SEPARATION_V1',
    verdict:'OBSERVED_STAGING_CANARY_SEQUENCE_IDENTITY_AND_IAM_UNVERIFIED',
    scopeDigest:digest(s.positive.projectId+'\n'+s.positive.bucket),
    // Nonsecret correlation for an independent GCS IAM and identity audit.
    // These are claimed-principal digests, NOT verified provider identities.
    legacyClaimScopeDigest:old.scopeDigest,
    alternateClaimScopeDigest:other.scopeDigest,
    brokerClaimScopeDigest:positive.scopeDigest,
    brokerCanaryObjectName:positive.objectName,
    brokerCanaryObjectGeneration:positive.objectGeneration,
    providerAuditReconciliation:'REQUIRED_NOT_PERFORMED',
    legacyHttp403Observed:true,alternateHttp403Observed:true,
    intendedWriterCreateReadDeleteObserved:true,
    intendedWriterFinalGenerationAbsentObserved:true,
    providerPrincipalIdentityVerified:false,
    allOtherWritersInventoried:false,
    effectiveIamExclusivityVerified:false,
    allInFlightUploadsDrained:false,
    productionCredentialIncidentClosed:false,
    ownerAuthenticatedLifecycleCertified:false,
    privateMediaWritesEnabled:false,
    productionAuthorized:false,
    deletionAcknowledged:false,
    launchApproved:false
  });
}
