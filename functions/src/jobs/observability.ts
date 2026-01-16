import * as admin from "firebase-admin";
import { firestore } from "../lib/firebase";
import { JOB_RUN_COLLECTION, JOB_STATS_COLLECTION } from "../config";
import { JobRun, JobStats } from "./types";

/**
 * Creates a new job run document.
 */
export const startJobRun = async (jobId: string, attempt: number, workerId: string): Promise<string> => {
    const now = admin.firestore.Timestamp.now();
    const newRun: JobRun = {
        jobId,
        attempt,
        workerId,
        startedAt: now,
        status: "STARTED",
    };
    const docRef = await firestore.collection(JOB_RUN_COLLECTION).add(newRun);
    return docRef.id;
};

/**
 * Updates a job run document when the job is finished.
 */
export const endJobRun = async (runId: string, status: "COMPLETED" | "FAILED", result?: Record<string, any>, error?: any) => {
    const runRef = firestore.collection(JOB_RUN_COLLECTION).doc(runId);
    await runRef.update({
        status,
        endedAt: admin.firestore.Timestamp.now(),
        result,
        error,
    });
};

/**
 * Updates the daily job statistics.
 */
export const updateJobStats = async (jobType: string, stats: Partial<JobStats>) => {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = firestore.collection(JOB_STATS_COLLECTION).doc("daily").collection(today).doc(jobType);

    await statsRef.set(stats, { merge: true });
};
