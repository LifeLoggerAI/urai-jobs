import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { https } from "firebase-functions/v1";
import { checkedCurrentJobCaller } from "./currentJobCallerAuthority.js";

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

function uidFromAuth(auth: unknown): string {
  const uid = String(asRecord(auth).uid || "");
  if (!uid) throw new https.HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

function requireCurrentOperator(auth: unknown, serverUser: unknown): void {
  if (!checkedCurrentJobCaller(auth, serverUser)?.operator) {
    throw new https.HttpsError("permission-denied", "Current admin/operator authority is required.");
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

export const listJobs = https.onCall(async (data, context) =>
  const uid = uidFromAuth(context.auth);
  const input = asRecord(data);
  const statusRaw = String(input.status || "").trim();
  const limit = normalizeLimit(input.limit, 50);
  if (statusRaw && !ALLOWED_STATUSES.has(statusRaw as JobStatus)) {
    throw new https.HttpsError("invalid-argument", `Invalid job status: ${statusRaw}`);
  }

  const db = getFirestore();
  return db.runTransaction(async transaction => {
    const userSnap = await transaction.get(db.collection("users").doc(uid));
    requireCurrentOperator(context.auth, userSnap.exists ? userSnap.data() : null);
    let query: FirebaseFirestore.Query = db.collection("jobs");
    if (statusRaw) query = query.where("status", "==", statusRaw);
    const jobsSnap = await transaction.get(query.limit(limit));
    return { jobs: jobsSnap.docs.map(doc => serializeDoc(doc.id, doc.data())) };
  });
});

export const listJobLogs = https.onCall(async (data, context) =>
  const uid = uidFromAuth(context.auth);
  const input = asRecord(data);
  const jobId = String(input.jobId || "").trim();
  const limit = normalizeLimit(input.limit, 100);
  if (!jobId) throw new https.HttpsError("invalid-argument", "jobId is required.");

  const db = getFirestore();
  return db.runTransaction(async transaction => {
    const userSnap = await transaction.get(db.collection("users").doc(uid));
    requireCurrentOperator(context.auth, userSnap.exists ? userSnap.data() : null);
    const logsQuery = db.collection("jobs").doc(jobId).collection("logs").limit(limit);
    const logsSnap = await transaction.get(logsQuery);
    return { logs: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  });
});

export const retryJob = https.onCall(async (data, context) =>
  const uid = uidFromAuth(context.auth);
  const input = asRecord(data);
  const jobId = String(input.jobId || "").trim();
  if (!jobId) throw new https.HttpsError("invalid-argument", "jobId is required.");

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const jobRef = db.collection("jobs").doc(jobId);
  const queueRef = db.collection("jobQueue").doc(jobId);
  const logRef = jobRef.collection("logs").doc();
  await db.runTransaction(async transaction => {
    const [userSnap, jobSnap] = await Promise.all([
      transaction.get(userRef), transaction.get(jobRef)
    ]);
    requireCurrentOperator(context.auth, userSnap.exists ? userSnap.data() : null);
    if (!jobSnap.exists) throw new https.HttpsError("not-found", `Job ${jobId} was not found.`);
    const job = jobSnap.data() || {};
    const status = String(job.status || "");
    if (status !== "FAILED") {
      throw new https.HttpsError("failed-precondition", `Job ${jobId} cannot be retried from status ${status}.`);
    }

    transaction.set(jobRef, {
      status: "PENDING",
      retryCount: Number(job.retryCount || 0),
      retriedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(queueRef, {
      jobId,
      status: "PENDING",
      availableAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(logRef, {
      level: "info",
      message: "Job retry queued from live admin callable.",
      createdAt: FieldValue.serverTimestamp(),
      source: "retryJob"
    });
  });

  return { jobId, status: "PENDING" };
});
