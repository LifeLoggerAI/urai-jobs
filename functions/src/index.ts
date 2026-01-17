import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {v4 as uuidv4} from "uuid";

admin.initializeApp();

const db = admin.firestore();

// Job Statuses
const PENDING = "PENDING";
const RUNNING = "RUNNING";
const SUCCEEDED = "SUCCEEDED";
const FAILED = "FAILED";
const DEAD = "DEAD";
const CANCELED = "CANCELED";

// Job handlers
const handlers: { [key: string]: (payload: any) => Promise<void> } = {
  echo: async (payload: any) => {
    console.log("ECHO PAYLOAD:", payload);
    return;
  },
  wait: async (payload: { ms: number }) => {
    return new Promise((resolve) => setTimeout(resolve, payload.ms));
  },
};

// Enqueue a job
export const enqueue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be authenticated to enqueue a job."
    );
  }

  // Check for admin privileges
  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to enqueue a job."
    );
  }

  const {type, payload, priority, maxAttempts, idempotencyKey} = data;

  if (!type || !handlers[type]) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A valid job type is required."
    );
  }

  const jobId = idempotencyKey ? `${idempotencyKey}` : uuidv4();

  const job = {
    type,
    payload,
    priority: priority || 0,
    status: PENDING,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    runAfter: admin.firestore.FieldValue.serverTimestamp(),
    attempts: 0,
    maxAttempts: maxAttempts || 1,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
    idempotencyKey: idempotencyKey || null,
  };

  await db.collection("jobs").doc(jobId).set(job);

  return {jobId};
});

// Requeue a job
export const requeue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be authenticated to requeue a job."
    );
  }

  // Check for admin privileges
  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to requeue a job."
    );
  }

  const {jobId} = data;

  if (!jobId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A job ID is required."
    );
  }

  const jobRef = db.collection("jobs").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    transaction.update(jobRef, {
      status: PENDING,
      leaseOwner: null,
      leaseExpiresAt: null,
      runAfter: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {jobId};
});


// Claim and run jobs
export const dispatcher = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
  const workerId = uuidv4();
  const now = admin.firestore.Timestamp.now();

  const query = db.collection("jobs")
      .where("status", "==", PENDING)
      .where("runAfter", "<=", now)
      .orderBy("runAfter", "asc")
      .orderBy("priority", "desc")
      .limit(10);

  const snapshot = await query.get();

  const promises = snapshot.docs.map(async (doc) => {
    const jobRef = doc.ref;
    const jobId = doc.id;
    const job = doc.data();

    try {
      await db.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(jobRef);
        if (freshDoc.data()?.status !== PENDING) {
          return;
        }

        const leaseExpiresAt = new admin.firestore.Timestamp(now.seconds + 60, now.nanoseconds);
        transaction.update(jobRef, {
          status: RUNNING,
          leaseOwner: workerId,
          leaseExpiresAt,
          attempts: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const runId = uuidv4();
        transaction.set(db.collection("jobs").doc(jobId).collection("runs").doc(runId), {
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          workerId,
          outcome: null,
          error: null,
        });
      });

      await handlers[job.type](job.payload);
      await complete(jobId, workerId);
    } catch (error: any) {
      await fail(jobId, workerId, error);
    }
  });

  await Promise.all(promises);
});

// Complete a job
const complete = async (jobId: string, workerId: string) => {
  const jobRef = db.collection("jobs").doc(jobId);
  const runQuery = db.collection("jobs").doc(jobId).collection("runs").where("workerId", "==", workerId).limit(1);

  await db.runTransaction(async (transaction) => {
    const runSnapshot = await transaction.get(runQuery);
    const runDoc = runSnapshot.docs[0];

    transaction.update(jobRef, {
      status: SUCCEEDED,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (runDoc) {
      const runRef = runDoc.ref;
      const finishedAt = admin.firestore.FieldValue.serverTimestamp();
      const durationMs = runDoc.createTime ? (finishedAt.toMillis() - runDoc.createTime.toMillis()) : 0;

      transaction.update(runRef, {
        finishedAt,
        outcome: SUCCEEDED,
        durationMs,
      });
    }
  });
};

// Fail a job
const fail = async (jobId: string, workerId: string, error: any) => {
  const jobRef = db.collection("jobs").doc(jobId);
  const runQuery = db.collection("jobs").doc(jobId).collection("runs").where("workerId", "==", workerId).limit(1);

  await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    const job = jobDoc.data();

    if (!job) {
      return;
    }

    const runSnapshot = await transaction.get(runQuery);
    const runDoc = runSnapshot.docs[0];

    const newStatus = job.attempts >= job.maxAttempts ? DEAD : FAILED;
    const runAfter = new admin.firestore.Timestamp(
      admin.firestore.Timestamp.now().seconds + 60 * Math.pow(2, job.attempts),
      0
    );

    transaction.update(jobRef, {
      status: newStatus,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: {message: error.message, stack: error.stack},
      runAfter,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (runDoc) {
      const runRef = runDoc.ref;
      const finishedAt = admin.firestore.FieldValue.serverTimestamp();
      const durationMs = runDoc.createTime ? (finishedAt.toMillis() - runDoc.createTime.toMillis()) : 0;

      transaction.update(runRef, {
        finishedAt,
        outcome: FAILED,
        error: {message: error.message, stack: error.stack},
        durationMs,
      });
    }
  });
};

// Cancel a job
export const cancel = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be authenticated to cancel a job."
    );
  }

  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to cancel a job."
    );
  }

  const {jobId} = data;
  const jobRef = db.collection("jobs").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    const job = jobDoc.data();

    if (!job) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    if (job.status === SUCCEEDED) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot cancel a succeeded job."
      );
    }

    transaction.update(jobRef, {
      status: CANCELED,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {jobId};
});

// Heartbeat for a running job
export const heartbeat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be authenticated to heartbeat a job."
    );
  }

  const {jobId, workerId} = data;
  const jobRef = db.collection("jobs").doc(jobId);

  await db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    const job = jobDoc.data();

    if (!job) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    if (job.status !== RUNNING || job.leaseOwner !== workerId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Job is not running or you are not the owner."
      );
    }

    const leaseExpiresAt = new admin.firestore.Timestamp(
      admin.firestore.Timestamp.now().seconds + 60,
      0
    );

    transaction.update(jobRef, {leaseExpiresAt});
  });

  return {jobId};
});

// Reaper for stuck jobs
export const reaper = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const query = db
      .collection("jobs")
      .where("status", "==", RUNNING)
      .where("leaseExpiresAt", "<", now);

  const snapshot = await query.get();

  const promises = snapshot.docs.map(async (doc) => {
    const jobId = doc.id;
    await fail(jobId, "reaper", new Error("Job timed out."));
  });

  await Promise.all(promises);
});

// Admin list jobs
export const listJobs = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be authenticated to list jobs."
    );
  }

  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to list jobs."
    );
  }

  const {status, type, limit} = data;
  let query: admin.firestore.Query = db.collection("jobs");

  if (status) {
    query = query.where("status", "==", status);
  }

  if (type) {
    query = query.where("type", "==", type);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
});
