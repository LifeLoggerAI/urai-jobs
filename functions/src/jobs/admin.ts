import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { https } from "firebase-functions/v1";

if (getApps().length === 0) initializeApp();

type JobStatus =
  | "PENDING"
  | "LEASED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "DEAD"
  | "CANCELLED";

const ALLOWED_STATUSES = new Set<JobStatus>([
  "PENDING",
  "LEASED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "DEAD",
  "CANCELLED"
]);

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

function requireOperator(auth: unknown): void {
  if (!auth) {
    throw new https.HttpsError("unauthenticated", "Authentication is required.");
  }

  if (!hasOperatorAccess(auth)) {
    throw new https.HttpsError("permission-denied", "Admin/operator access is required.");
  }
}

function normalizeLimit(value: unknown, fallback = 50): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  return {
    id,
    jobId: data.jobId || id,
    ...data
  };
}

export const listJobs = https.onCall(async (data, context) => {
  requireOperator(context.auth);

  const input = asRecord(data);
  const statusRaw = String(input.status || "").trim();
  const limit = normalizeLimit(input.limit, 50);

  let query: FirebaseFirestore.Query = getFirestore().collection("jobs");

  if (statusRaw) {
    if (!ALLOWED_STATUSES.has(statusRaw as JobStatus)) {
      throw new https.HttpsError("invalid-argument", `Invalid job status: ${statusRaw}`);
    }

    query = query.where("status", "==", statusRaw);
  }

  const snap = await query.limit(limit).get();
  const jobs = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));

  return { jobs };
});

export const listJobLogs = https.onCall(async (data, context) => {
  requireOperator(context.auth);

  const input = asRecord(data);
  const jobId = String(input.jobId || "").trim();
  const limit = normalizeLimit(input.limit, 100);

  if (!jobId) {
    throw new https.HttpsError("invalid-argument", "jobId is required.");
  }

  const snap = await getFirestore()
    .collection("jobs")
    .doc(jobId)
    .collection("logs")
    .limit(limit)
    .get();

  const logs = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  return { logs };
});

export const retryJob = https.onCall(async (data, context) => {
  requireOperator(context.auth);

  const input = asRecord(data);
  const jobId = String(input.jobId || "").trim();

  if (!jobId) {
    throw new https.HttpsError("invalid-argument", "jobId is required.");
  }

  const db = getFirestore();
  const jobRef = db.collection("jobs").doc(jobId);
  const queueRef = db.collection("jobQueue").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const jobSnap = await transaction.get(jobRef);

    if (!jobSnap.exists) {
      throw new https.HttpsError("not-found", `Job ${jobId} was not found.`);
    }

    const job = jobSnap.data() || {};
    const status = String(job.status || "");

    if (status !== "FAILED") {
      throw new https.HttpsError("failed-precondition", `Job ${jobId} cannot be retried from status ${status}.`);
    }

    transaction.set(
      jobRef,
      {
        status: "PENDING",
        retryCount: Number(job.retryCount || 0),
        retriedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      queueRef,
      {
        jobId,
        status: "PENDING",
        availableAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await jobRef.collection("logs").add({
    level: "info",
    message: "Job retry queued from live admin callable.",
    createdAt: FieldValue.serverTimestamp(),
    source: "retryJob"
  });

  return { jobId, status: "PENDING" };
});
