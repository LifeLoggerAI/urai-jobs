
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { JobSchema, JobStatus } from "./types";
import { recordAuditLog } from "./audit";

const db = admin.firestore();

export const executor = functions.firestore.document('jobs/{jobId}').onUpdate(async (change, context) => {
  const jobData = change.after.data();
  const previousJobData = change.before.data();
  const jobId = context.params.jobId;

  // Only execute when status changes to 'processing'
  if (jobData.status !== 'processing' || previousJobData.status === 'processing') {
    return;
  }

  const jobRef = db.collection('jobs').doc(jobId);

  await recordAuditLog(jobId, `Job execution started.`, { from: previousJobData.status, to: jobData.status });

  // --- Idempotency Check ---
  if (jobData.idempotencyKey) {
    const idempotencyRef = db.collection('idempotency_keys').doc(jobData.idempotencyKey);

    try {
      await db.runTransaction(async (transaction) => {
        const idemDoc = await transaction.get(idempotencyRef);
        if (idemDoc.exists) {
          const originalJobId = idemDoc.data()?.jobId;
          logger.warn(`Idempotency key ${jobData.idempotencyKey} already processed for job ${originalJobId}. Marking duplicate job ${jobId} as completed.`);
          transaction.update(jobRef, { 
            status: 'completed', 
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            notes: `Duplicate of job ${originalJobId}`
          });
          // Short-circuit execution if it's a duplicate
          throw new Error('DUPLICATE_JOB'); 
        } else {
          transaction.create(idempotencyRef, { 
            jobId: jobId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    } catch (error: any) {
      if (error.message === 'DUPLICATE_JOB') {
        await recordAuditLog(jobId, `Job identified as a duplicate.`, { from: jobData.status, to: 'completed' });
        return; // Stop execution for duplicate
      }
      logger.error(`Error during idempotency check for job ${jobId}:`, error);
      // Optionally fail the job if the check itself fails
      await jobRef.update({ status: 'failed', error: 'Idempotency check failed.' });
      return;
    }
  }

  // --- Job Validation ---
  const validationResult = JobSchema.safeParse(jobData);
  if (!validationResult.success) {
    logger.error(`Job ${jobId} failed validation`, validationResult.error);
    await jobRef.update({
      status: 'failed',
      error: validationResult.error.flatten(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await recordAuditLog(jobId, `Job validation failed.`, { from: jobData.status, to: 'failed' });
    return;
  }

  const job = validationResult.data;

  // --- Job Execution Logic ---
  try {
    logger.log(`Executing job ${jobId} of type ${job.jobType}`);

    // Increment retry counter in a transaction to be safe
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) return;
        const currentRetries = jobDoc.data()?.retries || 0;
        transaction.update(jobRef, { retries: currentRetries + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });

    // TODO: Replace with actual long-running job logic
    switch (job.jobType) {
      case 'render':
        logger.info(`Rendering video from ${job.payload.sourceUrl}`);
        break;
      case 'clip':
        logger.info(`Clipping video: ${job.payload.sourceUrl}`);
        break;
      case 'analyze':
        logger.info(`Analyzing video: ${job.payload.sourceUrl}`);
        break;
      case 'notify':
        logger.info(`Sending notification to ${job.payload.userId}`);
        break;
    }

    // --- Completion ---
    await jobRef.update({
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await recordAuditLog(jobId, `Job execution completed successfully.`, { from: job.status, to: 'completed' });

  } catch (error: any) {
    logger.error(`Job ${jobId} failed execution`, error);
    await jobRef.update({
      status: 'failed',
      error: { message: error.message || 'Unknown execution error' },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await recordAuditLog(jobId, `Job execution failed.`, { from: job.status, to: 'failed' });
  }
});

