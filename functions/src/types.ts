export type JobStatus =
  | "queued"
  | "scheduled"
  | "leased"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "deadletter";

export type JobDoc = {
  type: string;
  status: JobStatus;
  payload: any;
  createdAt: any;
  createdBy: string | null;
  updatedAt: any;

  scheduledFor?: any | null;
  priority: number;

  attempts: number;
  maxAttempts: number;

  backoffSeconds: number;
  nextAttemptAt: any;

  leaseOwner?: string | null;
  leaseExpiresAt?: any | null;

  progress: number;
  message?: string | null;

  result?: any | null;
  error?: any | null;

  idempotencyKey?: string;

  cancelledAt?: any | null;
  cancelReason?: string | null;

  tags?: string[];
  version: number;
};
