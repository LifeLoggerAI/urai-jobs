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
exports.cleanupTerminalJobs = void 0;
// URAI-JOBS: Job Cleanup and Finalization
// Version: 1.0.0
const functions = __importStar(require("firebase-functions"));
const firestore_paths_1 = require("../core/firestore-paths");
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'DEAD'];
/**
 * This Firestore-triggered function watches for jobs entering a terminal state
 * and cleans up their corresponding entry in the jobQueue.
 */
exports.cleanupTerminalJobs = functions.firestore
    .document(`${firestore_paths_1.JOBS_COLLECTION}/{jobId}`)
    .onUpdate(async (change, context) => {
    const { jobId } = context.params;
    const before = change.before.data();
    const after = change.after.data();
    const beforeIsTerminal = TERMINAL_STATUSES.includes(before.status);
    const afterIsTerminal = TERMINAL_STATUSES.includes(after.status);
    // --- Trigger Condition ---
    // Only act if the job has *entered* a terminal state.
    if (beforeIsTerminal || !afterIsTerminal) {
        return;
    }
    console.log(`Job ${jobId} entered terminal state '${after.status}'. Cleaning up queue entry.`);
    try {
        const queueRef = (0, firestore_paths_1.jobQueueEntryDoc)(jobId);
        await queueRef.delete();
        console.log(`Successfully deleted queue entry for job ${jobId}.`);
    }
    catch (error) {
        // This error is generally safe to ignore, as it likely means the document
        // was already deleted (e.g., by handleJobFailure).
        console.warn(`Could not delete queue entry for job ${jobId}, it may have already been removed.`, error);
    }
});
