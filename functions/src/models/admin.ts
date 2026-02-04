import { Timestamp } from 'firebase-admin/firestore';

export interface Admin {
  role: 'owner' | 'admin' | 'reviewer';
  createdAt: Timestamp;
}
