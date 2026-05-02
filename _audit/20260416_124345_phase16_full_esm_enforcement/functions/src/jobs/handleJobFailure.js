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
exports.handleJobFailure = void 0;
const admin = __importStar(require("firebase-admin"));
const lease_1 = require("../core/lease");
const logging_1 = require("../core/logging");
const errors_1 = require("../core/errors");
const db = admin.firestore();
const handleJobFailure = async (jobId, error) => {
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = (await jobRef.get()).data();
    const attemptCount = jobDoc.execution.attemptCount + 1;
    const isTransient = (error instanceof errors_1.URAI_Error && error.category === 'TRANSIENT');
    if (isTransient && attemptCount < jobDoc.execution.maxAttempts) {
        const backoff = Math.pow(2, attemptCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        const availableAt = admin.firestore.Timestamp.fromMillis(Date.now() + backoff);
        await (0, lease_1.updateJob)(jobId, {
            status: 'RETRY',
            'execution.attemptCount': attemptCount,
            'error.lastFailedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        await (0, lease_1.updateQueue)(jobId, { status: 'READY', availableAt, attemptCount });
        await (0, logging_1.createLog)(jobDoc.tenantId, 'WARN', 'WORKER', 'JobRetry', `Job ${jobId} failed, will retry. Attempt ${attemptCount}/${jobDoc.execution.maxAttempts}`, { error: error.message });
    }
    else {
        await (0, lease_1.updateJob)(jobId, { status: 'DEAD', 'error.message': error.message });
        await (0, lease_1.updateQueue)(jobId, { status: 'DEAD' });
        await (0, logging_1.createLog)(jobDoc.tenantId, 'ERROR', 'WORKER', 'JobDead', `Job ${jobId} has been moved to the dead-letter queue after ${attemptCount} attempts.`, { error: error.message });
    }
};
exports.handleJobFailure = handleJobFailure;
