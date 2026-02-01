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
exports.enqueueRun = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_admin_1 = require("firebase-admin");
const db = admin.firestore();
exports.enqueueRun = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { jobId, params } = data;
    // TODO: Add validation
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Job with ID ${jobId} not found.`);
    }
    const job = jobDoc.data();
    const paramsHash = await hashParams(params);
    const idempotencyKey = `${jobId}-${paramsHash}`;
    if (job.idempotencyPolicy === 'byParamsHash') {
        const existingRuns = await db.collection('jobRuns')
            .where('idempotencyKey', '==', idempotencyKey)
            .where('status', 'in', ['queued', 'running', 'succeeded'])
            .get();
        if (!existingRuns.empty) {
            console.log(`Job run with idempotency key ${idempotencyKey} already exists.`);
            return { runId: existingRuns.docs[0].id };
        }
    }
    const run = {
        jobId,
        status: 'queued',
        queuedAt: firebase_admin_1.firestore.Timestamp.now(),
        startedAt: null,
        finishedAt: null,
        attempt: 0,
        params,
        paramsHash,
        idempotencyKey,
        leaseExpiresAt: null,
        workerId: null,
        error: null,
        metrics: {},
    };
    const runRef = await db.collection('jobRuns').add(run);
    return { runId: runRef.id };
});
async function hashParams(params) {
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(params));
    return hash.digest('hex');
}
//# sourceMappingURL=queue.js.map