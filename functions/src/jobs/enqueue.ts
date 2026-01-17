
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Job } from "./types";

const MAX_PAYLOAD_SIZE_BYTES = 10 * 1024; // 10 KB

/**
 * Enqueues a new job. This is an admin-only function.
 *
 * @param data The job data.
 * @param context The callable function context.
 * @returns The ID of the newly created job.
 */
export const enqueueJob = functions.https.onCall(async (data, context) => {
    // 1. Authentication & Authorization
    if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "You must be an admin to enqueue jobs."
        );
    }

    const { type, payload, idempotencyKey, priority = 0, maxAttempts = 5 } = data;

    // 2. Input Validation
    if (!type || typeof type !== "string") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "'type' must be a non-empty string."
        );
    }
    if (!payload) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "'payload' must be provided."
        );
    }
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > MAX_PAYLOAD_SIZE_BYTES) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            `Payload size (${payloadSize} bytes) exceeds the maximum of ${MAX_PAYLOAD_SIZE_BYTES} bytes.`
        );
    }

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const jobsCollection = db.collection("jobs");

    try {
        let jobId: string;

        if (idempotencyKey) {
            // 3. Idempotency Check within a Transaction
            jobId = await db.runTransaction(async (transaction) => {
                const idempotencyQuery = jobsCollection.where("idempotencyKey", "==", idempotencyKey).limit(1);
                const snapshot = await transaction.get(idempotencyQuery);

                if (!snapshot.empty) {
                    functions.logger.warn(`Job with idempotency key '${idempotencyKey}' already exists.`, { jobId: snapshot.docs[0].id });
                    return snapshot.docs[0].id;
                }

                const newJobRef = jobsCollection.doc();
                const jobData: Job = {
                    type,
                    payload,
                    status: "PENDING",
                    priority,
                    createdAt: now,
                    updatedAt: now,
                    runAfter: now,
                    attempts: 0,
                    maxAttempts,
                    leaseOwner: null,
                    leaseExpiresAt: null,
                    lastError: null,
                    idempotencyKey,
                };
                transaction.set(newJobRef, jobData);
                return newJobRef.id;
            });
        } else {
            // 4. Create a new job without idempotency check
            const newJobRef = jobsCollection.doc();
            const jobData: Job = {
                type,
                payload,
                status: "PENDING",
                priority,
                createdAt: now,
                updatedAt: now,
                runAfter: now,
                attempts: 0,
                maxAttempts,
                leaseOwner: null,
                leaseExpiresAt: null,
                lastError: null,
            };
            await newJobRef.set(jobData);
            jobId = newJobRef.id;
        }

        functions.logger.log(`Successfully enqueued job of type '${type}'`, { jobId });
        return { jobId };

    } catch (error) {
        functions.logger.error("Error enqueuing job:", error);
        throw new functions.https.HttpsError(
            "internal",
            "An unexpected error occurred while enqueuing the job."
        );
    }
});
