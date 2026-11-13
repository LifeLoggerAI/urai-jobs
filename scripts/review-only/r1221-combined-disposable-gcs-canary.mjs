/**
 * ONE URAI R1221 - disposable GCS dual-canary sequence, REVIEW ONLY.
 * Reuses R1088's real data-plane writer separation, then R1122's resumable
 * session cancellation. NEVER operates on customer data, grants Storage IAM,
 * or acknowledges private-memory deletion. No CLI, token emission, credential
 * discovery, or network calls until both scopes and all inputs validate.
 *
 * A 403 on its own can mean a missing bucket or mismatched identity. Provider
 * identity, effective IAM, pre-existing sessions, independent approval and
 * all stream draining must be certified separately. Keep private writes OFF.
 */
import {randomUUID} from 'node:crypto';
import {validateSeparationScope,probeWriterSeparation} from './r1088-writer-separation-canary.mjs';
import {validateSessionCanaryScope,probeSessionCancellation} from './r1122-gcs-session-cancel-canary.mjs';

export const DENIED='R1221_DISPOSABLE_COMBINED_GCS_CANARY_HOLD';
const fail=()=>{throw new Error(DENIED);};
const ownExact=(obj,names)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(obj))&&
  Reflect.ownKeys(obj).length===names.length&&
  names.every(k=>{const d=Object.getOwnPropertyDescriptor(obj,k);
    return d&&Object.hasOwn(d,'value');});
const noncesValid=xs=>Array.isArray(xs)&&xs.length===4&&
  xs.every(x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x))&&
  new Set(xs).size===4;
const token=t=>typeof t==='string'&&t.length>=10&&t.length<=8192&&
  !/[\s\x00-\x1f]/.test(t);

export function validateCombinedCanaryScope(raw) {
  try {
    if(!ownExact(raw,['writerSeparation','session']))fail();
    const w=validateSeparationScope(raw.writerSeparation);
    const s=validateSessionCanaryScope(raw.session);
    if(w.positive.projectId!==s.projectId||
       w.positive.bucket!==s.bucket||
       w.positive.claimedBrokerPrincipal!==s.claimedBrokerPrincipal)fail();
    return Object.freeze({writerSeparation:w,session:s});
  }catch {fail();}
}

export async function probeCombinedDisposableGcsCanary({
  scope,tokens,transport=fetch,
  nonces=Array.from({length:4},()=>randomUUID().replaceAll('-',''))
}) {
  // Validate every field BEFORE sending a single request. Fail closed on
  // reused credentials, extra scope fields, changed bucket or a reused nonce.
  const s=validateCombinedCanaryScope(scope);
  if(!ownExact(tokens,['broker','legacy','alternate'])||
     ![tokens.broker,tokens.legacy,tokens.alternate].every(token)||
     new Set([tokens.broker,tokens.legacy,tokens.alternate]).size!==3||
     !noncesValid(nonces)||typeof transport!=='function')fail();
  let w,session;
  try {
    w=await probeWriterSeparation({
      scope:s.writerSeparation,brokerToken:tokens.broker,
      legacyToken:tokens.legacy,alternateToken:tokens.alternate,
      transport,nonces:nonces.slice(0,3)
    });
    if(w.schema!=='R1088_DISPOSABLE_WRITER_SEPARATION_V2'||
       w.legacyHttp403Observed!==true||w.alternateHttp403Observed!==true||
       w.intendedWriterCreateReadDeleteObserved!==true||
       w.intendedWriterFinalGenerationAbsentObserved!==true||
       w.effectiveIamExclusivityVerified!==false||
       w.providerPrincipalIdentityVerified!==false||
       w.productionAuthorized!==false)fail();
    session=await probeSessionCancellation({
      scope:s.session,token:tokens.broker,transport,nonce:nonces[3]
    });
    if(session.schema!=='R1122_DISPOSABLE_RESUMABLE_CANCEL_V1'||
       session.sessionCancelledHttp499Observed!==true||
       session.sessionStatusRejectedAfterCancel!==true||
       session.syntheticByteResumeRejectedAfterCancel!==true||
       session.objectMetadata404Observed!==true||
       session.allResumableSessionsInventoried!==false||
       session.productionAuthorized!==false)fail();
  }catch {fail();} // Never reflect provider bodies, bearer tokens or session URI.
  return Object.freeze({
    schema:'R1221_COMBINED_DISPOSABLE_GCS_CANARY_V1',
    verdict:'OBSERVED_TWO_STAGING_CANARIES_NOT_PRODUCTION_CERTIFIED',
    scopeDigest:w.scopeDigest,
    writerSeparationSchema:w.schema,
    sessionCancellationSchema:session.schema,
    brokerClaimScopeDigest:w.brokerClaimScopeDigest,
    legacyClaimScopeDigest:w.legacyClaimScopeDigest,
    alternateClaimScopeDigest:w.alternateClaimScopeDigest,
    observedSyntheticLegacyWrite403:true,
    observedSyntheticAlternateWrite403:true,
    observedSyntheticLegacyRead403:true,
    observedSyntheticAlternateRead403:true,
    observedZeroByteBrokerGenerationAndPinnedDelete:true,
    observedSingleResumableSessionCancelled:true,
    observedSingleSessionResumeDenied:true,
    // False even if every data-plane request above returned expected status:
    independentIdentityAttestation:false,
    providerIamPolicyReconciled:false,
    allOtherWritersInventoried:false,
    preexistingResumableSessionsEnumerated:false,
    allResumableSessionsDrained:false,
    lateWriterRaceCertified:false,
    customerGenerationDeletionAcknowledged:false,
    authenticatedOwnerPositiveLifecycleCertified:false,
    protectedCiCertified:false,
    independentSecurityApproval:false,
    privateMemoryWritesEnabled:false,
    productionAuthorized:false,
    launchApproved:false
  });
}
