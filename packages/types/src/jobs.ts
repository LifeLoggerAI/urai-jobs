import { Timestamp } from 'firebase/firestore';

export type JobStatus = 'active' | 'paused' | 'archived';
export type IdempotencyPolicy = 'byParamsHash' | 'manual';

export interface Job {
  name: string;
  description: string;
  status: JobStatus;
  priority: number;
  schedule: string | null;
  handler: 'assetFactoryRender' | 'analyticsBackfill' | 'noop';
  inputSchemaVersion: number;
  defaultParams: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  tags: string[];
  idempotencyPolicy: IdempotencyPolicy;
  leaseSeconds: number;
  maxRetries: number;
  timeoutSeconds: number;
}

export type JobRunStatus = 'queued' | 'leased' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface JobRun {
  jobId: string;
  status: JobRunStatus;
  queuedAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
  attempt: number;
  params: Record<string, any>;
  paramsHash: string;
  idempotencyKey: string;
  leaseExpiresAt: Timestamp | null;
  workerId: string | null;
  error: Record<string, any> | null;
  metrics: {
    durationMs: number;
    costEstimate: number;
  };
  logRef: string;
  artifactRefs: string[];
}
