import { Job, JobQueueEntry, UserRole, JobLog, NarratorTtsPayloadSchema } from '../shared-types.js.js.js.js';


import * as admin from 'firebase-admin';

import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();

export async function createJob(jobType: string, payload: any, ownerId: string): Promise<string> {
  const jobId = uuidv4();
  const job = {
    jobId,
    jobType,
    status: 'pending',
    payload,
    ownerId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('jobs').doc(jobId).set(job);

  return jobId;
}
