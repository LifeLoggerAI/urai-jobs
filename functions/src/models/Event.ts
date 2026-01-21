import { Timestamp } from 'firebase-admin/firestore';

export interface Event {
  id?: string;
  type: string;
  entityType: 'job' | 'applicant' | 'application' | 'referral' | 'waitlist' | 'page';
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}
