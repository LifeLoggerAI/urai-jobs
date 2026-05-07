export const JOB_STATUSES = [
  'PENDING',
  'LEASED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'DEAD',
  'CANCELLED',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: JobStatus[] = ['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'];
export const RETRYABLE_JOB_STATUSES: JobStatus[] = ['FAILED', 'DEAD'];
export const CANCELLABLE_JOB_STATUSES: JobStatus[] = ['PENDING', 'LEASED', 'RUNNING'];

export function normalizeJobStatus(status: unknown): JobStatus | undefined {
  if (typeof status !== 'string') return undefined;
  const normalized = status.toUpperCase();
  const legacyMap: Record<string, JobStatus> = {
    QUEUED: 'PENDING',
    RETRY_NEEDED: 'FAILED',
    SUCCEEDED: 'SUCCESS',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
  };
  const candidate = legacyMap[normalized] ?? normalized;
  return (JOB_STATUSES as readonly string[]).includes(candidate) ? (candidate as JobStatus) : undefined;
}

export function isTerminalJobStatus(status: unknown): boolean {
  const normalized = normalizeJobStatus(status);
  return normalized ? TERMINAL_JOB_STATUSES.includes(normalized) : false;
}

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
  leaseExpiresAt?: string;
  expiresAt?: { toMillis?: () => number } | string;
  heartbeatAt?: { toMillis?: () => number } | string;
}

export interface Job {
  jobId: string;
  jobType: string;
  type: string;
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
  result?: unknown;
  error?: unknown;
  logs?: unknown[];
  attempts?: number;
  maxAttempts?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
}

export interface JobQueueEntry {
  jobId: string;
  jobType: string;
  status: JobStatus;
  leaseId?: string;
  leaseToken?: string;
  availableAt?: unknown;
  attemptCount?: number;
  priority?: number;
  leaseOwner?: string | null;
  leaseExpiresAt?: unknown;
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
  role?: 'user' | 'admin' | 'operator' | string;
  roles?: string[];
}
