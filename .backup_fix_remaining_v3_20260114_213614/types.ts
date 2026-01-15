import * as admin from "firebase-admin";

export interface Job {
  handler: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  lease?: {
    owner: string;
    heartbeat: admin.firestore.Timestamp;
  };
}

// Existing types (if any) can be merged or kept here
export interface JobPublic {
  title: string;
  department: string;
  // ... other public fields
}


export type WorkerResult = {
  ok: boolean;
  result?: any;
  error?: any;
};
  result?: any;
  error?: any;
};
