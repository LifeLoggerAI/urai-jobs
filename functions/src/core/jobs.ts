import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { Job, JobQueueEntry, UserRole, JobLog, NarratorTtsPayloadSchema } from '../shared-types/index.js';
import { v4 as uuidv4 } from 'uuid';

if (getApps().length === 0) initializeApp();

const db = getFirestore();

export async function createJob(jobType: string, payload: any, ownerId: string): Promise<string> {
  const jobId = uuidv4();
  const job = {
    jobId,
    jobType,
    status: 'pending',
    payload,
    ownerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('jobs').doc(jobId).set(job);

  return jobId;
}
