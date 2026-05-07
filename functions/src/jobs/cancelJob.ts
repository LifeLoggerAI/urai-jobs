import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function hasOperatorAccess(auth: unknown): boolean {
  const authRecord = asRecord(auth);
  const token = asRecord(authRecord.token);
  const role = token.role;
  const roles = Array.isArray(token.roles) ? token.roles : [];

  return (
    role === "admin" ||
    role === "operator" ||
    token.uraiJobsAdmin === true ||
    roles.includes("admin") ||
    roles.includes("operator")
  );
}

function authUid(auth: unknown): string {
  return String(asRecord(auth).uid || "");
}

function normalizeStatus(value: unknown): string {
  const raw = String(value || "").trim();
  const aliases: Record<string, string> = {
    queued: "PENDING",
    pending: "PENDING",
    leased: "LEASED",
    running: "RUNNING",
    retry_needed: "FAILED",
    failed: "FAILED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
    succeeded: "SUCCESS",
    success: "SUCCESS",
    done: "DONE",
    dead: "DEAD"
  };
  return aliases[raw.toLowerCase()] || raw.toUpperCase();
}

export const cancelJob = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const jobId = String(asRecord(request.data).jobId || "").trim();
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  const db = getFirestore();
  const jobRef = db.collection("jobs").doc(jobId);
  const queueRef = db.collection("jobQueue").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const jobSnap = await transaction.get(jobRef);

    if (!jobSnap.exists) {
      throw new HttpsError("not-found", `Job ${jobId} was not found.`);
    }

    const job = jobSnap.data() || {};
    const status = normalizeStatus(job.status);
    const ownerUid = String(job.ownerUid || job.createdBy || "");

    if (!hasOperatorAccess(request.auth) && ownerUid !== authUid(request.auth)) {
      throw new HttpsError("permission-denied", "You do not have access to cancel this job.");
    }

    if (!["PENDING", "LEASED", "RUNNING", "FAILED"].includes(status)) {
      throw new HttpsError("failed-precondition", `Job ${jobId} cannot be cancelled from status ${status}.`);
    }

    transaction.set(
      jobRef,
      {
        status: "CANCELLED",
        lease: FieldValue.delete(),
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      queueRef,
      {
        status: "DONE",
        lease: FieldValue.delete(),
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
