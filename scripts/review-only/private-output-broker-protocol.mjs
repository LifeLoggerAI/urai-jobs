/**
 * R1733 REVIEW MODEL ONLY. No cloud API, auth, persistence, or production import.
 * The currently deployed/draft worker MUST continue to deny private writes.
 * This state-machine models invariants an independently approved broker needs.
 */
const fail = code => { throw new Error(code); };
const check = (value, code) => { if (!value) fail(code); };
const identity = (value) => typeof value === 'string' && /^[a-zA-Z0-9:_-]{4,160}$/.test(value);
const epochOK = value => Number.isSafeInteger(value) && value > 0;

export function createReviewLedger({ownerUid, tenantId, epoch = 1}) {
  check(identity(ownerUid) && identity(tenantId) && epochOK(epoch), 'invalid_review_identity');
  return {ownerUid, tenantId, epoch, phase:'active', reservations:new Map(), lastAck:null};
}

function scoped(s, ownerUid, tenantId, epoch) {
  check(ownerUid === s.ownerUid && tenantId === s.tenantId, 'owner_tenant_mismatch');
  check(epoch === s.epoch, 'stale_writer_epoch');
}
export function reserveReviewUpload(s, {ownerUid, tenantId, epoch, uploadId}) {
  scoped(s,ownerUid,tenantId,epoch);
  check(s.phase === 'active', 'write_fenced');
  check(identity(uploadId), 'invalid_upload_id');
  check(!s.reservations.has(uploadId), 'reservation_replay_denied');
  s.reservations.set(uploadId,{epoch, phase:'reserved'});
  return {ownerUid,tenantId,epoch,uploadId};
}
export function markReviewUploadCommitted(s, token) {
  scoped(s,token.ownerUid,token.tenantId,token.epoch);
  check(s.phase === 'active', 'write_fenced');
  const r=s.reservations.get(token.uploadId);
  check(r && r.epoch === token.epoch && r.phase === 'reserved','invalid_upload_reservation');
  r.phase='committed';
}
export function beginReviewRevocation(s, {ownerUid,tenantId,epoch}) {
  scoped(s,ownerUid,tenantId,epoch);
  check(s.phase === 'active' || s.phase === 'revoking','invalid_revocation_phase');
  s.phase='revoking';
  return {epoch, pending:[...s.reservations].filter(([,r])=>r.epoch===epoch&&r.phase!=='closed').map(([id])=>id)};
}
export function recordReviewDrain(s, token, evidence) {
  scoped(s,token.ownerUid,token.tenantId,token.epoch);
  check(s.phase === 'revoking','not_revoking');
  const r=s.reservations.get(token.uploadId);
  check(r && r.epoch === token.epoch && r.phase !== 'closed', 'drain_reservation_unknown');
  // Flags are SIMULATED. A live broker must independently establish provider
  // session termination, generation-bound deletion, and absence.
  check(evidence?.providerSessionTerminated === true, 'provider_upload_not_drained');
  check(evidence?.generationDeletedOrNeverCreated === true, 'generation_not_cleaned');
  check(evidence?.objectAbsentVerified === true, 'object_absence_not_verified');
  r.phase='closed';
}
export function acknowledgeReviewRevocation(s,{ownerUid,tenantId,epoch}) {

  scoped(s,ownerUid,tenantId,epoch);
  check(s.phase === 'revoking','revocation_not_started');
  const pending=[...s.reservations.values()].filter(r=>r.epoch===epoch&&r.phase!=='closed');
  check(pending.length===0,'pending_upload_drain');
  s.phase='revoked';
  s.lastAck={epoch};
  return {status:'applied',epoch};
}
export function explicitReviewRegrant(s,{ownerUid,tenantId,epoch}) {
  scoped(s,ownerUid,tenantId,epoch);
  check(s.phase==='revoked' && s.lastAck?.epoch===epoch,'revocation_ack_required');
  check(epochOK(epoch+1),'epoch_exhausted');
  s.epoch=epoch+1;
  s.phase='active';
  return {epoch:s.epoch};
}


