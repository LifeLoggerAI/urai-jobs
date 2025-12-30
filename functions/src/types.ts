
import { Timestamp } from "firebase-admin/firestore";

export interface Job {
  id?: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "dead";
  priority: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy: { uid?: string; service?: string };
  payload: any;
  result?: any;
  error?: { message: string; code?: string; stack?: string; at: Timestamp };
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date | Timestamp;
  timeoutSeconds?: number;
  lock?: { owner: string; expiresAt: Timestamp };
  idempotencyKey?: string;
  traceId?: string;
}

export interface JobRun {
  id?: string;
  jobId: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  workerId: string;
  outcome: "succeeded" | "failed" | "canceled";
  attempt: number;
  error?: { message: string; code?: string; stack?: string };
  metrics?: { durationMs: number };
}

export interface AuditLog {
  id?: string;
  at: Timestamp;
  actorUid?: string;
  action: string;
  target: string;
  meta?: any;
}

export interface Config {
  sealedAdminBootstrap: boolean;
  workerLeaseSeconds: number;
  tickBatchSize: number;
  defaultMaxAttempts: number;
  backoff: { baseSeconds: number; maxSeconds: number; jitter: number };
  allowHttpFetch: boolean;
  httpFetchAllowlist: string[];
}
