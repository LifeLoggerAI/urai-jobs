// Emulator-only intake. A review receipt is NEVER a Jobs queue entry or tool grant.
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { currentJobActor, requireJobOperator } from '../core/currentJobActor.js';
import { prepareChalkDiagnosticReview } from './chalkDiagnosticIntakeContract.js';

function enabled(): string {
  if (process.env.FUNCTIONS_EMULATOR !== 'true' ||
      process.env.URAI_CHALK_INTAKE_ENABLED !== 'true' ||
      ['prod','production','staging'].includes(String(process.env.URAI_ENV || '').toLowerCase())) {
    throw new HttpsError('failed-precondition', 'Chalk diagnostic intake disabled.');
  }
  return process.env.URAI_CHALK_SPATIAL_SOURCE_SHA || '';
}

export const submitChalkDiagnosticReview = onCall({region:'us-central1',cors:true}, async request => {
  const sourceSha = enabled();
  const actor = await currentJobActor(request);
  requireJobOperator(actor);
  let review;
  try { review = prepareChalkDiagnosticReview(request.data, actor.uid, sourceSha); }
  catch { throw new HttpsError('invalid-argument', 'Invalid or unverified diagnostic.'); }
  const db = getFirestore();
  const ref = db.collection('chalkDiagnosticReviews').doc(review.reviewId);
  const quotaRef = db.collection('chalkDiagnosticReviewThrottle').doc(actor.uid);
  const result = await db.runTransaction(async tx => {
    const current = await currentJobActor(request, tx);
    requireJobOperator(current);
    if (current.uid !== actor.uid) throw new HttpsError('permission-denied','Identity changed.');
    const prior = await tx.get(ref);
    if (prior.exists) {
      const data = prior.data();
      if (data?.ownerUid !== actor.uid || data?.digest !== review.digest ||
          data?.state !== 'REVIEW_ONLY_NOT_QUEUED') {
        throw new HttpsError('already-exists','Conflicting request.');
      }
      return 'EXISTING';
    }
    const quota = await tx.get(quotaRef);
    const q = quota.exists ? quota.data() : null;
    const now = Date.now();
    const active = Number.isSafeInteger(q?.windowStartMs) && q.windowStartMs <= now &&
      q.windowStartMs > now - 3600000;
    const used = active ? q?.count : 0;
    if (!Number.isSafeInteger(used) || used < 0 || used >= 8) {
      throw new HttpsError('resource-exhausted','Diagnostic review quota reached.');
    }
    // No jobQueue write, no model invocation, no private memory payload.
    tx.create(ref, {...review, reportedAt: FieldValue.serverTimestamp()});
    tx.set(quotaRef,{ownerUid:actor.uid,windowStartMs:active?q.windowStartMs:now,
      count:used+1,updatedAt:FieldValue.serverTimestamp()});
    return 'RECORDED';
  });
  return {reviewId:review.reviewId,requestId:review.requestId,
    state:'REVIEW_ONLY_NOT_QUEUED',result,sourceSha:review.diagnostic.sourceSha};
});

export const getChalkDiagnosticReview = onCall({region:'us-central1',cors:true}, async request => {
  enabled();
  const actor = await currentJobActor(request);
  requireJobOperator(actor);
  const body = request.data;
  const id = body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length===1 && 'reviewId' in body ? body.reviewId : null;
  if (typeof id !== 'string' || !/^cr_[a-f0-9]{64}$/.test(id)) {
    throw new HttpsError('invalid-argument','Valid review ID required.');
  }
  const snap = await getFirestore().collection('chalkDiagnosticReviews').doc(id).get();
  const current = await currentJobActor(request);
  requireJobOperator(current);
  if (current.uid !== actor.uid || !snap.exists || snap.data()?.ownerUid !== actor.uid ||
      snap.data()?.state !== 'REVIEW_ONLY_NOT_QUEUED') {
    throw new HttpsError('not-found','Engineering review unavailable.');
  }
  const data = snap.data()!;
  return {reviewId:id,requestId:data.requestId,state:'REVIEW_ONLY_NOT_QUEUED',
    sourceSha:data.diagnostic?.sourceSha,digest:data.digest,
    component:data.diagnostic?.component,route:data.diagnostic?.route};
});
