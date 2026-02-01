import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { firestore } from "firebase-admin";

const db = admin.firestore();

const leaseRun = async () => {
    const now = firestore.Timestamp.now();
    const query = db.collection("jobRuns")
        .where("status", "==", "queued")
        .orderBy("queuedAt")
        .limit(1);

    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(query);
        if (snapshot.empty) {
            return null;
        }

        const runDoc = snapshot.docs[0];
        const jobDoc = await db.collection("jobs").doc(runDoc.data().jobId).get();
        const job = jobDoc.data();

        if (!job) {
            return null;
        }

        const leaseSeconds = job.leaseSeconds;
        const leaseExpiresAt = firestore.Timestamp.fromMillis(now.toMillis() + leaseSeconds * 1000);

        transaction.update(runDoc.ref, {
            status: "leased",
            leaseExpiresAt,
            workerId: "local-worker", // Replace with actual worker ID
        });

        return { run: { id: runDoc.id, ...runDoc.data() }, job };
    });
};

const executeRun = async (run: any, job: any) => {
    await db.collection("jobRuns").doc(run.id).update({ status: "running", startedAt: firestore.FieldValue.serverTimestamp() });

    try {
        // Simulate work
        console.log(`Executing job: ${job.name}`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        await db.collection("jobRuns").doc(run.id).update({ status: "succeeded", finishedAt: firestore.FieldValue.serverTimestamp() });
    } catch (error) {
        console.error("Job execution failed:", error);
        const runDoc = await db.collection("jobRuns").doc(run.id).get();
        const currentAttempt = runDoc.data()?.attempt || 0;

        if (currentAttempt < job.maxRetries) {
            await db.collection("jobRuns").doc(run.id).update({
                status: "queued",
                attempt: currentAttempt + 1,
            });
        } else {
            await db.collection("jobRuns").doc(run.id).update({
                status: "failed",
                finishedAt: firestore.FieldValue.serverTimestamp(),
                error: { message: (error as Error).message },
            });

            // Move to deadletter queue
            await db.collection("jobDeadletter").add({ ...runDoc.data(), error: { message: (error as Error).message } });
        }
    }
};

export const worker = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
    const leased = await leaseRun();

    if (leased) {
        const { run, job } = leased;
        await executeRun(run, job);
    }
});
