
import { db } from '../lib/firebase';
import { Job } from './types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { calculateBackoff } from './backoff';

const LEASE_TIMEOUT_MS = 60 * 1000; // 1 minute

export async function claimJobs(workerId: string, limit: number): Promise<string[]> {
    const now = Timestamp.now();
    const query = db.collection('jobs')
        .where('status', '==', 'PENDING')
        .where('runAfter', '<=', now)
        .orderBy('runAfter')
        .orderBy('priority', 'desc')
        .orderBy('createdAt')
        .limit(limit);

    const jobIds: string[] = [];

    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(query);
        snapshot.forEach(doc => {
            const job = doc.data() as Job;
            if (!job.leaseExpiresAt || job.leaseExpiresAt.toMillis() < now.toMillis()) {
                transaction.update(doc.ref, {
                    status: 'RUNNING',
                    leaseOwner: workerId,
                    leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + LEASE_TIMEOUT_MS),
                    updatedAt: serverTimestamp(),
                    attempts: FieldValue.increment(1)
                });
                jobIds.push(doc.id);
            }
        });
    });

    return jobIds;
}

export async function completeJob(jobId: string): Promise<void> {
    await db.collection('jobs').doc(jobId).update({
        status: 'SUCCEEDED',
        updatedAt: serverTimestamp(),
        leaseOwner: null,
        leaseExpiresAt: null,
    });
    logger.info(`Job ${jobId} completed successfully.`);
}

export async function failJob(jobId: string, error: Error): Promise<void> {
    const jobRef = db.collection('jobs').doc(jobId);
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        const job = jobDoc.data() as Job;

        if (job.attempts >= job.maxAttempts) {
            transaction.update(jobRef, {
                status: 'DEAD',
                updatedAt: serverTimestamp(),
                lastError: { message: error.message, stack: error.stack },
                leaseOwner: null,
                leaseExpiresAt: null,
            });
            logger.error(`Job ${jobId} has been marked as DEAD.`);
        } else {
            const backoff = calculateBackoff(job.attempts);
            transaction.update(jobRef, {
                status: 'FAILED',
                updatedAt: serverTimestamp(),
                runAfter: Timestamp.fromMillis(Timestamp.now().toMillis() + backoff),
                lastError: { message: error.message, stack: error.stack },
                leaseOwner: null,
                leaseExpiresAt: null,
            });
            logger.warn(`Job ${jobId} failed. Retrying in ${backoff}ms.`);
        }
    });
}
