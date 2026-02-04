import { Timestamp } from 'firebase-admin/firestore';

export interface Referral {
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}
