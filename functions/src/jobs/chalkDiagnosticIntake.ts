import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { currentJobActor, requireJobOperator } from '../core/currentJobActor.js';
import {
  assertChalkLocalEmulatorGate, buildChalkDiagnosticIntake, existingChalkIntakeMatches,
} from './chalkDiagnosticIntakeAuthority.js';

// Emulator-only authorized engineering intake into the EXISTING Jobs master.
// Deliberately never creates jobQueue entries, leases, workers or tool grants.
export const submitChalkEngineeringDiagnostic = onCall({ region:'us-central1', cors:true }, async request => {
  try { assertChalkLocalEmulatorGate(process.env); }
  catch { throw new HttpsError('failed-precondition', 'Chalk engineering intake is not admitted in this environment.'); }
  const actor = await currentJobActor(request);
  requireJobOperator(actor);
  const permissions = (actor.profile as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions) || !permissions.includes('engineering:operate')) {
    throw new HttpsError('permission-denied', 'Explicit engineering operation permission is required.');
  }
  let intent;
  try {
    intent = buildChalkDiagnosticIntake(request.data, {
      ownerUid: actor.uid, pinnedSourceSha: String(process.env.CHALK_PINNED_SPATIAL_SHA || ''),
    });
  } catch {
    throw new HttpsError('invalid-argument', 'Exact-source, nonprivate spatial diagnostic required.');
  }
  const db = getFirestore();
  const jobRef = db.collection('jobs').doc(intent.jobId);
  const queueRef = db.collection('jobQueue').doc(intent.jobId);
  const logRef = jobRef.collection('logs').doc('chalk-intake-created');
  return db.runTransaction(async transaction => {
    const current = await currentJobActor(request, transaction);
    requireJobOperator(current);
    const currentPermissions = (current.profile as { permissions?: unknown }).permissions;
    if (current.uid !== intent.ownerUid || !Array.isArray(currentPermissions) ||
        !currentPermissions.includes('engineering:operate')) {
      throw new HttpsError('permission-denied', 'Engineering permission changed.');
    }
    // Canonical Jobs transaction read order: master before queue.
    const master = await transaction.get(jobRef);
    const queue = await transaction.get(queueRef);
    if (queue.exists) throw new HttpsError('failed-precondition', 'Engineering request has a queue entry; do not replay intake.');
    if (master.exists) {
      if (!existingChalkIntakeMatches(master.data(), intent)) {
        throw new HttpsError('already-exists', 'The request identity is already bound to another revision.');
      }
      return { jobId:intent.jobId, status:'PENDING', admission:'HELD_UNQUEUED',
        queued:false, deduplicated:true };
    }
    const now = FieldValue.serverTimestamp();
    transaction.create(jobRef, { ...intent, createdAt:now, updatedAt:now });
    transaction.create(logRef, { level:'info', source:'chalk-nonproduction-intake',
      message:'Authorized diagnostic retained for human-governed engineering review; no dispatch.',
      metadata:{sourceSha:intent.payload.baseSha, requestDigest:intent.payload.requestDigest,
        providerSpendUsd:0, queued:false}, createdAt:now });
    return { jobId:intent.jobId, status:'PENDING', admission:'HELD_UNQUEUED',
      queued:false, deduplicated:false };
  });
});
