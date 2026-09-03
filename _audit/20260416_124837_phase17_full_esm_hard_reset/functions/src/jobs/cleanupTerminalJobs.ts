import { Job, JobQueueEntry, UserRole, JobLog, NarratorTtsPayloadSchema } from '../shared-types.js.js';


// URAI-JOBS: Job Cleanup and Finalization
// Version: 1.0.0

import * as functions from 'firebase-functions';
import { JOBS_COLLECTION, jobQueueEntryDoc } from '../core/firestore-paths.js.js';


const TERMINAL_STATUSES: Job['status'][] = ['SUCCESS', 'FAILED', 'CANCELLED', 'DEAD'];

/**
 * This Firestore-triggered function watches for jobs entering a terminal state
 * and cleans up their corresponding entry in the jobQueue.
 */
export const cleanupTerminalJobs = functions.firestore
  .document(`${JOBS_COLLECTION}/{jobId}`)
  .onUpdate(async (change, context) => {
    const { jobId } = context.params;
    const before = change.before.data() as Job;
    const after = change.after.data() as Job;

    const beforeIsTerminal = TERMINAL_STATUSES.includes(before.status);
    const afterIsTerminal = TERMINAL_STATUSES.includes(after.status);

    // --- Trigger Condition ---
    // Only act if the job has *entered* a terminal state.
    if (beforeIsTerminal || !afterIsTerminal) {
      return;
    }

    console.log(`Job ${jobId} entered terminal state '${after.status}'. Cleaning up queue entry.`);

    try {
      const queueRef = jobQueueEntryDoc(jobId);
      await queueRef.delete();
      console.log(`Successfully deleted queue entry for job ${jobId}.`);
    } catch (error) {
      // This error is generally safe to ignore, as it likely means the document
      // was already deleted (e.g., by handleJobFailure).
      console.warn(`Could not delete queue entry for job ${jobId}, it may have already been removed.`, error);
    }
  });

