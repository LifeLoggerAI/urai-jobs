
import {z} from "zod";
import {Timestamp} from "firebase-admin/firestore";

// Shared Schemas
export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "dead",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const CreatedBySchema = z.object({
  uid: z.string().optional(),
  service: z.string().optional(),
});

export const ErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  stack: z.string().optional(),
  at: z.custom<Timestamp>(),
});

export const LockSchema = z.object({
  owner: z.string(),
  expiresAt: z.custom<Timestamp>(),
});

// /jobs/{jobId}
export const JobSchema = z.object({
  type: z.string(),
  status: JobStatusSchema,
  priority: z.number().default(0),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
  createdBy: CreatedBySchema,
  payload: z.record(z.unknown()),
  result: z.record(z.unknown()).optional(),
  error: ErrorSchema.optional(),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(5),
  nextRunAt: z.custom<Timestamp>(),
  timeoutSeconds: z.number().optional(),
  lock: LockSchema.optional(),
  idempotencyKey: z.string().optional(),
  traceId: z.string().optional(),
});
export type Job = z.infer<typeof JobSchema>;

// /jobRuns/{runId}
export const JobRunSchema = z.object({
  jobId: z.string(),
  startedAt: z.custom<Timestamp>(),
  endedAt: z.custom<Timestamp>().optional(),
  workerId: z.string(),
  outcome: z.enum(["succeeded", "failed", "canceled"]),
  attempt: z.number(),
acatena: z.record(z.unknown()).optional(),
  error: ErrorSchema.optional(),
  metrics: z.object({durationMs: z.number()}).optional(),
});
export type JobRun = z.infer<typeof JobRunSchema>;

// /auditLogs/{logId}
export const AuditLogSchema = z.object({
  at: z.custom<Timestamp>(),
  actorUid: z.string().optional(),
  action: zstring(),
  target: z.string(),
  meta: z.record(z.unknown()).optional(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// /config/jobs
export const ConfigSchema = z.object({
  sealedAdminBootstrap: z.boolean().default(false),
  workerLeaseSeconds: z.number().default(60),
  tickBatchSize: z.number().default(10),
  defaultMaxAttempts: z.number().default(5),
  backoff: z.object({
    baseSeconds: z.number().default(15),
    maxSeconds: z.number().default(3600),
    jitter: z.number().default(0.2),
  }),
  allowHttpFetch: z.boolean().default(false),
  httpFetchAllowlist: z.array(z.string()).default([]),
});
export type Config = z.infer<typeof ConfigSchema>;

// API Schemas
export const CreateJobRequestSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()),
  priority: z.number().optional(),
  maxAttempts: z.number().optional(),
  timeoutSeconds: z.number().optional(),
  idempotencyKey: z.string().optional(),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

// Handler type
export type Handler = (payload: unknown, job: Job) => Promise<unknown>;
