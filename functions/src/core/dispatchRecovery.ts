import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from './firestore-paths.js';

const DEFAULT_DISPATCH_RETRY_DELAY_MS = 5_000;

export async function returnLeaseAfterPublishFailure(
  jobId: string,
  leaseToken: string,
  error: unknown,
  retryDelayMs = DEFAULT_DISPATCH_RETRY_DELAY_MS
): Promise<boolean> {
  const db = getFirestore();
  const queueRef = jobQueueEntryDoc(jobId);
  const masterJobRef = jobDoc(jobId);
  const errorMessage = error instanceof Error ? error.message : String(error);

  return db.runTransaction(async (transaction) => {
    const queueDoc = await transaction.get(queueRef);
    if (!queueDoc.exists) return false;

    const queue = queueDoc.data() as JobQueueEntry;
    if (queue.status !== 'LEASED' || queue.lease?.leaseToken !== leaseToken) return false;

    transaction.update(queueRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      availableAt: Timestamp.fromMillis(Date.now() + Math.max(1_000, retryDelayMs)),
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(masterJobRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}
