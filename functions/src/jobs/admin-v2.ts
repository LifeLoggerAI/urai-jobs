import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

type JobStatus =
  | "PENDING"
  | "LEASED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "DEAD"
  | "CANCELLED"
  | "DONE";

const STATUS_ALIASES: Record<string, JobStatus> = {
  queued: "PENDING",
  pending: "PENDING",
  leased: "LEASED",
  running: "RUNNING",
  succeeded: "SUCCESS",
  success: "SUCCESS",
  done: "DONE",
  failed: "FAILED",
  dead: "DEAD",
  retry_needed: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED"
};

const ALLOWED_STATUSES = new Set<JobStatus>([
  "PENDING",
  "LEASED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "DEAD",
  "CANCELLED",
  "DONE"
]);

const callableOptions = {
  region: "us-central1",
  cors: true
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeStatus(value: unknown): JobStatus | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const normalized = STATUS_ALIASES[raw.toLowerCase()] || raw.toUpperCase();
  if (!ALLOWED_STATUSES.has(normalized as JobStatus)) {
    throw new HttpsError("invalid-argument", `Invalid job status: ${raw}`);
  }
  return normalized as JobStatus;
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
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  if (!hasOperatorAccess(auth)) {
    throw new HttpsError("permission-denied", "Admin/operator access is required.");
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

export const listJobsV2 = onCall(callableOptions, async (request) => {
  requireOperator(request.auth);

  const input = asRecord(request.data);
  const status = normalizeStatus(input.status);
  const limit = normalizeLimit(input.limit, 50);

  let query: FirebaseFirestore.Query = getFirestore().collection("jobs");

  if (status) {
    query = query.where("status", "==", status);
  }

  const snap = await query.limit(limit).get();
  const jobs = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));

  return { jobs };
});

export const listJobLogsV2 = onCall(callableOptions, async (request) => {
  requireOperator(request.auth);

  const input = asRecord(request.data);
  const jobId = String(input.jobId || "").trim();
  const limit = normalizeLimit(input.limit, 100);

  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required.");
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

export const retryJobV2 = onCall(callableOptions, async (request) => {
  requireOperator(request.auth);

  const input = asRecord(request.data);
  const jobId = String(input.jobId || "").trim();

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

    if (!["FAILED", "DEAD", "CANCELLED"].includes(status || "")) {
      throw new HttpsError("failed-precondition", `Job ${jobId} cannot be retried from status ${status || "unknown"}.`);
    }

    transaction.set(
      jobRef,
      {
        status: "PENDING",
        retryCount: Number(job.retryCount || job.attempts || 0),
        lease: FieldValue.delete(),
        retriedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      queueRef,
      {
        jobId,
        jobType: job.jobType || job.type,
        status: "PENDING",
        lease: FieldValue.delete(),
        availableAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await jobRef.collection("logs").add({
    level: "info",
    message: "Job retry queued from live admin v2 callable.",
    createdAt: FieldValue.serverTimestamp(),
    source: "retryJobV2"
  });

  return { jobId, status: "PENDING" };
});
