import * as admin from "firebase-admin";
import { Job } from "./types/jobs";

const db = admin.firestore();

export const lockJob = async (job: Job, workerId: string): Promise<Job | null> => {
  const jobRef = db.collection("jobs").doc(job.jobId);

  const lockedJob = await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      return null;
    }

    const currentJob = jobDoc.data() as Job;

    if (currentJob.status !== "QUEUED") {
      return null;
    }

    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + 5);

    const updatedJob: Partial<Job> = {
      status: "RUNNING",
      lockedBy: workerId,
      lockedUntil: lockedUntil,
    };

    transaction.update(jobRef, updatedJob);

    return { ...currentJob, ...updatedJob };
  });

  return lockedJob;
};

export const heartbeatJob = async (job: Job, workerId: string): Promise<Date | null> => {
  const jobRef = db.collection("jobs").doc(job.jobId);

  const lockedUntil = await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      return null;
    }

    const currentJob = jobDoc.data() as Job;

    if (currentJob.lockedBy !== workerId) {
      return null;
    }

    const newLockedUntil = new Date();
    newLockedUntil.setMinutes(newLockedUntil.getMinutes() + 5);

    transaction.update(jobRef, { lockedUntil: newLockedUntil });

    return newLockedUntil;
  });

  return lockedUntil;
};

export const releaseJob = async (job: Job, workerId: string) => {
  const jobRef = db.collection("jobs").doc(job.jobId);

  await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      return;
    }

    const currentJob = jobDoc.data() as Job;

    if (currentJob.lockedBy !== workerId) {
      return;
    }

    transaction.update(jobRef, { status: "QUEUED", lockedBy: null, lockedUntil: null });
  });
};
