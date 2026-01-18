import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK
initializeApp({ projectId: 'urai-jobs' });

const db = getFirestore();

async function seedJobs() {
    console.log("Seeding jobs...");
    const now = new Date();

    const jobs = [
        { type: "noop", payload: { message: "This is a no-op job" }, status: "PENDING" },
        { type: "echo", payload: { data: "Hello World" }, status: "PENDING" },
        { type: "echo", payload: { data: "Another echo job" }, status: "SUCCEEDED" },
        { type: "nonexistent", payload: {}, status: "FAILED" },
    ];

    for (const job of jobs) {
        const jobRef = db.collection("jobs").doc();
        await jobRef.set({
            ...job,
            priority: 0,
            createdAt: now,
            updatedAt: now,
            scheduledFor: null,
            runAfter: now,
            attempts: 0,
            maxAttempts: 5,
            lastError: null,
            lease: { ownerId: null, leaseId: null, leasedAt: null, expiresAt: null, heartbeatAt: null },
            idempotencyKey: null,
            dedupeWindowSec: null,
        });
    }

    console.log("Seeding jobs complete.");
}


async function main() {
    await seedJobs();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
