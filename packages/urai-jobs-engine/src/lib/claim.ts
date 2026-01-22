import { firestore } from 'firebase-admin';
import { Job, JobStatus } from '../types/jobs';

const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function claimJob(db: firestore.Firestore, jobRef: firestore.DocumentReference): Promise<Job<any> | null> {
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(jobRef);
    if (!doc.exists) {
      return null;
    }

    const job = doc.data() as Job<any>;

    if (job.status !== 'queued' && job.status !== 'failed') {
      return null;
    }

    if (job.leaseUntil && job.leaseUntil.toMillis() > Date.now()) {
        return null;
    }

    const leaseUntil = new Date(Date.now() + LEASE_DURATION_MS);
    transaction.update(jobRef, { status: 'leased', leaseUntil });

    return { ...job, status: 'leased', leaseUntil };
  });
}

export async function releaseJob(db: firestore.Firestore, jobRef: firestore.DocumentReference, status: JobStatus, result?: any): Promise<void> {
    await jobRef.update({ status, result, leaseUntil: null });
}
