import { https } from 'firebase-functions';
import { JobEngine } from 'urai-jobs-engine';

const engine = new JobEngine();

const ensureAdmin = (context: https.CallableContext) => {
  if (!context.auth?.token.admin) {
    throw new https.HttpsError('permission-denied', 'User must be an admin');
  }
};

export const enqueueJob = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.enqueue(data.type, data.payload, { idempotencyKey: data.idempotencyKey });
});

export const getJob = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.getJob(data.jobId);
});

export const cancelJob = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.cancelJob(data.jobId);
});

export const listJobs = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.listJobs(data.status, data.type);
});

export const requeueJob = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.requeueJob(data.jobId);
});

export const getJobRuns = https.onCall(async (data, context) => {
  ensureAdmin(context);
  return await engine.getJobRuns(data.jobId);
});
