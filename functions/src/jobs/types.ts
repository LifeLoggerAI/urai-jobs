import { z } from 'zod';
import { jobSchemas } from './schemas';

export const jobTypes = [
  'render_cinematic',
  'generate_clips',
  'transcribe_audio',
  'tag_entities',
  'build_life_map_snapshot',
  'send_digest_email',
  'export_scroll',
  'maintenance_compact_logs',
] as const;
export type JobType = typeof jobTypes[number];

export const jobStatuses = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'deadletter',
  'cancelled',
] as const;
export type JobStatus = typeof jobStatuses[number];

export interface Job<T extends JobType = JobType> {
  id: string;
  type: T;
  status: JobStatus;
  priority: number;
  scheduledAt: FirebaseFirestore.Timestamp;
  availableAt: FirebaseFirestore.Timestamp;
  attempts: number;
  maxAttempts: number;
  backoff: {
    strategy: 'exponential' | 'fixed';
    initialDelay: number;
    factor?: number;
  };
  idempotencyKey: string;
  payload: z.infer<typeof jobSchemas[T]>;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  ownerUid?: string;
  trace: {
    runIds: string[];
    lastRunId?: string;
  };
}

export interface JobRun {
  id: string;
  jobId: string;
  attemptNumber: number;
  workerId: string;
  startedAt: FirebaseFirestore.Timestamp;
  endedAt?: FirebaseFirestore.Timestamp;
  status: 'running' | 'succeeded' | 'failed';
  error?: {
    message: string;
    stack?: string;
    details?: unknown;
  };
  outputs?: unknown;
  timingMs?: number;
}

export interface JobEvent {
  id: string;
  jobId: string;
  runId?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: unknown;
  ts: FirebaseFirestore.Timestamp;
}
