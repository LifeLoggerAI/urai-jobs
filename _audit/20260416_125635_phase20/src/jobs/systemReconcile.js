"use strict";
// URAI-JOBS: System Reconciliation (Retry, Dead-letter, Lease Recovery)
// Version: 1.0.0
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
exports.systemReconcile = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_paths_1 = require("../core/firestore-paths");
const MAX_RETRIES = 3;
const LEASE_STALE_MINUTES = 10; // When a RUNNING job is considered stale
/**
 * Resets a job to PENDING or moves it to the DEAD state if retries are exhausted.
 */
async function _resetOrDeadLetterJob(db, jobId, reason) {
    return db.runTransaction(async (transaction) => {
        const jobRef = (0, firestore_paths_1.jobDoc)(jobId);
        const jobSnapshot = await transaction.get(jobRef);
        const jobData = jobSnapshot.data();
        if (!jobData) {
            console.warn(`Cannot reconcile job ${jobId}: master document not found.`);
            // If the master doc is gone, ensure the queue doc is also gone.
            transaction.delete((0, firestore_paths_1.jobQueueEntryDoc)(jobId));
            return;
        }
        const retryCount = jobData.retryCount || 0;
        if (retryCount >= MAX_RETRIES) {
            console.warn(`Job ${jobId} has exhausted all retries. Moving to DEAD state. Reason: ${reason}`);
            const result = {
                status: 'DEAD',
                error: { message: `Job failed after ${MAX_RETRIES + 1} attempts. Last reason: ${reason}` },
                finishedAt: firestore_1.Timestamp.now(),
            };
            transaction.update(jobRef, {
                status: 'DEAD',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                lease: firestore_1.FieldValue.delete(),
                result,
            });
            transaction.delete((0, firestore_paths_1.jobQueueEntryDoc)(jobId)); // Remove from queue permanently
        }
        else {
            console.log(`Retrying job ${jobId}. Attempt #${retryCount + 1}. Reason: ${reason}`);
            transaction.update(jobRef, {
                status: 'PENDING',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                retryCount: firestore_1.FieldValue.increment(1),
                lease: firestore_1.FieldValue.delete(),
            });
            // Also reset the queue entry
            transaction.update((0, firestore_paths_1.jobQueueEntryDoc)(jobId), {
                status: 'PENDING',
                lease: firestore_1.FieldValue.delete(),
            });
        }
    });
}
/**
 * Finds LEASED jobs with expired leases and resets them.
 */
async function reconcileExpiredLeases(db) {
    const now = firestore_1.Timestamp.now();
    const query = (0, firestore_paths_1.jobQueueCollection)()
        .where('status', '==', 'LEASED')
        .where('lease.expiresAt', '<', now);
    const snapshot = await query.get();
    if (snapshot.empty)
        return;
    console.log(`Found ${snapshot.size} jobs with expired leases.`);
    const promises = snapshot.docs.map(doc => _resetOrDeadLetterJob(db, doc.id, 'Lease expired').catch(e => console.error(`Error reconciling lease for job ${doc.id}`, e)));
    await Promise.all(promises);
}
/**
 * Finds RUNNING jobs with stale heartbeats and resets them.
 */
async function reconcileStaleRunners(db) {
    const staleThreshold = firestore_1.Timestamp.fromMillis(Date.now() - LEASE_STALE_MINUTES * 60 * 1000);
    // NOTE: This query requires a composite index on (status, lease.heartbeatAt)
    const query = (0, firestore_paths_1.jobsCollection)()
        .where('status', '==', 'RUNNING')
        .where('lease.heartbeatAt', '<', staleThreshold);
    const snapshot = await query.get();
    if (snapshot.empty)
        return;
    console.log(`Found ${snapshot.size} jobs with stale heartbeats.`);
    const promises = snapshot.docs.map(doc => _resetOrDeadLetterJob(db, doc.id, 'Heartbeat stale').catch(e => console.error(`Error reconciling heartbeat for job ${doc.id}`, e)));
    await Promise.all(promises);
}
/**
 * A scheduled function that runs periodically to find and fix stuck jobs.
 */
exports.systemReconcile = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log('Starting system reconciliation...');
    const db = (0, firestore_1.getFirestore)();
    const results = await Promise.allSettled([
        reconcileExpiredLeases(db),
        reconcileStaleRunners(db),
    ]);
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Reconciliation task ${index} failed:`, result.reason);
        }
    });
    console.log('Finished system reconciliation.');
});
