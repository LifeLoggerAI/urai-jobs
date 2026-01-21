import { Timestamp } from 'firebase-admin/firestore';

export interface Application {
  id?: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string;
  status: 'NEW' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
  answers: Record<string, string>;
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags?: string[];
  notesCount?: number;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: Timestamp;
  };
}
