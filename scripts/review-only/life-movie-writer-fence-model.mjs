/**
 * R521 REVIEW-ONLY MODEL, NOT RUNTIME AUTHORIZATION.
 *
 * Pure deterministic transition model for an eventual transactionally
 * reserved, storage-enforced Life Movie output broker. NO GCS, Firestore,
 * signatures, IAM, consent grants or worker writes are performed here.
 * Importing this module must never enable the hard-off worker write guard.
 * FENCING is never equivalent to REVOKED or a deletion acknowledgement.
 * A test caller cannot supply the missing real-cloud IAM and upload evidence.
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
  if (!snapshot || snapshot.schemaVersion !== 'urai-review-only-output-writer-fence-r573-v2' ||
      !sameScope(snapshot.scope, requiredScope(snapshot.scope)) ||
      !['OPEN','FENCING'].includes(snapshot.phase) ||
      snapshot.acknowledged !== false ||
      !Number.isSafeInteger(snapshot.epoch) || snapshot.epoch < 1 ||
      (snapshot.phase === 'OPEN' && (snapshot.revokedBy !== null || snapshot.epoch !== 1)) ||
      (snapshot.phase === 'FENCING' && (!validId(snapshot.revokedBy) || snapshot.epoch < 2)) ||
      !Array.isArray(snapshot.attempts) || snapshot.attempts.length > MAX_ATTEMPTS) deny();
  // Caller-provided review snapshots are untrusted. Reject forged/duplicated
  // reservation histories before processing any event, even a harmless retry.
  const seen = new Set();
  for (const attempt of snapshot.attempts) {
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) ||
        !validId(attempt.id) || seen.has(attempt.id) ||
        !Number.isSafeInteger(attempt.epoch) || attempt.epoch < 1 ||
        (snapshot.phase === 'OPEN'
          ? attempt.epoch !== snapshot.epoch ||
            !['RESERVED','UPLOADING','UPLOADED_NOT_FINAL','RECORDED'].includes(attempt.phase)
          : attempt.epoch >= snapshot.epoch ||
            !['RECONCILE_REQUIRED','REVIEW_ONLY_SETTLED'].includes(attempt.phase)) ||
        (attempt.generation !== null &&
          (!validId(attempt.generation) || !/^[1-9][0-9]*$/.test(attempt.generation) ||
            !Number.isSafeInteger(Number(attempt.generation)))) ||
        (['UPLOADED_NOT_FINAL','RECORDED'].includes(attempt.phase) && attempt.generation === null) ||
        (attempt.phase === 'RESERVED' && attempt.generation !== null)) deny();
    seen.add(attempt.id);
  }
}
function requireAttempt(state, attemptId) {
  const attempt = state.attempts.find(a => a.id === attemptId);
  if (!attempt) deny();
  return attempt;
}
function newReviewSnapshot(scope) {
  return { schemaVersion:'urai-review-only-output-writer-fence-r573-v2',
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
      next.phase='FENCING';
      next.revokedBy=event.eventId;
      next.epoch++;
      // Any old attempt could have bytes inflight or persisted. Retain all
      // attempts until an independently verified stop + Storage absence.
      for (const a of next.attempts) a.phase='RECONCILE_REQUIRED';
      break;
    }
    case 'settle-attempt': {
      if (next.phase !== 'FENCING' || expected !== next.epoch) deny();
      const a=requireAttempt(next,event.attemptId);
      const proof=event.reviewOnlyProof;
      if (a.phase !== 'RECONCILE_REQUIRED' || !proof ||
          proof.attemptId !== a.id || proof.epoch !== next.epoch ||
          proof.writerStopped !== true || proof.storageGenerationAbsent !== true ||
          proof.noPendingNetworkFinalize !== true || proof.timeoutOnly === true) deny();
      // This is a synthetic bookkeeping result, not physical GCS absence.
      a.phase='REVIEW_ONLY_SETTLED';
      break;
    }
    case 'acknowledge': {
      // R573: caller-supplied "all green" flags and synthetic settlement have
      // no issuer signatures, provider-originated GCS IAM denies, active stream
      // drain attestation or exact generation absence evidence. A review model
      // MUST NEVER generate an affirmative deletion ACK, even with zero attempts.
      // A distinct production implementation requires independent formal review.
      deny();
    }
    default: deny();
  }
  return next;
}
export { newReviewSnapshot, advanceReviewSnapshot, DENIED };
