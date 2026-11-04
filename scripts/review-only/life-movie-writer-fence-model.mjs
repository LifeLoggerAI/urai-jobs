/**
 * R521 REVIEW-ONLY MODEL, NOT RUNTIME AUTHORIZATION.
 *
 * Pure deterministic transition model for an eventual transactionally
 * reserved, storage-enforced Life Movie output broker. NO GCS, Firestore,
 * signatures, IAM, consent grants or worker writes are performed here.
 * Importing this module must never enable the hard-off worker write guard.
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PURPOSE = 'life-movie.render';
const MAX_ATTEMPTS = 64;
const DENIED = 'private_output_write_fence_model_denied';

function validId(value) { return typeof value === 'string' && VALID_ID.test(value); }
function deny() { throw new Error(DENIED); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sameScope(a, b) {
  return a && b && a.tenantId === b.tenantId && a.ownerUid === b.ownerUid &&
    a.projectId === b.projectId && a.purpose === b.purpose;
}
function requiredScope(scope) {
  if (!scope || !validId(scope.tenantId) || !validId(scope.ownerUid) ||
    !validId(scope.projectId) || scope.purpose !== PURPOSE) deny();
  return {
    tenantId: scope.tenantId, ownerUid: scope.ownerUid,
    projectId: scope.projectId, purpose: PURPOSE,
  };
}
function requireSnapshot(snapshot) {
  if (!snapshot || !sameScope(snapshot.scope, requiredScope(snapshot.scope)) ||
      !['OPEN','REVOKING','REVOKED'].includes(snapshot.phase) ||
      !Number.isSafeInteger(snapshot.epoch) || snapshot.epoch < 1 ||
      !Array.isArray(snapshot.attempts) || snapshot.attempts.length > MAX_ATTEMPTS) deny();
}
function requireAttempt(state, attemptId) {
  const attempt = state.attempts.find(a => a.id === attemptId);
  if (!attempt) deny();
  return attempt;
}
function newReviewSnapshot(scope) {
  return { schemaVersion:'urai-review-only-output-writer-fence-r521-v1',
    scope: requiredScope(scope), epoch: 1, phase:'OPEN',
    revokedBy: null, attempts: [], acknowledged: false };
}
function advanceReviewSnapshot(snapshot, event) {
  requireSnapshot(snapshot);
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !sameScope(snapshot.scope, event.scope)) deny();
  const next=clone(snapshot);
  const expected = event.expectedEpoch;
  switch (event.kind) {
    case 'reserve': {
      if (next.phase !== 'OPEN' || expected !== next.epoch ||
          !validId(event.attemptId) || next.attempts.length >= MAX_ATTEMPTS ||
          next.attempts.some(a => a.id === event.attemptId)) deny();
      next.attempts.push({id:event.attemptId, epoch: next.epoch,
        phase:'RESERVED', generation:null});
      break;
    }
    case 'begin-upload': {
      if (next.phase !== 'OPEN' || expected !== next.epoch) deny();
      const a=requireAttempt(next,event.attemptId);
      if(a.epoch !== next.epoch || a.phase !== 'RESERVED') deny();
      a.phase='UPLOADING';
      break;
    }
    case 'bytes-committed': {
      // Network writes may complete AFTER revoke. We must account for them,
      // not pretend the original preflight prevents their existence.
      const a=requireAttempt(next,event.attemptId);
      if (a.phase !== 'UPLOADING' && a.phase !== 'RECONCILE_REQUIRED') deny();
      if (!validId(event.generation) || !/^[1-9][0-9]*$/.test(event.generation) ||
          !Number.isSafeInteger(Number(event.generation))) deny();
      a.generation = event.generation;
      a.phase = next.phase === 'OPEN' && a.epoch === next.epoch
        ? 'UPLOADED_NOT_FINAL' : 'RECONCILE_REQUIRED';
      break;
    }
    case 'finalize': {
      if (next.phase !== 'OPEN' || expected !== next.epoch) deny();
      const a=requireAttempt(next,event.attemptId);
      if (a.epoch !== next.epoch || a.phase !== 'UPLOADED_NOT_FINAL') deny();
      a.phase='RECORDED';
      break;
    }
    case 'withdraw': {
      if (!validId(event.eventId)) deny();
      if (next.revokedBy !== null) {
        if(next.revokedBy !== event.eventId) deny();
        return next; // same-event retry never reopens or increments epoch
      }
      if(next.phase !== 'OPEN' || next.epoch >= Number.MAX_SAFE_INTEGER) deny();
      next.phase='REVOKING';
      next.revokedBy=event.eventId;
      next.epoch++;
      // Any old attempt could have bytes inflight or persisted. Retain all
      // attempts until an independently verified stop + Storage absence.
      for (const a of next.attempts) a.phase='RECONCILE_REQUIRED';
      break;
    }
    case 'settle-attempt': {
      if (next.phase !== 'REVOKING' || expected !== next.epoch) deny();
      const a=requireAttempt(next,event.attemptId);
      const proof=event.reviewOnlyProof;
      if (a.phase !== 'RECONCILE_REQUIRED' || !proof ||
          proof.attemptId !== a.id || proof.epoch !== next.epoch ||
          proof.writerStopped !== true || proof.storageGenerationAbsent !== true ||
          proof.noPendingNetworkFinalize !== true || proof.timeoutOnly === true) deny();
      a.phase='SETTLED_ABSENT';
      break;
    }
    case 'acknowledge': {
      if (next.phase !== 'REVOKING' || expected !== next.epoch ||
          next.attempts.some(a=>a.phase!=='SETTLED_ABSENT')) deny();
      const proof=event.reviewOnlyProof;
      if (!proof || !sameScope(next.scope,proof.scope) ||
          proof.epoch !== next.epoch || proof.storageAllApprovedBucketsEmpty !== true ||
          proof.oldWriterIamDenied !== true || proof.brokerOldEpochDenied !== true ||
          proof.noOutstandingUploadTokens !== true || proof.independentlyVerified !== true) deny();
      next.phase='REVOKED';
      next.acknowledged=true;
      break;
    }
    default: deny();
  }
  return next;
}
export { newReviewSnapshot, advanceReviewSnapshot, DENIED };
