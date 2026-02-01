"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.worker = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_admin_1 = require("firebase-admin");
const db = admin.firestore();
const leaseRun = async () => {
    const now = firebase_admin_1.firestore.Timestamp.now();
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
        const leaseExpiresAt = firebase_admin_1.firestore.Timestamp.fromMillis(now.toMillis() + leaseSeconds * 1000);
        transaction.update(runDoc.ref, {
            status: "leased",
            leaseExpiresAt,
            workerId: "local-worker", // Replace with actual worker ID
        });
        return { run: Object.assign({ id: runDoc.id }, runDoc.data()), job };
    });
};
const executeRun = async (run, job) => {
    var _a;
    await db.collection("jobRuns").doc(run.id).update({ status: "running", startedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() });
    try {
        // Simulate work
        console.log(`Executing job: ${job.name}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        await db.collection("jobRuns").doc(run.id).update({ status: "succeeded", finishedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() });
    }
    catch (error) {
        console.error("Job execution failed:", error);
        const runDoc = await db.collection("jobRuns").doc(run.id).get();
        const currentAttempt = ((_a = runDoc.data()) === null || _a === void 0 ? void 0 : _a.attempt) || 0;
        if (currentAttempt < job.maxRetries) {
            await db.collection("jobRuns").doc(run.id).update({
                status: "queued",
                attempt: currentAttempt + 1,
            });
        }
        else {
            await db.collection("jobRuns").doc(run.id).update({
                status: "failed",
                finishedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
                error: { message: error.message },
            });
            // Move to deadletter queue
            await db.collection("jobDeadletter").add(Object.assign(Object.assign({}, runDoc.data()), { error: { message: error.message } }));
        }
    }
};
exports.worker = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
    const leased = await leaseRun();
    if (leased) {
        const { run, job } = leased;
        await executeRun(run, job);
    }
});
//# sourceMappingURL=worker.js.map