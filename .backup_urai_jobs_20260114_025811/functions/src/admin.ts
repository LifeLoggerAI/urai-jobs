import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

const isCallerAdmin = async (uid: string | undefined): Promise<boolean> => {
  if (!uid) return false;
  const adminDoc = await db.collection("admins").doc(uid).get();
  return adminDoc.exists;
};

export const adminEnqueue = functions.https.onCall(async (data, context) => {
  if (!(await isCallerAdmin(context.auth?.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Must be an admin to enqueue jobs.");
  }
  const { queue = "default", handler, payload } = data;
  if (!handler || !payload) {
    throw new functions.https.HttpsError("invalid-argument", "Missing handler or payload.");
  }

  const job = {
    handler,
    payload,
    status: "PENDING",
    attempts: 0,
    maxAttempts: 5,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastAttemptAt: null,
  };

  const ref = await db.collection("queues").doc(queue).collection("tasks").add(job);

  return { result: "success", jobId: ref.id };
});

export const adminRedriveDlq = functions.https.onCall(async (data, context) => {
    if (!(await isCallerAdmin(context.auth?.uid))) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin to redrive the DLQ.");
    }
    const { queue = "default" } = data;
    const dlqRef = db.collection("dlq").doc(queue).collection("tasks");
    const snapshot = await dlqRef.limit(100).get(); // Process in batches

    if (snapshot.empty) {
        return { result: "DLQ is empty." };
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        const job = doc.data();
        const newJob = { ...job, status: "PENDING", attempts: 0, lease: null };
        const newJobRef = db.collection("queues").doc(queue).collection("tasks").doc(doc.id);
        batch.set(newJobRef, newJob);
        batch.delete(doc.ref);
    });

    await batch.commit();

    return { result: `Redrove ${snapshot.size} jobs from DLQ.` };
});

// Other admin functions from original file
// ...
