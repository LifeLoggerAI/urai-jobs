import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const JobPayload = z.object({
  type: z.string(),
  payload: z.any(),
  idempotencyKey: z.string(),
  scheduledFor: z.date().optional(),
});

export async function enqueueJob(jobData: z.infer<typeof JobPayload>) {
  const firestore = getFirestore();

  const { type, payload, idempotencyKey, scheduledFor } = JobPayload.parse(jobData);

  const traceId = uuidv4();

  const job = {
    type,
    status: 'queued',
    priority: 0,
    attempt: 0,
    maxAttempts: 8,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    scheduledFor: scheduledFor || null,
    idempotencyKey,
    payload,
    traceId,
    lockedBy: null,
  };

  const jobId = await firestore.runTransaction(async (transaction) => {
    const jobQuery = firestore
      .collection('jobs')
      .where('idempotencyKey', '==', idempotencyKey);

    const jobSnapshot = await transaction.get(jobQuery);

    if (!jobSnapshot.empty) {
      console.log(`Job with idempotency key ${idempotencyKey} already exists.`);
      return jobSnapshot.docs[0].id;
    }

    const jobRef = firestore.collection('jobs').doc();
    transaction.set(jobRef, job);
    return jobRef.id;
  });

  if (jobId) {
    await getFunctions().taskQueue('runJob').enqueue({ jobId });
  }

  return jobId;
}
