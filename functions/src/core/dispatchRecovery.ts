import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Job, JobQueueEntry, JobQueueStatus } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from './firestore-paths.js';
import { isTerminalJobStatus } from '../jobs/executionGuards.js';

const DEFAULT_DISPATCH_RETRY_DELAY_MS = 5_000;

function terminalQueueStatus(status: unknown): JobQueueStatus {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DEAD') return 'DEAD';
  return 'DONE';
}

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
  const availableAt = Timestamp.fromMillis(Date.now() + Math.max(1_000, retryDelayMs));

  return db.runTransaction(async (transaction) => {
    const [queueDoc, masterJobDoc] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(masterJobRef),
    ]);
    if (!queueDoc.exists) return false;

    const queue = queueDoc.data() as JobQueueEntry;
    if (queue.status !== 'LEASED' || queue.lease?.leaseToken !== leaseToken) return false;

    const updatedAt = FieldValue.serverTimestamp();
    if (!masterJobDoc.exists) {
      transaction.update(queueRef, {
        status: 'DEAD',
        lease: FieldValue.delete(),
        lastDispatchError: 'Master job document is missing after dispatch publication failed.',
        updatedAt,
      });
      return false;
    }

    const job = masterJobDoc.data() as Job;
    if (isTerminalJobStatus(job.status)) {
      transaction.update(queueRef, {
        status: terminalQueueStatus(job.status),
        lease: FieldValue.delete(),
        updatedAt,
      });
      return false;
    }
    if (job.status !== 'LEASED' || job.lease?.leaseToken !== leaseToken) return false;

    transaction.update(queueRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      availableAt,
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt,
    });
    transaction.update(masterJobRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt,
    });
    return true;
  });
}
