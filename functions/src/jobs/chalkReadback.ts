import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { currentJobActor, requireJobOperator } from '../core/currentJobActor.js';
import { redactChalkJobDocuments } from './chalkReadbackAuthority.js';

// No engineering worker admission: this is a protected read-only projection
// over the existing canonical Jobs master collection. Never send payloads.
export const listChalkEngineeringJobs = onCall({ region: 'us-central1', cors: true }, async request => {
  const actor = await currentJobActor(request);
  requireJobOperator(actor);
  const input = request.data && typeof request.data === 'object' && !Array.isArray(request.data)
    ? request.data as Record<string, unknown> : {};
  const limit = input.limit === undefined ? 20 : input.limit;
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 40) {
    throw new HttpsError('invalid-argument', 'Engineering readback limit must be 1–40.');
  }
  const snapshot = await getFirestore().collection('jobs')
    .where('ownerUid', '==', actor.uid)
    .limit(limit)
    .select('ownerUid', 'type', 'jobType', 'status')
    .get();
  // Repeat the existing native Jobs authorization on readback; a changed
  // operator account must not receive a stale result after a network wait.
  requireJobOperator(await currentJobActor(request));
  const jobs = redactChalkJobDocuments(snapshot.docs, actor.uid);
  return { jobs, scanned: snapshot.size, windowLimited: snapshot.size >= limit,
    source: 'urai-jobs-protected-redacted-readback-v1' };
});
