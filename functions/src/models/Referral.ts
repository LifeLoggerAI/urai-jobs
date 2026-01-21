import { Timestamp } from 'firebase-admin/firestore';

export interface Referral {
  id?: string;
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}
