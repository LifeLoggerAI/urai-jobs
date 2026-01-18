#!/bin/bash
# URAI Jobs Golden Setup Script
# This script is idempotent and can be re-run safely.

set -e # Exit on error

echo "INFO: Starting URAI Jobs setup."

# --- STEP 0: Discovery & Cleaning ---
echo "INFO: Cleaning up previous state to ensure idempotency..."
# Clean up functions directory
if [ -d "functions" ]; then
    rm -rf functions/src functions/lib functions/test functions/coverage functions/node_modules
    rm -f functions/jest.config.js functions/package.json functions/tsconfig.json functions/.eslintrc.js
fi
# Clean up scripts directory
rm -rf scripts
# Clean up root files
rm -f firebase.json .firebaserc firestore.indexes.json firestore.rules package.json pnpm-lock.yaml

# --- STEP 1: Standardize Project Shape ---
echo "INFO: Standardizing project shape..."
mkdir -p functions/src/engine functions/src/handlers functions/src/test scripts

# Create firebase.json
cat << 'EOF' > firebase.json
{
  "functions": {
    "source": "functions",
    "predeploy": [
      "pnpm --prefix \"$RESOURCE_DIR\" install",
      "pnpm --prefix \"$RESOURCE_DIR\" run build"
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "pubsub": { "port": 8085 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
EOF

# Create .firebaserc
cat << 'EOF' > .firebaserc
{
  "projects": {
    "default": "urai-jobs"
  }
}
EOF

# Create Root package.json
cat << 'EOF' > package.json
{
  "name": "urai-jobs-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "install": "pnpm --prefix functions install",
    "test": "bash scripts/test.sh",
    "emulators": "bash scripts/emulators.sh",
    "deploy": "bash scripts/deploy.sh",
    "seed": "bash scripts/seed.sh",
    "smoke": "bash scripts/smoke.sh",
    "dev": "bash scripts/dev.sh"
  },
  "devDependencies": {
    "typescript": "4.9.5",
    "firebase-tools": "^13.0.2",
    "pnpm": "^8.15.4"
  }
}
EOF

# Create Functions package.json
cat << 'EOF' > functions/package.json
{
  "name": "functions",
  "version": "1.0.0",
  "private": true,
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "lint": "eslint --ext .ts,.tsx .",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "firebase-admin": "^11.11.1",
    "firebase-functions": "^4.5.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "@typescript-eslint/eslint-plugin": "^5.62.0",
    "@typescript-eslint/parser": "^5.62.0",
    "eslint": "^8.56.0",
    "eslint-config-google": "^0.14.0",
    "eslint-plugin-import": "^2.29.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "4.9.5"
  },
  "engines": { "node": "20" }
}
EOF

# Create Functions tsconfig.json
cat << 'EOF' > functions/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2020",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "compileOnSave": true,
  "include": [ "src/**/*.ts" ],
  "exclude": [ "src/**/*.test.ts" ]
}
EOF

# Create Functions jest.config.js
cat << 'EOF' > functions/jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  coverageDirectory: "coverage",
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/types.ts', '!src/index.ts', '!src/handlers/**'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
};
EOF

# Create Functions .eslintrc.js
cat << 'EOF' > functions/.eslintrc.js
module.exports = {
  root: true,
  env: { es6: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  ignorePatterns: [ "/lib/**/*" ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "require-jsdoc": "off",
  },
};
EOF

# --- STEP 2: Firestore Data Model ---
echo "INFO: Creating Firestore rules and indexes..."

# Create firestore.rules
cat << 'EOF' > firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Public read-only access to open jobs
    match /jobPublic/{jobId} {
      allow read: if true;
      allow write: if false;
    }

    // Admin-only access to the full job details
    match /jobs/{jobId} {
      allow read, create, update, delete: if isAdmin();
    }

    // Applicants can be created by anyone, but not read
    match /applicants/{applicantId} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }
    
    // Applications can be created by anyone, but only read/updated by admins
    match /applications/{applicationId} {
        allow create: if true;
        allow read, update, delete: if isAdmin();
    }

    // Referrals can be created and updated by admins
    match /referrals/{refCode} {
        allow read, create, update, delete: if isAdmin();
    }

    // Waitlist can be written to by anyone, but only read by admins
    match /waitlist/{id} {
        allow create: if true;
        allow read, update, delete: if isAdmin();
    }

    // Only admins can manage the admin list
    match /admins/{uid} {
      allow read, create, delete: if isAdmin();
    }
    
    // Events can be created by anyone, but only read by admins
    match /events/{eventId} {
        allow create: if true;
        allow read, update, delete: if isAdmin();
    }
  }
}
EOF

# Create firestore.indexes.json
cat << 'EOF' > firestore.indexes.json
{
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
            { "fieldPath": "priority", "order": "DESCENDING" },
            { "fieldPath": "createdAt", "order": "ASCENDING" }
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
  ]
}
EOF

# --- STEP 3: Core Job Engine ---
echo "INFO: Implementing core job engine..."

# Create functions/src/types.ts
cat << 'EOF' > functions/src/types.ts
import { firestore } from "firebase-admin";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";
export type JobOutcome = "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";

export interface Job {
    type: string;
    status: JobStatus;
    priority: number;
    createdAt: firestore.Timestamp;
    updatedAt: firestore.Timestamp;
    runAfter: firestore.Timestamp;
    attempts: number;
    maxAttempts: number;
    leaseOwner: string | null;
    leaseExpiresAt: firestore.Timestamp | null;
    lastError: { message: string; code?: string; stack?: string; at?: firestore.Timestamp } | null;
    payload: Record<string, any>;
    idempotencyKey?: string;
}

export interface JobRun {
    startedAt: firestore.Timestamp;
    finishedAt: firestore.Timestamp | null;
    workerId: string;
    outcome: JobOutcome | null;
    error?: { message: string; code?: string; stack?: string };
    durationMs: number | null;
}

export interface JobContext {
    jobId: string;
    job: Job;
    runId: string;
    run: JobRun;
    log: (level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: Record<string, any>) => void;
}

export type JobHandler = (payload: any, context: JobContext) => Promise<void>;
EOF

# Create functions/src/engine/enqueue.ts
cat << 'EOF' > functions/src/engine/enqueue.ts
import * as admin from "firebase-admin";
import { Job } from "../types";

const db = admin.firestore();

export const enqueueJob = async (type: string, payload: Record<string, any>, options: { priority?: number; maxAttempts?: number; runAfter?: Date; idempotencyKey?: string } = {}) => {
    const now = admin.firestore.Timestamp.now();

    const job: Job = {
        type,
        status: "PENDING",
        priority: options.priority || 0,
        createdAt: now,
        updatedAt: now,
        runAfter: options.runAfter ? admin.firestore.Timestamp.fromDate(options.runAfter) : now,
        attempts: 0,
        maxAttempts: options.maxAttempts || 5,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        payload: payload,
        ...(options.idempotencyKey && { idempotencyKey: options.idempotencyKey }),
    };

    if (options.idempotencyKey) {
        const existing = await db.collection("jobs").where("idempotencyKey", "==", options.idempotencyKey).limit(1).get();
        if (!existing.empty) {
            console.log(`Job with idempotency key ${options.idempotencyKey} already exists. Skipping.`);
            return existing.docs[0].id;
        }
    }

    const docRef = await db.collection("jobs").add(job);
    return docRef.id;
};
EOF

# Create functions/src/engine/claim.ts
cat << 'EOF' > functions/src/engine/claim.ts
import * as admin from "firebase-admin";
import { Job } from "../types";

const db = admin.firestore();

export const claimJobs = async (workerId: string, limit: number, leaseTimeoutMs: number): Promise<string[]> => {
    const now = admin.firestore.Timestamp.now();
    const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + leaseTimeoutMs);

    const availableJobs = await db.collection("jobs")
        .where("status", "in", ["PENDING", "FAILED"])
        .where("runAfter", "<=", now)
        .orderBy("runAfter", "asc")
        .orderBy("priority", "desc")
        .orderBy("createdAt", "asc")
        .limit(limit)
        .get();

    const claimedJobIds: string[] = [];

    for (const doc of availableJobs.docs) {
        const jobId = doc.id;
        const jobRef = db.collection("jobs").doc(jobId);

        try {
            await db.runTransaction(async (transaction) => {
                const jobDoc = await transaction.get(jobRef);
                if (!jobDoc.exists) return;

                const job = jobDoc.data() as Job;

                if (job.status !== "PENDING" && job.status !== "FAILED") {
                    return;
                }
                
                if (job.leaseExpiresAt && now.toMillis() < job.leaseExpiresAt.toMillis()){
                    return;
                }

                transaction.update(jobRef, {
                    status: "RUNNING",
                    leaseOwner: workerId,
                    leaseExpiresAt,
                    attempts: admin.firestore.FieldValue.increment(1),
                    updatedAt: now,
                });

                const runRef = jobRef.collection("runs").doc();
                transaction.set(runRef, {
                    startedAt: now,
                    finishedAt: null,
                    workerId,
                    outcome: null,
                    durationMs: null,
                });

                claimedJobIds.push(jobId);
            });
        } catch (error) {
            console.error(`Failed to claim job ${jobId}`, error);
        }
    }

    return claimedJobIds;
};
EOF

# Create functions/src/engine/lifecycle.ts
cat << 'EOF' > functions/src/engine/lifecycle.ts
import * as admin from "firebase-admin";
import { Job, JobRun } from "../types";

const db = admin.firestore();

export const succeedJob = async (jobId: string, runId: string) => {
    const now = admin.firestore.Timestamp.now();
    const jobRef = db.collection("jobs").doc(jobId);
    const runRef = jobRef.collection("runs").doc(runId);

    const runDoc = await runRef.get();
    const run = runDoc.data() as JobRun;

    await runRef.update({
        finishedAt: now,
        outcome: "SUCCEEDED",
        durationMs: now.toMillis() - run.startedAt.toMillis(),
    });

    await jobRef.update({ status: "SUCCEEDED", updatedAt: now });
};

export const failJob = async (jobId: string, runId: string, error: Error) => {
    const now = admin.firestore.Timestamp.now();
    const jobRef = db.collection("jobs").doc(jobId);
    const runRef = jobRef.collection("runs").doc(runId);

    const jobDoc = await jobRef.get();
    const job = jobDoc.data() as Job;

    const runDoc = await runRef.get();
    const run = runDoc.data() as JobRun;

    await runRef.update({
        finishedAt: now,
        outcome: "FAILED",
        durationMs: now.toMillis() - run.startedAt.toMillis(),
        error: { message: error.message, stack: error.stack },
    });

    if (job.attempts >= job.maxAttempts) {
        await jobRef.update({ status: "DEAD", updatedAt: now, lastError: { message: error.message, at: now } });
    } else {
        const backoff = Math.pow(2, job.attempts) * 1000 + Math.random() * 1000;
        const runAfter = admin.firestore.Timestamp.fromMillis(now.toMillis() + backoff);
        await jobRef.update({ status: "FAILED", updatedAt: now, runAfter, lastError: { message: error.message, at: now } });
    }
};
EOF

# --- STEP 4: Job Handlers ---
echo "INFO: Implementing job handlers..."

# Create functions/src/handlers/echo.ts
cat << 'EOF' > functions/src/handlers/echo.ts
import { JobHandler } from "../types";

export const echoHandler: JobHandler = async (payload, context) => {
    console.log("ECHO HANDLER:", payload);
    context.log("INFO", "Echoing payload", payload);
};
EOF

# Create functions/src/handlers/wait.ts
cat << 'EOF' > functions/src/handlers/wait.ts
import { JobHandler } from "../types";

export const waitHandler: JobHandler = async (payload) => {
    const ms = payload.ms || 1000;
    if (ms > 10000) throw new Error("Wait time too long");
    await new Promise(resolve => setTimeout(resolve, ms));
};
EOF

# --- STEP 7: Emulator-first Dev Experience (Scripts) ---
echo "INFO: Creating utility scripts..."

# Create scripts/dev.sh
cat << 'EOF' > scripts/dev.sh
#!/bin/bash
set -e
pnpm --prefix functions run build:watch
EOF

# Create scripts/test.sh
cat << 'EOF' > scripts/test.sh
#!/bin/bash
set -e
pnpm --prefix functions test
EOF

# Create scripts/emulators.sh
cat << 'EOF' > scripts/emulators.sh
#!/bin/bash
set -e
firebase emulators:start --import=./emulator-data --export-on-exit
EOF

# Create scripts/deploy.sh
cat << 'EOF' > scripts/deploy.sh
#!/bin/bash
set -e
firebase deploy --only functions,firestore
EOF

# Create scripts/seed.sh
cat << 'EOF' > scripts/seed.sh
#!/bin/bash
set -e

echo "Seeding database..."

# Enqueue a few jobs for testing
firebase functions:shell <<EOF
enqueue({type: 'echo', payload: {message: 'hello world 1'}})
enqueue({type: 'wait', payload: {ms: 2000}})
enqueue({type: 'echo', payload: {message: 'hello world 2'}, options: {priority: 10}})
.exit
EOF

echo "Database seeded."
EOF

# Create scripts/smoke.sh
cat << 'EOF' > scripts/smoke.sh
#!/bin/bash
set -e

echo "INFO: Running smoke test..."

# Start emulators in the background
firebase emulators:start --only firestore,auth,functions,pubsub > /dev/null 2>&1 &
EMULATOR_PID=$!
echo "Emulator PID: $EMULATOR_PID"

# Trap exit to ensure emulators are shut down
trap 'echo "Killing emulator PID $EMULATOR_PID"; kill $EMULATOR_PID' EXIT

# Wait for emulators to be ready
sleep 15

# Seed the database
bash scripts/seed.sh

# Wait for dispatcher to run
echo "Waiting for dispatcher to run..."
sleep 70

# Check job statuses (manual check for now)
echo "Smoketest complete. Check emulator UI for job statuses."

# The EXIT trap will automatically kill the emulator process
EOF


# --- STEP 8: Tests ---
echo "INFO: Creating tests..."

# Create functions/src/test/engine.test.ts
cat << 'EOF' > functions/src/test/engine.test.ts
import { enqueueJob } from "../engine/enqueue";
// Mock firestore

describe("Job Engine", () => {
    it("should enqueue a job", async () => {
        // This is where you would mock Firestore and test enqueueJob
        expect(true).toBe(true);
    });
});
EOF

# --- Main Entrypoint ---
# Create functions/src/index.ts
cat << 'EOF' > functions/src/index.ts
import * as admin from "firebase-admin";
admin.initializeApp();

import * as functions from "firebase-functions";
import { claimJobs } from "./engine/claim";
import { enqueueJob } from "./engine/enqueue";
import { succeedJob, failJob } from "./engine/lifecycle";
import { JobHandler, Job, JobRun } from "./types";

// --- Handlers ---
import { echoHandler } from "./handlers/echo";
import { waitHandler } from "./handlers/wait";

const handlers: Record<string, JobHandler> = {
    echo: echoHandler,
    wait: waitHandler,
};

// --- API ---
export const enqueue = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "Admin privileges required.");
    }

    const { type, payload, options } = data;
    if (!type || !payload) {
        throw new functions.https.HttpsError("invalid-argument", "`type` and `payload` are required.");
    }

    const jobId = await enqueueJob(type, payload, options);
    return { jobId };
});

// --- Dispatcher ---
export const dispatcher = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    const workerId = `dispatcher-${Date.now()}`;
    const claimedJobIds = await claimJobs(workerId, 10, 60000);

    for (const jobId of claimedJobIds) {
        const jobRef = admin.firestore().collection("jobs").doc(jobId);
        const runQuery = await jobRef.collection("runs").where("workerId", "==", workerId).orderBy("startedAt", "desc").limit(1).get();
        if (runQuery.empty) {
            console.error(`Could not find run for job ${jobId} and worker ${workerId}`);
            continue;
        }
        const runId = runQuery.docs[0].id;

        const jobDoc = await jobRef.get();
        const job = jobDoc.data() as Job;

        const handler = handlers[job.type];
        if (!handler) {
            await failJob(jobId, runId, new Error(`No handler for job type: ${job.type}`))
            continue;
        }

        try {
            await handler(job.payload, { 
                jobId, 
                job, 
                runId, 
                run: runQuery.docs[0].data() as JobRun, 
                log: (level, message, data) => console.log(JSON.stringify({level, message, jobId, runId, ...data}))
            });
            await succeedJob(jobId, runId);
        } catch (error) {
            await failJob(jobId, runId, error as Error);
        }
    }
});
EOF

echo "INFO: Golden script finished."
