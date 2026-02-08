import { FieldValue } from "firebase-admin/firestore";

export type ApplicationStatus =
  | "NEW"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";

export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased, denormalized
  status: ApplicationStatus;
  answers: Record<string, string>;
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags?: string[];
  notesCount?: number;
  submittedAt: FieldValue;
  updatedAt: FieldValue;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: FieldValue;
  };
}
