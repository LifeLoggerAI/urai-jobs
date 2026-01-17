
import * as admin from "firebase-admin";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";

export interface Job {
  type: string;
  status: JobStatus;
  priority: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  runAfter: admin.firestore.Timestamp;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: admin.firestore.Timestamp | null;
  lastError: {
    message: string;
    code?: string;
    stack?: string;
    at?: admin.firestore.Timestamp;
  } | null;
  payload: object;
  idempotencyKey?: string;
}

export interface JobRun {
  startedAt: admin.firestore.Timestamp;
  finishedAt: admin.firestore.Timestamp | null;
  workerId: string;
  outcome: "SUCCEEDED" | "FAILED" | "CANCELED";
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  durationMs: number | null;
}
