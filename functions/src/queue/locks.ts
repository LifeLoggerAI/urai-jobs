import { firestore } from 'firebase-admin';
import { logger } from '../observability/logger';

const db = firestore();
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function acquireJobLock(jobId: string, runId: string): Promise<boolean> {
  const lockRef = db.collection('jobLocks').doc(jobId);

  try {
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);

      if (lockDoc.exists) {
        const lockData = lockDoc.data();
        const expiresAt = lockData?.expiresAt.toMillis();

        if (expiresAt && Date.now() < expiresAt) {
          throw new Error(`Job ${jobId} is currently locked by run ${lockData?.runId}`);
        }
      }

      transaction.set(lockRef, {
        runId,
        expiresAt: firestore.Timestamp.fromMillis(Date.now() + LOCK_TTL_MS),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info(`Successfully acquired lock for job ${jobId}`, { jobId, runId });
    return true;
  } catch (error: any) {
    logger.warn(`Failed to acquire lock for job ${jobId}: ${error.message}`, { jobId, runId });
    return false;
  }
}

export async function releaseJobLock(jobId: string): Promise<void> {
  await db.collection('jobLocks').doc(jobId).delete();
  logger.info(`Released lock for job ${jobId}`, { jobId });
}
