"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueJob = enqueueJob;
const firestore_1 = require("firebase-admin/firestore");
const functions_1 = require("firebase-admin/functions");
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const JobPayload = zod_1.z.object({
    type: zod_1.z.string(),
    payload: zod_1.z.any(),
    idempotencyKey: zod_1.z.string(),
    scheduledFor: zod_1.z.date().optional(),
});
async function enqueueJob(jobData) {
    const firestore = (0, firestore_1.getFirestore)();
    const { type, payload, idempotencyKey, scheduledFor } = JobPayload.parse(jobData);
    const traceId = (0, uuid_1.v4)();
    const job = {
        type,
        status: 'queued',
        priority: 0,
        attempt: 0,
        maxAttempts: 8,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        scheduledFor: scheduledFor || null,
        idempotencyKey,
        payload,
        traceId,
        lockedBy: null,
    };
    const jobId = await firestore.runTransaction(async (transaction) => {
        const jobQuery = firestore
            .collection('jobs')
            .where('idempotencyKey', '==', idempotencyKey);
        const jobSnapshot = await transaction.get(jobQuery);
        if (!jobSnapshot.empty) {
            console.log(`Job with idempotency key ${idempotencyKey} already exists.`);
            return jobSnapshot.docs[0].id;
        }
        const jobRef = firestore.collection('jobs').doc();
        transaction.set(jobRef, job);
        return jobRef.id;
    });
    if (jobId) {
        await (0, functions_1.getFunctions)().taskQueue('runJob').enqueue({ jobId });
    }
    return jobId;
}
