import { Timestamp } from 'firebase-admin/firestore';

export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // denormalized for lookups
  status: 'NEW' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
  answers: { [key: string]: string };
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags: string[];
  notesCount: number;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: Timestamp;
  };
}
