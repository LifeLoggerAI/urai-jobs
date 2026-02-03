import { firestore } from 'firebase-admin';
import { Job, JobSchema, JobStatus, Lease } from './types/jobs';

const db = firestore();

const jobsCollection = db.collection('jobs');

export const getJob = async (jobId: string): Promise<Job | null> => {
  const doc = await jobsCollection.doc(jobId).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  return JobSchema.parse(data);
};

export const createJob = async (job: Job): Promise<void> => {
  await jobsCollection.doc(job.jobId).set(job);
};

export const updateJob = async (
  jobId: string,
  updates: Partial<Job>
): Promise<void> => {
  await jobsCollection.doc(jobId).update(updates);
};

export const lockJob = async (
  jobId: string,
  workerId: string,
  leaseMs: number
): Promise<Job | null> => {
  return db.runTransaction(async (transaction) => {
    const jobRef = jobsCollection.doc(jobId);
    const doc = await transaction.get(jobRef);

    if (!doc.exists) {
      return null;
    }

    const job = JobSchema.parse(doc.data());

    if (job.status === 'QUEUED' || (job.status === 'RUNNING' && job.lease?.lockedUntil && job.lease.lockedUntil.toMillis() < Date.now())) {
      const lease: Lease = {
        lockedBy: workerId,
        lockedAt: firestore.Timestamp.now(),
        lockedUntil: firestore.Timestamp.fromMillis(Date.now() + leaseMs),
      };

      transaction.update(jobRef, { status: 'RUNNING', lease });

      return { ...job, status: 'RUNNING', lease };
    } else {
      return null;
    }
  });
};

export const heartbeatJob = async (
    jobId: string,
    workerId: string,
    leaseMs: number
  ): Promise<firestore.Timestamp | null> => {
    return db.runTransaction(async (transaction) => {
      const jobRef = jobsCollection.doc(jobId);
      const doc = await transaction.get(jobRef);
  
      if (!doc.exists) {
        return null;
      }
  
      const job = JobSchema.parse(doc.data());
  
      if (job.lease?.lockedBy === workerId) {
        const newLockedUntil = firestore.Timestamp.fromMillis(Date.now() + leaseMs);
        transaction.update(jobRef, { 'lease.lockedUntil': newLockedUntil });
        return newLockedUntil;
      } else {
        return null;
      }
    });
  };
  
  export const releaseJob = async (
    jobId: string,
    workerId: string
  ): Promise<void> => {
    await db.runTransaction(async (transaction) => {
      const jobRef = jobsCollection.doc(jobId);
      const doc = await transaction.get(jobRef);
  
      if (doc.exists) {
        const job = JobSchema.parse(doc.data());
  
        if (job.lease?.lockedBy === workerId) {
          transaction.update(jobRef, { lease: firestore.FieldValue.delete() });
        }
      }
    });
  };
  
  export const pollJobs = async (
    limit: number,
    kinds: string[]
  ): Promise<Job[]> => {
    let query: firestore.Query = jobsCollection;
  
    query = query.where('status', '==', 'QUEUED');

    if (kinds.length > 0) {
        query = query.where('kind', 'in', kinds);
    }
  
    const snapshot = await query.limit(limit).get();
  
    return snapshot.docs.map((doc) => JobSchema.parse(doc.data()));
  };