/**
 * R1734 REVIEW-ONLY Firestore transaction protocol. Requires caller-injected
 * emulator/client; NOT imported by production; NO GCS writes or authentication.
 * An authenticated production broker, trusted provider receipts and IAM remain
 * unimplemented. Never use these APIs to acknowledge real deletion.
 */
import { createHash } from 'node:crypto';

const ID=/^[a-zA-Z0-9:_-]{4,160}$/;
const fail=message=>{throw new Error(message)};
const check=(condition,message)=>{if(!condition)fail(message)};
const valid=id=>typeof id==='string'&&ID.test(id);
const validEpoch=epoch=>Number.isSafeInteger(epoch)&&epoch>0;
const reservationKey=id=>createHash('sha256').update(id).digest('hex');
export const REVIEW_COLLECTION='r1734BrokerReviewState';

export function createFirestoreBrokerReview(db) {
  check(db&&typeof db.runTransaction==='function'&&typeof db.collection==='function','db_required');
  const docRef=tenantId=>{
    check(valid(tenantId),'invalid_tenant_id');
    return db.collection(REVIEW_COLLECTION).doc(reservationKey(tenantId));
  };
  const scope=(s,arg)=>{
    check(s,'review_state_missing');
    check(s.ownerUid===arg.ownerUid&&s.tenantId===arg.tenantId,'owner_tenant_mismatch');
    check(s.epoch===arg.epoch,'stale_writer_epoch');
  };
  async function transact(arg, fn) {
    check(valid(arg.ownerUid)&&valid(arg.tenantId)&&validEpoch(arg.epoch),'invalid_scope');
    return db.runTransaction(async tx=>{
      const ref=docRef(arg.tenantId),snap=await tx.get(ref);
      const state=snap.exists?snap.data():null;
      scope(state,arg);
      const answer=fn(state);
      tx.set(ref,state);
      return answer;
    });
  }
  async function initializeReview({ownerUid,tenantId}) {
    check(valid(ownerUid)&&valid(tenantId),'invalid_scope');
    return db.runTransaction(async tx=>{
      const ref=docRef(tenantId);
      check(!(await tx.get(ref)).exists,'review_state_already_initialized');
      tx.create(ref,{ownerUid,tenantId,epoch:1,phase:'active',ackEpoch:null,reservations:{}});
      return {epoch:1};
    });
  }
  async function reserveReview(arg) {
    check(valid(arg.uploadId),'invalid_upload_id');
    return transact(arg,s=>{
      check(s.phase==='active','write_fenced');
      const key=reservationKey(arg.uploadId);
      check(!s.reservations[key],'reservation_replay_denied');
      check(Object.keys(s.reservations).length<128,'reservation_limit');
      s.reservations[key]={epoch:s.epoch,status:'reserved'};
      return {ownerUid:s.ownerUid,tenantId:s.tenantId,epoch:s.epoch,uploadId:arg.uploadId};
    });
  }
  async function commitReview(arg) {
    check(valid(arg.uploadId),'invalid_upload_id');
    return transact(arg,s=>{
      check(s.phase==='active','write_fenced');
      const item=s.reservations[reservationKey(arg.uploadId)];
      check(item&&item.epoch===arg.epoch&&item.status==='reserved','reservation_not_active');
      item.status='committed';
      return {status:'committed'};
    });
  }
  async function beginReviewRevocation(arg) {
    return transact(arg,s=>{
      check(s.phase==='active'||s.phase==='revoking','invalid_revocation_phase');
      s.phase='revoking';
      return {epoch:s.epoch,pending:Object.values(s.reservations)
        .filter(v=>v.epoch===s.epoch&&v.status!=='closed').length};
    });
  }

  async function recordReviewDrain(arg,{receipt,verifyProviderEvidence}={}) {
    check(valid(arg.uploadId),'invalid_upload_id');
    check(typeof verifyProviderEvidence==='function','trusted_provider_verifier_missing');
    check(receipt&&typeof receipt==='object','provider_receipt_required');
    // A real implementation MUST use a vetted independent service verifier;
    // tests supply only a synthetic mock. Client-provided booleans are denied.
    const verified=await verifyProviderEvidence(receipt);
    check(verified&&verified.authentic===true
      &&verified.ownerUid===arg.ownerUid
      &&verified.tenantId===arg.tenantId
      &&verified.epoch===arg.epoch
      &&verified.uploadId===arg.uploadId
      &&verified.providerSessionTerminated===true
      &&verified.generationDeletedOrNeverCreated===true
      &&verified.objectAbsentVerified===true,'trusted_provider_evidence_missing');
    return transact(arg,s=>{
      check(s.phase==='revoking','not_revoking');
      const item=s.reservations[reservationKey(arg.uploadId)];
      check(item&&item.epoch===arg.epoch&&item.status!=='closed','drain_reservation_unknown');
      item.status='closed';
      item.reviewEvidenceId=String(verified.receiptId??'').slice(0,160);
      return {status:'drained'};
    });
  }
  async function acknowledgeReviewRevocation(arg) {
    return transact(arg,s=>{
      check(s.phase==='revoking','revocation_not_started');
      check(!Object.values(s.reservations).some(item=>
        item.epoch===arg.epoch&&item.status!=='closed'),'pending_upload_drain');
      s.phase='revoked';
      s.ackEpoch=arg.epoch;
      return {status:'applied',epoch:arg.epoch};
    });
  }
  async function explicitReviewRegrant(arg) {
    return transact(arg,s=>{
      check(s.phase==='revoked'&&s.ackEpoch===arg.epoch,'revocation_ack_required');
      check(validEpoch(arg.epoch+1),'epoch_exhausted');
      s.epoch++;
      s.phase='active';
      return {epoch:s.epoch};
    });
  }
  async function inspectReview(tenantId) {
    return (await docRef(tenantId).get()).data()??null;
  }
  return {initializeReview,reserveReview,commitReview,beginReviewRevocation,
    recordReviewDrain,acknowledgeReviewRevocation,explicitReviewRegrant,inspectReview};
}

