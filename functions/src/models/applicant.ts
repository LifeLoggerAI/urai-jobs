import { Timestamp } from 'firebase-admin/firestore';

export interface Applicant {
  primaryEmail: string;
  name: string;
  phone?: string;
  links?: {
    portfolio?: string;
    linkedin?: string;
    github?: string;
    other?: string[];
  };
  source: {
    type: 'direct' | 'referral' | 'waitlist';
    refCode?: string;
    campaign?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}
