
import { z } from 'zod';

export const JobSchema = z.object({
  ownerUid: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED']),
  priority: z.number().int(),
  type: z.string(),
  input: z.object({}).passthrough(),
  output: z.object({}).passthrough().nullable(),
  attempts: z.number().int(),
  maxAttempts: z.number().int().default(3),
  createdAt: z.date(),
  updatedAt: z.date(),
  leaseExpiresAt: z.date().nullable(),
  idempotencyKey: z.string(),
  lastError: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).nullable(),
});

export const JobRunSchema = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED']),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  workerId: z.string().nullable(),
  logs: z.array(z.string()),
  metrics: z.object({}).passthrough(),
});

export const JobEventSchema = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  type: z.string(),
  ts: z.date(),
  payload: z.object({}).passthrough(),
});

export const ArtifactSchema = z.object({
  jobId: z.string(),
  ownerUid: z.string(),
  kind: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  bytes: z.number(),
  createdAt: z.date(),
  meta: z.object({}).passthrough(),
});
