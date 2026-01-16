
import { Timestamp } from 'firebase-admin/firestore';

export interface Job {
    type: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DEAD' | 'CANCELED';
    priority: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    runAfter: Timestamp;
    attempts: number;
    maxAttempts: number;
    leaseOwner: string | null;
    leaseExpiresAt: Timestamp | null;
    lastError: { message: string; stack?: string; } | null;
    payload: any;
    idempotencyKey?: string;
}
