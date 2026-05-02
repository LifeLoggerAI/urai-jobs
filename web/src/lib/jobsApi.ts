import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "retry_needed";

export type JobRecord = {
  id?: string;
  jobId?: string;
  jobType?: string;
  type?: string;
  ownerSubsystem?: string;
  ownerUid?: string;
  createdBy?: string;
  status?: JobStatus | string;
  attempts?: number;
  maxAttempts?: number;
  payload?: unknown;
  output?: unknown;
  error?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
};

export type JobLogRecord = {
  id?: string;
  jobId?: string;
  level?: string;
  message?: string;
  metadata?: unknown;
  createdAt?: unknown;
};

async function callFunction<TInput extends Record<string, unknown>, TOutput>(
  name: string,
  input: TInput
): Promise<TOutput> {
  const callable = httpsCallable<TInput, TOutput>(getFunctions(firebaseApp, "us-central1"), name);
  const result = await callable(input);
  return result.data;
}

export async function createJob(jobType: string, payload: unknown): Promise<{ jobId?: string; id?: string }> {
  return callFunction<{ jobType: string; payload: unknown }, { jobId?: string; id?: string }>("createJob", {
    jobType,
    payload
  });
}


const BACKEND_STATUS_BY_UI: Record<string, string> = {
  queued: "PENDING",
  running: "RUNNING",
  succeeded: "DONE",
  failed: "FAILED",
  retry_needed: "RETRY_NEEDED",
  cancelled: "CANCELLED",
};

function toBackendStatus(status?: JobStatus): string | undefined {
  if (!status) return undefined;
  return BACKEND_STATUS_BY_UI[String(status)] ?? String(status).toUpperCase();
}

export async function listJobs(status?: JobStatus, limit = 50): Promise<{ jobs: JobRecord[] }> {
  const input: { status?: JobStatus; limit: number } = { limit };
  if (status) input.status = status;
  return callFunction<typeof input, { jobs: JobRecord[] }>("listJobsV2", input);
}

export async function getJob(jobId: string): Promise<{ job: JobRecord; logs?: JobLogRecord[] }> {
  return callFunction<{ jobId: string }, { job: JobRecord; logs?: JobLogRecord[] }>("getJob", { jobId });
}

export async function retryJob(jobId: string): Promise<{ jobId: string; status: "queued" }> {
  return callFunction<{ jobId: string }, { jobId: string; status: "queued" }>("retryJobV2", { jobId });
}

export async function cancelJob(jobId: string): Promise<{ jobId: string; status: "cancelled" }> {
  return callFunction<{ jobId: string }, { jobId: string; status: "cancelled" }>("cancelJob", { jobId });
}

export async function listJobLogs(jobId: string, limit = 100): Promise<{ logs: JobLogRecord[] }> {
  return callFunction<{ jobId: string; limit: number }, { logs: JobLogRecord[] }>("listJobLogsV2", { jobId, limit });
}

export const jobsApi = {
  createJob,
  listJobs,
  getJob,
  retryJob,
  cancelJob,
  listJobLogs
};
