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
exports.retryExpiredLeases = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const logging_1 = require("../core/logging");
const handleJobFailure_1 = require("./handleJobFailure");
const lease_1 = require("../core/lease");
const db = admin.firestore();
exports.retryExpiredLeases = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const query = db.collection('jobQueue')
        .where('status', '==', 'LEASED')
        .where('leaseExpiresAt', '<=', now);
    const snapshot = await query.get();
    if (snapshot.empty) {
        return;
    }
    for (const doc of snapshot.docs) {
        const queueDoc = doc.data();
        const jobId = queueDoc.jobId;
        try {
            const jobRef = db.collection('jobs').doc(jobId);
            const jobDoc = (await jobRef.get()).data();
            if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(jobDoc.status)) {
                // Job is already in a terminal state, just clean up the queue item
                await (0, lease_1.updateQueue)(jobId, { status: 'DONE' });
                continue;
            }
            await (0, logging_1.createLog)(jobDoc.tenantId, 'WARN', 'SYSTEM', 'ExpiredLeaseFound', `Job ${jobId} has an expired lease. Attempting to requeue or fail.`);
            // Re-use the failure handler to determine if it should be retried or moved to dead-letter
            await (0, handleJobFailure_1.handleJobFailure)(jobId, new Error('Lease expired and job was not completed.'));
        }
        catch (error) {
            console.error(`Failed to process expired lease for job ${jobId}:`, error);
        }
    }
});
