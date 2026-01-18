
import * as admin from "firebase-admin";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";

export interface Job {
  id?: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, any>;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  scheduledFor: admin.firestore.Timestamp | null;
  runAfter: admin.firestore.Timestamp | null;
  attempts: number;
  maxAttempts: number;
  lastError: {
    message: string;
    code?: string;
    stack?: string;
    at: admin.firestore.Timestamp;
  } | null;
  lease: {
    ownerId: string | null;
    leaseId: string | null;
    leasedAt: admin.firestore.Timestamp | null;
    expiresAt: admin.firestore.Timestamp | null;
    heartbeatAt: admin.firestore.Timestamp | null;
  };
  idempotencyKey: string | null;
  dedupeWindowSec: number | null;
}

export interface JobRun {
  id?: string;
  startedAt: admin.firestore.Timestamp;
  finishedAt: admin.firestore.Timestamp | null;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  attempt: number;
  leaseId: string;
  logs: any[];
  error: {
    message: string;
    code?: string;
    stack?: string;
  } | null;
  durationMs: number | null;
}

export interface JobsDailyMetrics {
  enqueued: number;
  started: number;
  succeeded: number;
  failed: number;
  dead: number;
  canceled: number;
  avgDurationMs: number;
  byType: Record<string, {
    enqueued: number;
    started: number;
    succeeded: number;
    failed: number;
    dead: number;
    canceled: number;
  }>;
  updatedAt: admin.firestore.Timestamp;
}
