
import * as admin from "firebase-admin";
import { https } from "firebase-functions";
import { Job } from "../types";

export const enqueueJob = https.onCall(async (data, context) => {
  if (!context.auth?.token?.admin) {
    throw new https.HttpsError(
      "permission-denied",
      "Must be an admin to enqueue jobs."
    );
  }

  const { type, payload, priority, maxAttempts, idempotencyKey } = data;

  if (!type || typeof type !== "string") {
    throw new https.HttpsError(
      "invalid-argument",
      "The function must be called with a valid 'type' string."
    );
  }
  if (JSON.stringify(payload).length > 10000) {
    throw new https.HttpsError("invalid-argument", "Payload is too large.");
  }

  const now = admin.firestore.Timestamp.now();
  const newJob: Job = {
    type,
    payload: payload || {},
    priority: priority || 0,
    maxAttempts: maxAttempts || 10,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    runAfter: now,
    attempts: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
    idempotencyKey: idempotencyKey || null,
  };

  const db = admin.firestore();

  if (idempotencyKey) {
    const jobWithKey = await db
      .collection("jobs")
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (!jobWithKey.empty) {
      console.log(
        `Job with idempotencyKey ${idempotencyKey} already exists. Skipping.`
      );
      return { jobId: jobWithKey.docs[0].id };
    }
  }

  const jobRef = await db.collection("jobs").add(newJob);
  console.log(`Enqueued job ${jobRef.id} of type ${type}`);

  return { jobId: jobRef.id };
});
