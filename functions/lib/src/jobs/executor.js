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
exports.executor = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const types_1 = require("./types");
const audit_1 = require("./audit");
const db = admin.firestore();
exports.executor = functions.firestore.document('jobs/{jobId}').onUpdate(async (change, context) => {
    const jobData = change.after.data();
    const previousJobData = change.before.data();
    const jobId = context.params.jobId;
    // Only execute when status changes to 'processing'
    if (jobData.status !== 'processing' || previousJobData.status === 'processing') {
        return;
    }
    const jobRef = db.collection('jobs').doc(jobId);
    await (0, audit_1.recordAuditLog)(jobId, `Job execution started.`, { from: previousJobData.status, to: jobData.status });
    // --- Idempotency Check ---
    if (jobData.idempotencyKey) {
        const idempotencyRef = db.collection('idempotency_keys').doc(jobData.idempotencyKey);
        try {
            await db.runTransaction(async (transaction) => {
                var _a;
                const idemDoc = await transaction.get(idempotencyRef);
                if (idemDoc.exists) {
                    const originalJobId = (_a = idemDoc.data()) === null || _a === void 0 ? void 0 : _a.jobId;
                    firebase_functions_1.logger.warn(`Idempotency key ${jobData.idempotencyKey} already processed for job ${originalJobId}. Marking duplicate job ${jobId} as completed.`);
                    transaction.update(jobRef, {
                        status: 'completed',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        notes: `Duplicate of job ${originalJobId}`
                    });
                    // Short-circuit execution if it's a duplicate
                    throw new Error('DUPLICATE_JOB');
                }
                else {
                    transaction.create(idempotencyRef, {
                        jobId: jobId,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        }
        catch (error) {
            if (error.message === 'DUPLICATE_JOB') {
                await (0, audit_1.recordAuditLog)(jobId, `Job identified as a duplicate.`, { from: jobData.status, to: 'completed' });
                return; // Stop execution for duplicate
            }
            firebase_functions_1.logger.error(`Error during idempotency check for job ${jobId}:`, error);
            // Optionally fail the job if the check itself fails
            await jobRef.update({ status: 'failed', error: 'Idempotency check failed.' });
            return;
        }
    }
    // --- Job Validation ---
    const validationResult = types_1.JobSchema.safeParse(jobData);
    if (!validationResult.success) {
        firebase_functions_1.logger.error(`Job ${jobId} failed validation`, validationResult.error);
        await jobRef.update({
            status: 'failed',
            error: validationResult.error.flatten(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await (0, audit_1.recordAuditLog)(jobId, `Job validation failed.`, { from: jobData.status, to: 'failed' });
        return;
    }
    const job = validationResult.data;
    // --- Job Execution Logic ---
    try {
        firebase_functions_1.logger.log(`Executing job ${jobId} of type ${job.jobType}`);
        // Increment retry counter in a transaction to be safe
        await db.runTransaction(async (transaction) => {
            var _a;
            const jobDoc = await transaction.get(jobRef);
            if (!jobDoc.exists)
                return;
            const currentRetries = ((_a = jobDoc.data()) === null || _a === void 0 ? void 0 : _a.retries) || 0;
            transaction.update(jobRef, { retries: currentRetries + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        // TODO: Replace with actual long-running job logic
        switch (job.jobType) {
            case 'render':
                firebase_functions_1.logger.info(`Rendering video from ${job.payload.sourceUrl}`);
                break;
            case 'clip':
                firebase_functions_1.logger.info(`Clipping video: ${job.payload.sourceUrl}`);
                break;
            case 'analyze':
                firebase_functions_1.logger.info(`Analyzing video: ${job.payload.sourceUrl}`);
                break;
            case 'notify':
                firebase_functions_1.logger.info(`Sending notification to ${job.payload.userId}`);
                break;
        }
        // --- Completion ---
        await jobRef.update({
            status: 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await (0, audit_1.recordAuditLog)(jobId, `Job execution completed successfully.`, { from: job.status, to: 'completed' });
    }
    catch (error) {
        firebase_functions_1.logger.error(`Job ${jobId} failed execution`, error);
        await jobRef.update({
            status: 'failed',
            error: { message: error.message || 'Unknown execution error' },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await (0, audit_1.recordAuditLog)(jobId, `Job execution failed.`, { from: job.status, to: 'failed' });
    }
});
//# sourceMappingURL=executor.js.map