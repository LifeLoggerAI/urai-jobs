import { Timestamp } from 'firebase/firestore';

export interface JobDeadletter {
  jobId: string;
  runId: string;
  reason: string;
  error: Record<string, any>;
  createdAt: Timestamp;
}

export interface JobAudit {
  jobId: string;
  action: 'create' | 'update' | 'pause' | 'resume' | 'enqueue' | 'cancel' | 'deploy';
  payload: Record<string, any>;
  createdAt: Timestamp;
  createdBy: string;
}
