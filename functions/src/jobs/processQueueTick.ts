import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import { JobQueueEntry, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;
const JOB_EXECUTION_TOPIC = 'job-execution';
const LEASE_DURATION_MS = 60 * 1000; // 1 minute
const DISPATCH_RETRY_DELAY_MS = 5_000;

const pubsub = new PubSub();

function createLease(workerId: string): JobLease {
  const leaseId = ulid();
  const leaseToken = ulid();
  const expiresAt = new Date(Date.now() + LEASE_DURATION_MS);

  return {
    leaseId,
    leaseToken,
    workerId,
    expiresAt,
  };
}

async function returnLeaseAfterPublishFailure(jobId: string, leaseToken: string, error: unknown) {
  const db = getFirestore();
  const queueRef = jobQueueEntryDoc(jobId);
  const masterJobRef = jobDoc(jobId);
  const errorMessage = error instanceof Error ? error.message : String(error);

  await db.runTransaction(async (transaction) => {
    const queueDoc = await transaction.get(queueRef);
    if (!queueDoc.exists) return;

    const queue = queueDoc.data() as JobQueueEntry;
    if (queue.status !== 'LEASED' || queue.lease?.leaseToken !== leaseToken) return;

    const retryUpdate = {
      status: 'PENDING',
      lease: FieldValue.delete(),
      availableAt: Timestamp.fromMillis(Date.now() + DISPATCH_RETRY_DELAY_MS),
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.update(queueRef, retryUpdate);
    transaction.update(masterJobRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      lastDispatchError: errorMessage.slice(0, 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export const processQueueTick = onSchedule('every 1 minutes', async () => {
  const db = getFirestore();
  const tickWorkerId = `tick-${ulid()}`;

  console.log(`Starting queue processing tick with worker ID: ${tickWorkerId}`);

  const pendingJobsQuery = db.collection('jobQueue')
    .where('status', '==', 'PENDING')
    .where('availableAt', '<=', new Date())
    .orderBy('availableAt')
    .limit(MAX_JOBS_TO_LEASE_PER_TICK);

  const pendingJobsSnapshot = await pendingJobsQuery.get();

  if (pendingJobsSnapshot.empty) {
    console.log('No pending jobs found for this tick.');
    return;
  }

  console.log(`Found ${pendingJobsSnapshot.size} pending job(s). Attempting to lease.`);

  const leasePromises = pendingJobsSnapshot.docs.map(async (doc) => {
    const { jobId } = doc.data() as JobQueueEntry;
    let lease: JobLease | null = null;

    try {
      lease = await db.runTransaction(async (transaction) => {
        const queueRef = jobQueueEntryDoc(jobId);
        const masterJobRef = jobDoc(jobId);

        const queueDoc = await transaction.get(queueRef);
        if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
          return null;
        }

        const newLease = createLease(tickWorkerId);
        const now = FieldValue.serverTimestamp();

        const leaseUpdate = {
          status: 'LEASED',
          lease: newLease,
          updatedAt: now,
        };

        transaction.update(queueRef, leaseUpdate);
        transaction.update(masterJobRef, leaseUpdate);

        console.log(`[${tickWorkerId}] Successfully leased job ${jobId}`);
        return newLease;
      });

      if (lease?.leaseToken) {
        const message = {
          jobId,
          leaseToken: lease.leaseToken,
        };
        await pubsub.topic(JOB_EXECUTION_TOPIC).publishMessage({ json: message });
        console.log(`[${tickWorkerId}] Published execution message for job ${jobId}`);
      }
    } catch (error) {
      if (lease?.leaseToken) {
        await returnLeaseAfterPublishFailure(jobId, lease.leaseToken, error);
      }
      console.error(`[${tickWorkerId}] Critical error leasing or dispatching job ${jobId}.`, error);
    }
  });

  await Promise.all(leasePromises);

  console.log(`Finished queue processing tick: ${tickWorkerId}`);
});
