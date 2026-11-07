import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { checkedCurrentJobCaller, boundJobMatchesCurrentOwnerScope } from "./currentJobCallerAuthority.js";

if (getApps().length === 0) initializeApp();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export const cancelJob = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const jobId = String(asRecord(request.data).jobId || "").trim();
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  const uid = String(asRecord(request.auth).uid || "");
  if (!uid) throw new HttpsError("unauthenticated", "Authenticated user ID is required.");
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const jobRef = db.collection("jobs").doc(jobId);
  const queueRef = db.collection("jobQueue").doc(jobId);
  const logRef = jobRef.collection("logs").doc();

  await db.runTransaction(async (transaction) => {
    const [userSnap, jobSnap] = await Promise.all([
      transaction.get(userRef), transaction.get(jobRef)
    ]);
    const caller = checkedCurrentJobCaller(request.auth, userSnap.exists ? userSnap.data() : null);
    if (!caller) throw new HttpsError("permission-denied", "Current user authority is unavailable.");

    if (!jobSnap.exists) {
      throw new HttpsError("not-found", `Job ${jobId} was not found.`);
    }

    const job = jobSnap.data() || {};
    const status = String(job.status || "");
    // Current tenant/org binding must match, not merely the owner UID.

    if (!caller.operator && !boundJobMatchesCurrentOwnerScope(job, userSnap.data(), caller.uid)) {
      throw new HttpsError("permission-denied", "You do not have access to cancel this job.");
    }

    if (!["PENDING", "LEASED", "RUNNING"].includes(status)) {
      throw new HttpsError("failed-precondition", `Job ${jobId} cannot be cancelled from status ${status}.`);
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
    // Keep the audit log in the same transaction; a late post-delete log is unsafe.
    transaction.create(logRef, {
      level: "info",
      message: "Job cancelled from live admin callable.",
      createdAt: FieldValue.serverTimestamp(),
      source: "cancelJob"
    });
  });

  return { jobId, status: "CANCELLED" };
});
