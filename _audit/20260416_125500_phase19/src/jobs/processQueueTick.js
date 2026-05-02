"use strict";
// URAI-JOBS: Queue Claim / Lease Processor
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
exports.processQueueTick = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_paths_1 = require("../core/firestore-paths");
const lease_1 = require("../core/lease");
const MAX_JOBS_TO_LEASE_PER_TICK = 10;
/**
 * This scheduled function runs periodically to find PENDING jobs in the queue
 * and lease them for processing.
 */
exports.processQueueTick = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = (0, firestore_1.getFirestore)();
    const functionExecutionId = context.eventId;
    console.log('Starting queue processing tick...');
    const pendingJobsQuery = (0, firestore_paths_1.jobQueueCollection)()
        .where('status', '==', 'PENDING')
        .orderBy('createdAt')
        .limit(MAX_JOBS_TO_LEASE_PER_TICK);
    const pendingJobsSnapshot = await pendingJobsQuery.get();
    if (pendingJobsSnapshot.empty) {
        console.log('No pending jobs found.');
        return;
    }
    console.log(`Found ${pendingJobsSnapshot.size} pending job(s). Attempting to lease.`);
    const leasePromises = pendingJobsSnapshot.docs.map((doc) => {
        const { jobId } = doc.data();
        return db.runTransaction(async (transaction) => {
            const queueRef = (0, firestore_paths_1.jobQueueEntryDoc)(jobId);
            const masterJobRef = (0, firestore_paths_1.jobDoc)(jobId);
            const queueDoc = await transaction.get(queueRef);
            if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
                console.log(`Job ${jobId} is no longer available for lease. Skipping.`);
                return;
            }
            const lease = (0, lease_1.createLease)(functionExecutionId);
            const update = {
                status: 'LEASED',
                lease,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            transaction.update(queueRef, update);
            transaction.update(masterJobRef, update);
            console.log(`Successfully leased job ${jobId} with lease ${lease.leaseId}`);
        }).catch((error) => {
            console.error(`Failed to lease job ${jobId}.`, error);
        });
    });
    await Promise.all(leasePromises);
    console.log('Finished queue processing tick.');
});
