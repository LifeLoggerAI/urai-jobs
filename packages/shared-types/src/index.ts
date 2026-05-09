export type JobStatus =
  | 'PENDING'
  | 'LEASED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'DEAD'
  | 'CANCELLED'
  | 'DONE';

export interface NarratorTtsPayload {
  text: string;
  locale?: string;
  voice?: string;
  voiceId?: string;
  speed?: number;
  format?: string;
  outputPrefix?: string;
}

export type NarratorTtsPayloadSchema = NarratorTtsPayload;

export interface JobExecutionMeta {
  attemptCount: number;
  maxAttempts: number;
  leaseToken?: string;
  startedAt?: string;
}

export interface JobLease {
  leaseId?: string;
  leaseToken?: string;
  ownerId?: string;
  workerId?: string;
  /**
   * Canonical lease expiry field. Firestore stores Date values as Timestamp
   * values, but shared types keep this provider-neutral for web/functions use.
   */
  expiresAt?: unknown;
  heartbeatAt?: unknown;
}

export interface Job {
  jobId: string;
  jobType?: string;
  type?: string;
  status: JobStatus;
  payload?: unknown;
  tenantId?: string;
  orgId?: string;
  ownerUid?: string;
  retryCount?: number;
  execution?: JobExecutionMeta;
  lease?: JobLease;
  ownerSubsystem?: string;
  createdBy?: string;
  output?: unknown;
  attempts?: number;
  maxAttempts?: number;
  error?: unknown;
  logs?: unknown[];
  createdAt?: unknown;
  updatedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
}

export interface JobQueueEntry {
  jobId: string;
  jobType?: string;
  status: string;
  lease?: JobLease;
  availableAt?: unknown;
  attemptCount?: number;
  priority?: number;
  leaseOwner?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JobLog {
  jobId?: string;
  level?: string;
  message: string;
}

export interface UserRole {
  roleId?: string;
  role?: string;
}

export interface JobDoc extends Job {}


export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role?: "user" | "admin" | "operator" | string;
  roles?: string[];
}
