import * as admin from "firebase-admin";

export type JobStatus =
  | "queued"
  | "claimed"
  | "rendering"
  | "uploaded"
  | "published"
  | "error";

export interface Artifact {
  type: string;
  format: string;
  gsUri: string;
  contentType: string;
  size: number;
  checksum: string;
  metadata: Record<string, any>;
  publicUrl?: string;
  signedUrl?: string;
}

export interface Job {
  jobId: string;
  ownerId: string;
  type: string;
  status: JobStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  renderSpec: {
    service: "asset-factory";
    endpoint: string;
    payload: Record<string, any>;
  };
  artifacts: Artifact[];
  publishPolicy: {
    visibility: "private" | "public" | "signed";
    signedUrlTtlSec?: number;
  };
  error?: {
    message: string;
    stack?: string;
    at: admin.firestore.Timestamp;
  };
}

export interface JobEvent {
  jobId: string;
  from: JobStatus | null;
  to: JobStatus;
  at: admin.firestore.Timestamp;
  source: "urai-jobs" | "asset-factory";
  detail?: Record<string, any>;
}
