import { Timestamp } from 'firebase-admin/firestore';

export interface Admin {
  id?: string;
  role: 'owner' | 'admin' | 'reviewer';
  createdAt: Timestamp;
}
