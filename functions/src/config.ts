export interface Job {
  id?: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "dead";
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    uid?: string;
    service?: string;
  };
  payload: any;
  result?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
    at: Date;
  };
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date;
  timeoutSeconds?: number;
  lock?: {
    owner: string;
    expiresAt: Date;
  };
  idempotencyKey?: string;
  traceId?: string;
}

export interface JobRun {
  id?: string;
  jobId: string;
  startedAt: Date;
  endedAt: Date;
  workerId: string;
  outcome: "succeeded" | "failed" | "canceled";
  attempt: number;
  error?: any;
  metrics?: {
    durationMs: number;
  };
}

export interface AuditLog {
  id?: string;
  at: Date;
  actorUid?: string;
  action: string;
  target: string;
  meta: any;
}

export interface Config {
    sealedAdminBootstrap: boolean;
    workerLeaseSeconds: number;
    tickBatchSize: number;
    defaultMaxAttempts: number;
    backoff: {
        baseSeconds: number;
        maxSeconds: number;
        jitter: number;
    };
    allowHttpFetch: boolean;
    httpFetchAllowlist: string[];
    jobRunRetentionDays: number;
}
