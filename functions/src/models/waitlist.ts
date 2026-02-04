import { Timestamp } from 'firebase-admin/firestore';

export interface Waitlist {
  email: string;
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}
