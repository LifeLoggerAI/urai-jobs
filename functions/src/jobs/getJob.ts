import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { checkedCurrentJobCaller, boundJobMatchesCurrentOwnerScope } from "./currentJobCallerAuthority.js";

if (getApps().length === 0) initializeApp();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export const getJob = onCall({ region: "us-central1" }, async (request) => {
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

  // Authorization, job fields and log query share the same Firestore snapshot.
  return db.runTransaction(async transaction => {
    const [userSnap, jobSnap] = await Promise.all([
      transaction.get(userRef), transaction.get(jobRef)
    ]);
    const caller = checkedCurrentJobCaller(request.auth, userSnap.exists ? userSnap.data() : null);
    if (!caller) throw new HttpsError("permission-denied", "Current user authority is unavailable.");
    if (!jobSnap.exists) throw new HttpsError("not-found", `Job ${jobId} was not found.`);

    const job = { id: jobSnap.id, ...jobSnap.data() } as Record<string, unknown>;
    // Current tenant/org binding must match, not merely the owner UID.
    if (!caller.operator && !boundJobMatchesCurrentOwnerScope(job, userSnap.data(), caller.uid)) {
      throw new HttpsError("permission-denied", "You do not have access to this job.");
    }

    const logsQuery = jobRef.collection("logs").orderBy("createdAt", "desc").limit(100);
    const logsSnap = await transaction.get(logsQuery);
    const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { job, logs };
  });
});
