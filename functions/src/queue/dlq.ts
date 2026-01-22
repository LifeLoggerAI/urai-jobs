import { firestore } from 'firebase-admin';
import { Job } from '../jobs/types';
import { logger } from '../observability/logger';
import { recordJobEvent } from '../observability/events';

const db = firestore();

export async function moveToDlq(job: Job<any>, error: Error): Promise<void> {
  const { id: jobId } = job;

  await db.runTransaction(async (transaction) => {
    const jobRef = db.collection('jobs').doc(jobId);
    const dlqRef = db.collection('jobDlq').doc(jobId);

    transaction.update(jobRef, { 
      status: 'deadletter', 
      updatedAt: firestore.FieldValue.serverTimestamp() 
    });
    transaction.set(dlqRef, {
      ...job,
      error: {
        message: error.message,
        stack: error.stack,
      },
      failedAt: firestore.FieldValue.serverTimestamp(),
    });
  });

  await recordJobEvent(jobId, 'error', 'Job moved to dead-letter queue.', { error: { message: error.message } });
  logger.error(`Job ${jobId} moved to DLQ.`, error, { jobId });
}
