"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJob = void 0;
// URAI-JOBS: createJob Callable Function
// Version: 1.0.0
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const auth_1 = require("../core/auth");
const errors_1 = require("../core/errors");
const firestore_paths_1 = require("../core/firestore-paths");
// Input validation schema using Zod.
const CreateJobSchema = zod_1.z.object({
    jobType: zod_1.z.string().min(3, 'Job type must be at least 3 characters'),
    payload: zod_1.z.record(zod_1.z.any()),
    idempotencyKey: zod_1.z.string().optional(),
});
const handler = async (data, context) => {
    // Ensure context.auth is available, which withAuthenticatedRole guarantees.
    const uid = context.auth.uid;
    // 1. Validate Input
    const validationResult = CreateJobSchema.safeParse(data);
    if (!validationResult.success) {
        throw (0, errors_1.httpsError)('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
    }
    const { jobType, payload } = validationResult.data;
    // 2. Prepare Job and Queue Documents
    const db = (0, firestore_1.getFirestore)();
    const now = firestore_1.FieldValue.serverTimestamp();
    const newJob = {
        jobId,
        jobType,
        payload,
        status: 'PENDING',
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
    };
    const newQueueEntry = {
        jobId,
        jobType,
        status: 'PENDING',
        createdAt: now,
    };
    // 3. Create Documents in a Transaction
    try {
        await db.runTransaction(async (transaction) => {
            const jobRef = (0, firestore_paths_1.jobDoc)(jobId);
            const queueRef = (0, firestore_paths_1.jobQueueEntryDoc)(jobId);
            // TODO: Add idempotency check here if key is present.
            transaction.create(jobRef, newJob);
            transaction.create(queueRef, newQueueEntry);
        });
    }
    catch (error) {
        console.error('Error creating job in transaction:', error);
        throw (0, errors_1.httpsError)('internal', 'Failed to create job.', error.message);
    }
    return { jobId };
};
// Export the function wrapped in RBAC security.
// Only 'admin' and 'user' roles can create jobs.
exports.createJob = (0, auth_1.withAuthenticatedRole)(['admin', 'user'], handler);
