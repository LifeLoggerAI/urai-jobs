import { firestore } from 'firebase-admin';
import { Job } from '../jobs/types';
import { logger } from '../observability/logger';
import { recordJobEvent } from '../observability/events';
import { moveToDlq } from './dlq';

const db = firestore();

export async function handleRetry(job: Job<any>, error: Error): Promise<void> {
  const { id: jobId, attempts, maxAttempts, backoff } = job;

  if (attempts >= maxAttempts) {
    await moveToDlq(job, error);
    return;
  }

  const nextAttempt = attempts + 1;
  const delayMs = backoff.strategy === 'exponential'
    ? backoff.initialDelay * Math.pow(backoff.factor || 2, nextAttempt - 1)
    : backoff.initialDelay;

  const availableAt = firestore.Timestamp.fromMillis(Date.now() + delayMs);

  await db.collection('jobs').doc(jobId).update({
    status: 'queued',
    attempts: nextAttempt,
    availableAt,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await recordJobEvent(
    jobId,
    'warn',
    `Job attempt ${attempts} failed. Retrying in ${delayMs}ms.`,
    { error: { message: error.message } }
  );

  logger.warn(`Job ${jobId} failed, will retry.`, { jobId, nextAttempt, delayMs });
}
