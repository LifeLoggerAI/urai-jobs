#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Step 1: Standardize Project Shape
mkdir -p functions
mkdir -p scripts

# Create firestore.indexes.json
echo '{
  "indexes": [
    {
      "collectionGroup": "jobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "runAfter", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "jobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "leaseExpiresAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}' > firestore.indexes.json

# Create firestore.rules
echo 'rules_version = "2";
service cloud.firestore {
  match /databases/{database}/documents {
    // Forbid client-side writes to the entire database
    match /{document=**} {
      allow read, write: if false;
    }

    // Allow admin access to all resources
    match /jobs/{jobId} {
        allow read, write: if get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == "admin";
    }
    match /jobs/{jobId}/{subcollection}/{docId} {
        allow read, write: if get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == "admin";
    }
    match /jobMetrics/{metricId} {
        allow read, write: if get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == "admin";
    }
    match /admins/{adminId} {
        allow read, write: if get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == "admin";
    }
  }
}' > firestore.rules

# Create scripts/dev.sh
echo '#!/bin/bash
npm --prefix ../functions run dev' > scripts/dev.sh
chmod +x scripts/dev.sh

# Create scripts/test.sh
echo '#!/bin/bash
npm --prefix ../functions test' > scripts/test.sh
chmod +x scripts/test.sh

# Create scripts/emulators.sh
echo '#!/bin/bash
firebase emulators:start' > scripts/emulators.sh
chmod +x scripts/emulators.sh

# Create scripts/deploy.sh
echo '#!/bin/bash
firebase deploy --only functions,firestore' > scripts/deploy.sh
chmod +x scripts/deploy.sh

# Initialize functions directory
if [ ! -f "functions/package.json" ]; then
  npm init -y --prefix functions
fi

# Install dependencies
npm install --prefix functions firebase-admin firebase-functions
npm install --prefix functions -D typescript @types/node @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint

# Create tsconfig.json in functions directory
echo '{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017"
  },
  "compileOnSave": true,
  "include": [
    "src"
  ]
}' > functions/tsconfig.json

# Create src directory in functions
mkdir -p functions/src

# Step 2, 3, 4, 5, 6: Implement Core Logic, Handlers, and API
# Create functions/src/index.ts
echo '
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
admin.initializeApp();
const db = admin.firestore();
const {error, info} = functions.logger;
interface Job {
  type: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";
  priority: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  runAfter: admin.firestore.Timestamp;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: admin.firestore.Timestamp | null;
  lastError: { message: string, code?: string, stack?: string, at?: admin.firestore.Timestamp } | null;
  payload: any;
  idempotencyKey?: string;
}
interface JobRun {
  startedAt: admin.firestore.Timestamp;
  finishedAt: admin.firestore.Timestamp | null;
  workerId: string;
  outcome: string | null;
  error?: any;
  durationMs: number | null;
}
const handlers: { [key: string]: (payload: any) => Promise<any> } = {
  echo: async (payload) => {
    info("ECHO PAYLOAD", payload);
    return { "echo": payload };
  },
  wait: async (payload) => {
    const ms = payload.ms || 1000;
    await new Promise(res => setTimeout(res, ms));
    return { "waited": ms };
  },
};
export const enqueue = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    // Simple admin check
    const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "Admin privileges are required.");
    }

    const { type, payload, priority, maxAttempts, runAfter } = data;
    if (!type || !handlers[type]) {
        throw new functions.https.HttpsError("invalid-argument", "A valid job type is required.");
    }
    const now = admin.firestore.Timestamp.now();
    const newJob: Job = {
        type,
        status: "PENDING",
        priority: priority || 0,
        createdAt: now,
        updatedAt: now,
        runAfter: runAfter ? admin.firestore.Timestamp.fromMillis(runAfter) : now,
        attempts: 0,
        maxAttempts: maxAttempts || 5,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        payload,
    };
    const jobRef = await db.collection("jobs").add(newJob);
    return { jobId: jobRef.id };
});
export const dispatcher = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const query = db.collection("jobs")
        .where("status", "==", "PENDING")
        .where("runAfter", "<=", now)
        .orderBy("runAfter", "asc")
        .orderBy("priority", "desc")
        .limit(10);
    const jobs = await query.get();
    const workerId = "dispatcher-" + Date.now();
    for (const jobDoc of jobs.docs) {
        const jobId = jobDoc.id;
        const job = jobDoc.data() as Job;
        const jobRef = db.collection("jobs").doc(jobId);
        try {
            await db.runTransaction(async (transaction) => {
                const freshJobDoc = await transaction.get(jobRef);
                const freshJob = freshJobDoc.data() as Job;
                if (freshJob.status !== "PENDING") {
                    return; // Job was claimed by another worker
                }
                const leaseTimeout = 60 * 1000; // 60 seconds
                transaction.update(jobRef, {
                    status: "RUNNING",
                    leaseOwner: workerId,
                    leaseExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + leaseTimeout),
                    attempts: freshJob.attempts + 1,
                    updatedAt: now,
                });
                transaction.set(jobRef.collection("runs").doc(), {
                    startedAt: now,
                    workerId,
                });
            });

            const handler = handlers[job.type];
            let outcome: any;
            try {
                outcome = await handler(job.payload);
                await completeJob(jobId, workerId, "SUCCEEDED", outcome);
            } catch (e: any) {
                error("Job execution failed", { jobId, error: e.message });
                await failJob(jobId, workerId, e);
            }
        } catch (e: any) {
            error("Transaction to claim job failed", { jobId, error: e.message });
        }
    }
});
async function completeJob(jobId: string, workerId: string, status: "SUCCEEDED" | "CANCELED", outcome: any) {
    const now = admin.firestore.Timestamp.now();
    const jobRef = db.collection("jobs").doc(jobId);
    await jobRef.update({
        status: status,
        updatedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
    });
    const runQuery = await jobRef.collection("runs").where("workerId", "==", workerId).orderBy("startedAt", "desc").limit(1).get();
    if (!runQuery.empty) {
        const runDoc = runQuery.docs[0];
        const run = runDoc.data() as JobRun;
        const durationMs = now.toMillis() - run.startedAt.toMillis();
        await runDoc.ref.update({
            finishedAt: now,
            outcome: status,
            durationMs,
        });
    }
}
async function failJob(jobId: string, workerId: string, e: Error) {
    const now = admin.firestore.Timestamp.now();
    const jobRef = db.collection("jobs").doc(jobId);
    const jobDoc = await jobRef.get();
    const job = jobDoc.data() as Job;
    const newAttempts = job.attempts;
    let newStatus: Job["status"] = "FAILED";
    if (newAttempts >= job.maxAttempts) {
        newStatus = "DEAD";
    }
    const backoff = Math.pow(2, newAttempts) * 1000; // exponential backoff
    const runAfter = admin.firestore.Timestamp.fromMillis(now.toMillis() + backoff);
    await jobRef.update({
        status: newStatus,
        updatedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: { message: e.message, stack: e.stack },
        runAfter,
    });
    const runQuery = await jobRef.collection("runs").where("workerId", "==", workerId).orderBy("startedAt", "desc").limit(1).get();
    if (!runQuery.empty) {
        const runDoc = runQuery.docs[0];
        const run = runDoc.data() as JobRun;
        const durationMs = now.toMillis() - run.startedAt.toMillis();
        await runDoc.ref.update({
            finishedAt: now,
            outcome: "FAILED",
            error: { message: e.message, stack: e.stack },
            durationMs,
        });
    }
}

' > functions/src/index.ts

# Step 7 & 8: Emulator-First Dev Experience & Tests
# Create seed script
mkdir -p scripts
echo '#!/bin/bash
firebase functions:config:set GCLOUD_PROJECT=$PROJECT_ID
firebase emulators:exec "node scripts/seed.js"' > scripts/seed.sh
chmod +x scripts/seed.sh

echo '
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json"); // Download this from Firebase console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "urai-jobs",
});
const db = admin.firestore();
async function seed() {
  console.log("Seeding database...");
  const adminUid = "some-admin-uid"; // Replace with a real UID from Auth emulator
  await db.collection("admins").doc(adminUid).set({ role: "admin", createdAt: new Date() });
  console.log("Admin user created.");
  const jobs = [
    { type: "echo", payload: { message: "Hello from job 1" } },
    { type: "wait", payload: { ms: 2000 } },
    { type: "echo", payload: { message: "Hello from job 3" } },
  ];
  for (const job of jobs) {
    const now = admin.firestore.Timestamp.now();
    const newJob = {
      ...job,
      status: "PENDING",
      priority: 0,
      createdAt: now,
      updatedAt: now,
      runAfter: now,
      attempts: 0,
      maxAttempts: 5,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: null,
    };
    await db.collection("jobs").add(newJob);
  }
  console.log("Seeded 3 jobs.");
}
seed().then(() => console.log("Seeding complete.")).catch(console.error);
' > scripts/seed.js

# Smoke test
echo '#!/bin/bash
set -e
echo "Starting smoke test..."
# Start emulators in the background
firebase emulators:start > /dev/null 2>&1 &
EMULATOR_PID=$!
# Wait for emulators to be ready
sleep 10
# Seed the database
npm run seed
# Trigger the dispatcher
firebase functions:shell
# TODO: Add assertions to check job statuses
#
# Clean up
kill $EMULATOR_PID
echo "Smoke test complete."
' > scripts/smoke.sh
chmod +x scripts/smoke.sh
# Finalize package.json scripts
# Using jq to safely add scripts to functions/package.json
if command -v jq &> /dev/null; then
  jq '.scripts.dev = "npm run build -- --watch" | .scripts.build = "tsc" | .scripts.serve = "npm run build && firebase emulators:start --only functions" | .scripts.shell = "npm run build && firebase functions:shell" | .scripts.start = "npm run shell" | .scripts.deploy = "firebase deploy --only functions" | .scripts.logs = "firebase functions:log" | .scripts.test = "echo \"Error: no test specified\" && exit 1"' functions/package.json > functions/package.json.tmp && mv functions/package.json.tmp functions/package.json
fi
# Show a summary
echo "Project setup is complete."
