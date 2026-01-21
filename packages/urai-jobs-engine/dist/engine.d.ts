import * as admin from 'firebase-admin';
import { z } from 'zod';
import { Job, JobPayload, JobStatus } from './types/jobs';
export declare class JobEngine {
    private firestore;
    private tasksClient;
    enqueue<T extends z.ZodType<any, any>>(type: string, payload: JobPayload<T>, options: {
        idempotencyKey: string;
        scheduledFor?: Date;
    }): Promise<Job<T>>;
    getJob(jobId: string): Promise<Job<any>>;
    cancelJob(jobId: string): Promise<void>;
    runJob(jobId: string): Promise<void>;
    listJobs(status: JobStatus, type: string): Promise<admin.firestore.DocumentData[]>;
    requeueJob(jobId: string): Promise<void>;
    getJobRuns(jobId: string): Promise<admin.firestore.DocumentData[]>;
}
