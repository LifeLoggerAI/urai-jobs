import { ulid } from 'ulid';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { withAuthenticatedRole } from '../core/auth';
import { httpsError } from '../core/errors';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths';
const CreateJobSchema = z.object({
    jobType: z.string().min(3, 'Job type must be at least 3 characters'),
    payload: z.record(z.any()),
    idempotencyKey: z.string().optional(),
});
const handler = async (data, context) => {
    const uid = context.auth?.uid || 'dev-user';
    const validationResult = CreateJobSchema.safeParse(data);
    if (!validationResult.success) {
        throw httpsError('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
    }
    const { jobType, payload } = validationResult.data;
    const db = getFirestore();
    const jobId = ulid();
    const now = FieldValue.serverTimestamp();
    const newJob = {
        jobId: jobId,
        jobType: jobType,
        payload: payload,
        status: 'PENDING'
    };
    const newQueueEntry = {
        jobId: jobId,
        jobType: jobType,
        status: 'PENDING'
    };
    try {
        await db.runTransaction(async (transaction) => {
            const jobRef = jobDoc(jobId);
            const queueRef = jobQueueEntryDoc(jobId);
            transaction.create(jobRef, {
                ...newJob,
                createdBy: uid,
                createdAt: now,
                updatedAt: now
            });
            transaction.create(queueRef, {
                ...newQueueEntry,
                createdAt: now
            });
        });
    }
    catch (error) {
        console.error('Error creating job in transaction:', error);
        throw httpsError('internal', 'Failed to create job.', error?.message);
    }
    return { jobId };
};
export const createJob = withAuthenticatedRole(['admin', 'user'], handler);
