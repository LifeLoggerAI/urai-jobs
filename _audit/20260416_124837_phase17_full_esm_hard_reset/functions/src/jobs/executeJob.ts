import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createLog } from '../core/logging.js.js';
import { updateJob, updateQueue } from '../core/lease.js.js';
import { JobDoc } from '../core/types.js.js';
import { URAI_Error, logError } from '../core/errors.js.js';
import { handleJobFailure } from './handleJobFailure.js.js';
import { updateJobResult } from '../core/results.js.js';

const db = admin.firestore();
const NARRATOR_WORKER_URL = process.env.NARRATOR_WORKER_URL;

// This function would be triggered by an event (e.g., Pub/Sub) carrying the jobId and leaseToken
export const executeJob = functions.https.onCall(async (data, context) => {
  const { jobId, leaseToken } = data;

  try {
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = (await jobRef.get()).data() as JobDoc;

    if (!jobDoc || jobDoc.execution.leaseToken !== leaseToken) {
      throw new URAI_Error('LeaseInvalid', 'AUTH', 'Invalid job ID or lease token.');
    }

    await updateJob(jobId, { status: 'RUNNING', 'execution.startedAt': admin.firestore.FieldValue.serverTimestamp() });
    await createLog(jobDoc.tenantId, 'INFO', 'WORKER', 'JobExecutionStarted', `Execution started for job ${jobId}`);

    if (!NARRATOR_WORKER_URL) {
      throw new Error('NARRATOR_WORKER_URL environment variable not set.');
    }

    const response = await axios.post(`${NARRATOR_WORKER_URL}/execute-job`, jobDoc);
    const result = response.data;

    await updateJobResult(jobId, 'SUCCESS', result);
    await updateQueue(jobId, { status: 'DONE' });

    await createLog(jobDoc.tenantId, 'INFO', 'WORKER', 'JobExecutionSuccess', `Execution successful for job ${jobId}`);

    return { success: true };

  } catch (error) {
    logError(error as URAI_Error | Error);
    await handleJobFailure(jobId, error as Error);
    return { success: false };
  }
});
