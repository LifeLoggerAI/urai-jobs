
import * as admin from "firebase-admin";
import { Job } from "../types";

const db = admin.firestore();

export async function claimJob(workerId: string): Promise<Job | null> {
  return db.runTransaction(async (transaction) => {
    const now = admin.firestore.Timestamp.now();

    const availableJobs = await transaction.get(
      db
        .collection("jobs")
        .where("status", "==", "PENDING")
        .where("runAfter", "<=", now)
        .orderBy("runAfter", "asc")
        .orderBy("priority", "desc")
        .orderBy("createdAt", "asc")
        .limit(1)
    );

    if (availableJobs.empty) {
      return null;
    }

    const jobDoc = availableJobs.docs[0];
    const jobData = jobDoc.data() as Job;

    const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + 60 * 1000 // 60 second lease
    );

    transaction.update(jobDoc.ref, {
      status: "RUNNING",
      leaseOwner: workerId,
      leaseExpiresAt,
      attempts: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    });

    transaction.create(jobDoc.ref.collection("runs").doc(), {
      startedAt: now,
      finishedAt: null,
      workerId,
      outcome: null,
      error: null,
      durationMs: null,
    });

    return { ...jobData, id: jobDoc.id } as unknown as Job;
  });
}
