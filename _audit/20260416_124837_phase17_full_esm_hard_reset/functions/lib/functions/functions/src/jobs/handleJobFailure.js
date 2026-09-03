import * as admin from 'firebase-admin';
import { updateJob, updateQueue } from '../core/lease';
import { createLog } from '../core/logging';
import { URAI_Error } from '../core/errors';
const db = admin.firestore();
export const handleJobFailure = async (jobId, error) => {
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = (await jobRef.get()).data();
    const attemptCount = jobDoc.execution.attemptCount + 1;
    const isTransient = (error instanceof URAI_Error && error.category === 'TRANSIENT');
    if (isTransient && attemptCount < jobDoc.execution.maxAttempts) {
        const backoff = Math.pow(2, attemptCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        const availableAt = admin.firestore.Timestamp.fromMillis(Date.now() + backoff);
        await updateJob(jobId, {
            status: 'RETRY',
            'execution.attemptCount': attemptCount,
            'error.lastFailedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        await updateQueue(jobId, { status: 'READY', availableAt, attemptCount });
        await createLog(jobDoc.tenantId, 'WARN', 'WORKER', 'JobRetry', `Job ${jobId} failed, will retry. Attempt ${attemptCount}/${jobDoc.execution.maxAttempts}`, { error: error.message });
    }
    else {
        await updateJob(jobId, { status: 'DEAD', 'error.message': error.message });
        await updateQueue(jobId, { status: 'DEAD' });
        await createLog(jobDoc.tenantId, 'ERROR', 'WORKER', 'JobDead', `Job ${jobId} has been moved to the dead-letter queue after ${attemptCount} attempts.`, { error: error.message });
    }
};
