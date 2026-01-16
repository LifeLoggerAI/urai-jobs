
import { https } from 'firebase-functions';
import { db } from '../lib/firebase';
import { Job } from './types';
import { serverTimestamp, Timestamp } from 'firebase-admin/firestore';

export const enqueue = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new https.HttpsError('unauthenticated', 'You must be authenticated to enqueue a job.');
    }

    const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
        throw new https.HttpsError('permission-denied', 'You must be an admin to enqueue a job.');
    }

    const { type, payload, priority = 0, maxAttempts = 3, idempotencyKey } = data;

    if (!type) {
        throw new https.HttpsError('invalid-argument', 'The function must be called with a "type" argument.');
    }

    if (idempotencyKey) {
        const existingJobs = await db.collection('jobs').where('idempotencyKey', '==', idempotencyKey).get();
        if (!existingJobs.empty) {
            return { jobId: existingJobs.docs[0].id };
        }
    }

    const now = Timestamp.now();
    const newJob: Job = {
        type,
        status: 'PENDING',
        priority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        runAfter: now,
        attempts: 0,
        maxAttempts,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        payload,
        idempotencyKey,
    };

    const jobRef = await db.collection('jobs').add(newJob);

    return { jobId: jobRef.id };
});
