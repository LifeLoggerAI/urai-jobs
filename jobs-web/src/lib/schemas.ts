
import { z } from 'zod';

export const JobStatus = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
]);

export const Job = z.object({
  ownerUid: z.string(),
  status: JobStatus,
  priority: z.number().int().min(0).max(100),
  type: z.string(),
  input: z.record(z.any()),
  output: z.record(z.any()).nullable(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  leaseExpiresAt: z.date().nullable(),
  idempotencyKey: z.string(),
  lastError: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any(),
  }).nullable(),
});

export const JobRun = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  status: JobStatus,
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  workerId: z.string(),
  logs: z.array(z.string()),
  metrics: z.record(z.any()),
});

export const JobEvent = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  type: z.string(),
  ts: z.date(),
  payload: z.record(z.any()),
});

export const Artifact = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  kind: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  bytes: z.number().int(),
  createdAt: z.date(),
  meta: z.record(z.any()),
});
