import * as admin from 'firebase-admin';
import { Job, JobStatus } from '../types/jobs';
export declare function claimJob(firestore: admin.firestore.Firestore, jobRef: admin.firestore.DocumentReference): Promise<Job | null>;
export declare function releaseJob(firestore: admin.firestore.Firestore, jobRef: admin.firestore.DocumentReference, status: JobStatus, updates?: Partial<Job>): Promise<void>;
