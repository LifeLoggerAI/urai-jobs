import { z } from 'zod';

export type JobStatus = 'queued' | 'leased' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'deadletter';

export type JobPayload<T extends z.ZodType<any, any>> = z.infer<T>;

export interface Job<T extends z.ZodType<any, any>> {
  id: string;
  type: string;
  status: JobStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  leaseUntil: Date | null;
  idempotencyKey: string;
  payload: JobPayload<T>;
  result?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
    meta?: any;
  };
  traceId: string;
  lockedBy: string | null;
}

export interface JobRun {
  jobId: string;
  type: string;
  attempt: number;
  startedAt: Date;
  endedAt: Date;
  status: JobStatus;
  metrics: {
    durationMs: number;
    coldStart: boolean;
  };
  error?: any;
  worker: string;
  traceId: string;
}

export interface JobType {
  enabled: boolean;
  concurrency: number;
  timeoutSec: number;
  rateLimitPerMin: number;
  defaultMaxAttempts: number;
}
