import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { currentJobActor } from "../core/currentJobActor.js";

if (getApps().length === 0) initializeApp();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export const cancelJob = onCall({ region: "us-central1" }, async (request) => {
  await currentJobActor(request);

  const jobId = String(asRecord(request.data).jobId || "").trim();
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  const db = getFirestore();
  const jobRef = db.collection("jobs").doc(jobId);
  const queueRef = db.collection("jobQueue").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const actor = await currentJobActor(request, transaction);
    const jobSnap = await transaction.get(jobRef);

    if (!jobSnap.exists) {
      throw new HttpsError("not-found", `Job ${jobId} was not found.`);
    }

    const job = jobSnap.data() || {};
    const status = String(job.status || "");
    const ownerUid = String(job.ownerUid || job.createdBy || "");

    if (!actor.operator && ownerUid !== actor.uid) {
      throw new HttpsError("permission-denied", "You do not have access to cancel this job.");
    }

    if (!["PENDING", "LEASED", "RUNNING"].includes(status)) {
      throw new HttpsError("failed-precondition", `Job ${jobId} cannot be cancelled from status ${status}.`);
    }
    const current = await currentJobActor(request, transaction);
    if (!current.operator && ownerUid !== current.uid) {
      throw new HttpsError("permission-denied", "You do not have current access to cancel this job.");
    }

    transaction.set(
      jobRef,
      {
        status: "CANCELLED",
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      queueRef,
      {
        status: "CANCELLED",
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await jobRef.collection("logs").add({
    level: "info",
    message: "Job cancelled from live admin callable.",
    createdAt: FieldValue.serverTimestamp(),
    source: "cancelJob"
  });

  return { jobId, status: "CANCELLED" };
});
