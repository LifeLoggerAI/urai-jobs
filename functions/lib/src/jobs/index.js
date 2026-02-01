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
exports.onJobRunCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// This is a placeholder for a more robust queueing system like Cloud Tasks.
exports.onJobRunCreated = functions.firestore
    .document("jobRuns/{runId}")
    .onCreate(async (snap, context) => {
    const run = snap.data();
    const { runId } = context.params;
    // In a real system, this would trigger a worker, e.g., by creating a Cloud Task.
    // For this example, we'll directly update the status to simulate execution.
    console.log(`Job run ${runId} created for job ${run.jobId}.`);
    // Simulate leasing the job
    await db.collection("jobRuns").doc(runId).update({
        status: "leased",
        leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 1000),
        workerId: "local-simulator",
    });
});
//# sourceMappingURL=index.js.map