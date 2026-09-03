import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { JobDoc } from '../core/types.js';
import { updateJob, updateQueue } from '../core/lease.js';
import { createLog } from '../core/logging.js';
import { URAI_Error } from '../core/errors.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();

export const handleJobFailure = async (jobId: string, error: Error) => {
  const jobRef = db.collection('jobs').doc(jobId);
  const jobDoc = (await jobRef.get()).data() as JobDoc;

  const attemptCount = jobDoc.execution.attemptCount + 1;
  const isTransient = (error instanceof URAI_Error && error.category === 'TRANSIENT');

  if (isTransient && attemptCount < jobDoc.execution.maxAttempts) {
    const backoff = Math.pow(2, attemptCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
    const availableAt = Timestamp.fromMillis(Date.now() + backoff);

    await updateJob(jobId, { 
      status: 'RETRY', 
      'execution.attemptCount': attemptCount, 
      'error.lastFailedAt': FieldValue.serverTimestamp() 
    });
    await updateQueue(jobId, { status: 'READY', availableAt, attemptCount });

    await createLog(
      jobDoc.tenantId, 
      'WARN', 
      'WORKER', 
      'JobRetry', 
      `Job ${jobId} failed, will retry. Attempt ${attemptCount}/${jobDoc.execution.maxAttempts}`,
      { error: error.message }
    );

  } else {
    await updateJob(jobId, { status: 'DEAD', 'error.message': error.message });
    await updateQueue(jobId, { status: 'DEAD' });

    await createLog(
      jobDoc.tenantId, 
      'ERROR', 
      'WORKER', 
      'JobDead', 
      `Job ${jobId} has been moved to the dead-letter queue after ${attemptCount} attempts.`,
      { error: error.message }
    );
  }
};
