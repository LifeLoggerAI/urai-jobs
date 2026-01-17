
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function seed() {
    console.log("Seeding database with demo jobs...");
    const jobsRef = db.collection("jobs");

    const now = admin.firestore.Timestamp.now();

    await jobsRef.add({
        type: "echo",
        payload: { message: "This is a high priority echo job." },
        status: "PENDING",
        priority: 10,
        createdAt: now,
        updatedAt: now,
        runAfter: now,
        attempts: 0,
        maxAttempts: 3,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
    });

    await jobsRef.add({
        type: "wait",
        payload: { ms: 1500 },
        status: "PENDING",
        priority: 0,
        createdAt: now,
        updatedAt: now,
        runAfter: now,
        attempts: 0,
        maxAttempts: 3,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
    });
    
    const futureTime = admin.firestore.Timestamp.fromMillis(now.toMillis() + 60000 * 5);
    await jobsRef.add({
        type: "echo",
        payload: { message: "This job is scheduled for the future." },
        status: "PENDING",
        priority: 0,
        createdAt: now,
        updatedAt: now,
        runAfter: futureTime,
        attempts: 0,
        maxAttempts: 3,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
    });

    console.log("Seeding complete.");
}

seed().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
