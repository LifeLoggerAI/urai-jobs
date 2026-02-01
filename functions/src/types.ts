import { firestore } from 'firebase-admin';

export interface Job {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  priority: number;
  schedule: string | null;
  handler: "assetFactoryRender" | "analyticsBackfill" | "noop";
  inputSchemaVersion: number;
  defaultParams: Record<string, any>;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
  createdBy: string;
  tags: string[];
  idempotencyPolicy: "byParamsHash" | "manual";
  leaseSeconds: number;
  maxRetries: number;
  timeoutSeconds: number;
}

export interface JobRun {
  id: string;
  jobId: string;
  status: "queued" | "leased" | "running" | "succeeded" | "failed" | "canceled";
  queuedAt: firestore.Timestamp;
  startedAt: firestore.Timestamp | null;
  finishedAt: firestore.Timestamp | null;
  attempt: number;
  params: Record<string, any>;
  paramsHash: string;
  idempotencyKey: string;
  leaseExpiresAt: firestore.Timestamp | null;
  workerId: string | null;
  error: Record<string, any> | null;
  metrics: {
    durationMs: number;
    costEstimate: number;
  } | null;
  logRef: string;
  artifactRefs: string[];
}

export interface JobRunLog {
  id: string;
  runId: string;
  timestamp: firestore.Timestamp;
  message: string;
  level: "info" | "warn" | "error";
}

export interface JobArtifact {
  id: string;
  runId: string;
  storagePath: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface JobDeadletter {
  id: string;
  run: JobRun;
  reason: string;
  createdAt: firestore.Timestamp;
}

export interface JobAudit {
  id: string;
  timestamp: firestore.Timestamp;
  actorId: string;
  action: string;
  target: {
    type: string;
    id: string;
  };
  changes: Record<string, any>;
}

export interface User {
  uid: string;
  email: string;
  role: "admin" | "operator" | "viewer";
}
