import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "http://127.0.0.1:9000", // Replace with your database URL if not using emulator
});

const db = admin.firestore();

async function seed() {
  // Create admins
  await db.collection("admins").doc("test-admin").set({
    role: "owner",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create jobs
  await db.collection("jobs").doc("test-job-1").set({
    type: "echo",
    payload: {message: "Hello, world!"},
    priority: 0,
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    runAfter: admin.firestore.FieldValue.serverTimestamp(),
    attempts: 0,
    maxAttempts: 1,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
  });

  await db.collection("jobs").doc("test-job-2").set({
    type: "wait",
    payload: {ms: 5000},
    priority: 1,
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    runAfter: admin.firestore.FieldValue.serverTimestamp(),
    attempts: 0,
    maxAttempts: 3,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
  });

  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
