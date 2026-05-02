import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
const db = admin.firestore();
export async function createJob(jobType, payload, ownerId) {
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
