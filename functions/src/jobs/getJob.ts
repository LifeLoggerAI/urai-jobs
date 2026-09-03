import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

export const getJob = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const jobId = String(asRecord(request.data).jobId || "").trim();
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  const db = getFirestore();
  const jobRef = db.collection("jobs").doc(jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    throw new HttpsError("not-found", `Job ${jobId} was not found.`);
  }

  const job = { id: jobSnap.id, ...jobSnap.data() } as Record<string, unknown>;
  const ownerUid = String(job.ownerUid || job.createdBy || "");

  if (!hasOperatorAccess(request.auth) && ownerUid !== authUid(request.auth)) {
    throw new HttpsError("permission-denied", "You do not have access to this job.");
  }

  const logsSnap = await jobRef.collection("logs").orderBy("createdAt", "desc").limit(100).get();
  const logs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return { job, logs };
});
