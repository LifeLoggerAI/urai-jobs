
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {v4 as uuidv4} from "uuid";
import {Job, JobRun, Config, Handler} from "./types";
import {handlers} from "./handlers";

const db = admin.firestore();
const workerId = uuidv4();

// #############################################################################
// Scheduled Job Tick Function
// #############################################################################

export const jobTick = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
  const traceId = context.eventId || uuidv4();
  functions.logger.info(`Job tick started. Worker ID: ${workerId}`, {traceId});

  try {
    // 1. Get configuration
    const configSnap = await db.collection("config").doc("jobs").get();
    const config: Partial<Config> = configSnap.data() || {};
    const leaseSeconds = config.workerLeaseSeconds || 60;
    const batchSize = config.tickBatchSize || 10;

    // 2. Query for due jobs
    const now = Timestamp.now();
    const dueJobsQuery = db.collection("jobs")
        .where("status", "==", "queued")
        .where("nextRunAt", "<=", now)
        .orderBy("nextRunAt", "asc")
        .orderBy("priority", "desc")
        .limit(batchSize);

    const dueJobsSnap = await dueJobsQuery.get();

    if (dueJobsSnap.empty) {
      functions.logger.info("No due jobs found.", {traceId});
      return;
    }

    functions.logger.info(`Found ${dueJobsSnap.size} due jobs.`, {traceId, count: dueJobsSnap.size});

    // 3. Process each job
    const processingPromises = dueJobsSnap.docs.map((jobDoc) => 
        processJob(jobDoc.id, jobDoc.data() as Job, config, traceId)
    );
    await Promise.allSettled(processingPromises);

  } catch (error) {
    functions.logger.error("Error in job tick scheduler", {error, traceId});
  }
});

// #############################################################################
// Job Processing Logic
// #############################################################################

async function processJob(jobId: string, job: Job, config: Partial<Config>, traceId: string): Promise<void> {
  const jobRef = db.collection("jobs").doc(jobId);

  // 1. Claim the job in a transaction
  const leaseSeconds = config.workerLeaseSeconds || 60;
  const lockExpiresAt = Timestamp.fromMillis(Timestamp.now().toMillis() + leaseSeconds * 1000);

  try {
    const claimed = await db.runTransaction(async (tx) => {
      const freshJobSnap = await tx.get(jobRef);
      if (!freshJobSnap.exists) {
        return false;
      }

      const freshJob = freshJobSnap.data() as Job;
      if (freshJob.status !== "queued") {
        functions.logger.warn("Job was not in queued state, skipping.", {jobId, status: freshJob.status, traceId});
        return false;
      }

      if (freshJob.lock && freshJob.lock.expiresAt.toMillis() > Timestamp.now().toMillis()) {
        functions.logger.warn("Job is locked by another worker, skipping.", {jobId, lock: freshJob.lock, traceId});
        return false;
      }

      tx.update(jobRef, {
        status: "running",
        lock: {owner: workerId, expiresAt: lockExpiresAt},
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!claimed) {
      return;
    }

  } catch (error) {
    functions.logger.error("Failed to claim job.", {error, jobId, traceId});
    return; // Another worker likely claimed it, so we stop.
  }

  // 2. Execute the job handler
  const runId = db.collection("jobRuns").doc().id;
  const runRef = db.collection("jobRuns").doc(runId);
  const runStartTime = Timestamp.now();
  let outcome: JobRun["outcome"] = "failed";
  let result: unknown = null;
  let handlerError: { message: string, stack?: string } | undefined;

  try {
    functions.logger.info(`Executing job handler: ${job.type}`, {jobId, type: job.type, traceId});
    const handler: Handler | undefined = handlers[job.type as keyof typeof handlers];

    if (!handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Execute with a timeout
    const timeout = job.timeoutSeconds || 30;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Job execution timed out")), timeout * 1000));
    result = await Promise.race([handler(job.payload, job), timeoutPromise]);
    outcome = "succeeded";

  } catch (error) {
    const err = error as Error;
    functions.logger.error(`Job handler failed: ${job.type}`, {error: err, jobId, traceId});
    handlerError = {message: err.message, stack: err.stack};
  }

  const runEndTime = Timestamp.now();
  const durationMs = runEndTime.toMillis() - runStartTime.toMillis();

  // 3. Record the job run
  const jobRun: JobRun = {
    jobId,
    startedAt: runStartTime,
    endedAt: runEndTime,
    workerId,
    attempt: (job.attempts || 0) + 1,
    outcome,
    error: handlerError,
    metrics: {durationMs},
  };
  await runRef.set(jobRun);

  // 4. Update the job status based on the outcome
  try {
    if (outcome === "succeeded") {
      await jobRef.update({
        status: "succeeded",
        result,
        error: FieldValue.delete(),
        lock: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      functions.logger.info("Job completed successfully.", {jobId, traceId});
    } else {
      const maxAttempts = job.maxAttempts || config.defaultMaxAttempts || 5;
      if (((job.attempts || 0) + 1) >= maxAttempts) {
        await jobRef.update({
          status: "dead",
          error: {...handlerError, at: FieldValue.serverTimestamp()},
          lock: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        functions.logger.warn("Job moved to dead-letter queue.", {jobId, traceId});
      } else {
        const {baseSeconds = 15, maxSeconds = 3600, jitter = 0.2} = config.backoff || {};
        const attempt = (job.attempts || 0) + 1;
        const backoff = Math.round(Math.min(maxSeconds * 1000, Math.pow(2, attempt) * baseSeconds * 1000) * (1 + (Math.random() - 0.5) * jitter));
        const nextRunAt = Timestamp.fromMillis(Timestamp.now().toMillis() + backoff);
        await jobRef.update({
          status: "queued",
          nextRunAt,
          error: {...handlerError, at: FieldValue.serverTimestamp()},
          lock: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        functions.logger.info(`Job scheduled for retry in ${backoff / 1000}s.`, {jobId, traceId});
      }
    }
  } catch (error) {
    functions.logger.error("Failed to update final job status.", {error, jobId, outcome, traceId});
  }
}
