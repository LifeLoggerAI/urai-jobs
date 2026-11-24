/**
 * R1735: REVIEW-ONLY upload-session retirement contract.
 * No HTTP, no bucket access, no production import, no real auth provider.
 * A GCS resumable session URI is a bearer credential. Never persist/log it.
 * Responses from an injected verifier are trusted in tests ONLY; production
 * verification and GCS IAM/session cancellation remain unimplemented.
 */
import {createHash, timingSafeEqual} from 'node:crypto';
const deny = code => {throw new Error(code)};
const need = (x,code) => {if(!x)deny(code)};
const valid = x => typeof x === 'string' && /^[a-zA-Z0-9:_-]{4,160}$/.test(x);
const number = x => Number.isSafeInteger(x) && x > 0;
const digest = x => createHash('sha256').update(x).digest('hex');
const same = (a,b) => {
 if(typeof a !== 'string' || typeof b !== 'string')return false;
 const x=Buffer.from(a), y=Buffer.from(b);
 return x.length===y.length && timingSafeEqual(x,y);
};
const state = {created:'created',cancellationRequested:'cancellation-requested',
 cancelled:'cancelled',unknown:'unknown',done:'closed'};
export function createReviewSession({ownerUid,tenantId,epoch,uploadId,sessionUri}) {
 need(valid(ownerUid)&&valid(tenantId)&&valid(uploadId)&&number(epoch),'invalid_review_scope');
 need(typeof sessionUri==='string','session_uri_required');
 let parsed;
 try {parsed=new URL(sessionUri)}catch{deny('invalid_session_uri')}
 need(parsed.protocol==='https:','insecure_session_url');
 need(parsed.hostname==='storage.googleapis.com' ||
   parsed.hostname.endsWith('.storage.googleapis.com'),'untrusted_session_host');
 need(parsed.username===''&&parsed.password===''&&!parsed.hash,'invalid_session_url_authority');
 need(sessionUri.length<8192,'oversized_session_url');
 return {ownerUid,tenantId,epoch,uploadId,sessionDigest:digest(sessionUri),
  status:state.created,generation:null,verifiedAbsence:false};
}
function scoped(s,ref) {
 need(s&&ref,'session_missing');
 need(s.ownerUid===ref.ownerUid&&s.tenantId===ref.tenantId,'owner_tenant_mismatch');
 need(s.epoch===ref.epoch,'stale_writer_epoch');
 need(s.uploadId===ref.uploadId,'upload_identity_mismatch');
}
function boundEvidence(s,e) {
 return e?.authentic===true && e?.issuer==='approved-provider-verifier' &&
 e?.ownerUid===s.ownerUid && e?.tenantId===s.tenantId &&
 e?.epoch===s.epoch && e?.uploadId===s.uploadId &&
 same(e.sessionDigest,s.sessionDigest);
}
export function markCancellationRequested(s,ref) {
 scoped(s,ref);
 need(s.status===state.created||s.status===state.unknown,'invalid_cancel_phase');
 s.status=state.cancellationRequested;
 return {uploadId:s.uploadId,status:s.status}; // never return session URI
}

export function recordCancellationResult(s,ref,{evidence,verify}={}) {
 scoped(s,ref);
 need(s.status===state.cancellationRequested,'cancellation_not_requested');
 need(typeof verify==='function','provider_verifier_missing');
 need(evidence&&typeof evidence==='object','provider_evidence_required');
 const e=verify(evidence); // synthetic verifier: absolutely not a trust root
 need(boundEvidence(s,e),'provider_evidence_untrusted');
 if(e.providerState==='session-cancelled')s.status=state.cancelled;
 else if(e.providerState==='session-completed') {
   need(number(e.generation),'generation_required');
   s.status=state.cancelled;
   s.generation=e.generation;
 } else {
   s.status=state.unknown;
   deny('provider_cancel_ambiguous');
 }
 return {status:s.status,hasGeneration:s.generation!==null};
}
export function verifyCleanup(s,ref,{evidence,verify}={}) {
 scoped(s,ref);
 need(s.status===state.cancelled,'session_not_cancelled');
 need(typeof verify==='function','provider_verifier_missing');
 const e=verify(evidence);
 need(boundEvidence(s,e),'provider_evidence_untrusted');
 need(e.providerSessionTerminated===true,'provider_session_not_terminated');
 need(e.objectAbsentVerified===true,'object_absence_unverified');
 need(e.generationDeletedOrNeverCreated===true,'generation_cleanup_unverified');
 if(s.generation!==null)need(e.verifiedGeneration===s.generation,'generation_mismatch');
 s.verifiedAbsence=true;
 s.status=state.done;
 return {status:'drained',sessionDigest:s.sessionDigest};
}
export function publicReviewState(s) {
 return {ownerUid:s.ownerUid,tenantId:s.tenantId,epoch:s.epoch,
  uploadId:s.uploadId,sessionDigest:s.sessionDigest,status:s.status,
  generation:s.generation,verifiedAbsence:s.verifiedAbsence};
}


