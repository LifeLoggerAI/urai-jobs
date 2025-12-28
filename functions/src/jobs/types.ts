export type JobType = 
  | "email.send"
  | "export.generate"
  | "analytics.rollup"
  | "webhook.dispatch";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "deadletter";

export interface Job {
  type: JobType;
  status: JobStatus;
  payload?: Record<string, any>;
  payloadRef?: string;
  priority: number;      // lower = sooner
  attempt: number;
  maxAttempts: number;
  scheduledFor?: Date | null;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}