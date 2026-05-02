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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const logging_1 = require("../core/logging");
const lease_1 = require("../core/lease");
const errors_1 = require("../core/errors");
const handleJobFailure_1 = require("./handleJobFailure");
const results_1 = require("../core/results");
const db = admin.firestore();
const NARRATOR_WORKER_URL = process.env.NARRATOR_WORKER_URL;
// This function would be triggered by an event (e.g., Pub/Sub) carrying the jobId and leaseToken
exports.executeJob = functions.https.onCall(async (data, context) => {
    const { jobId, leaseToken } = data;
    try {
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = (await jobRef.get()).data();
        if (!jobDoc || jobDoc.execution.leaseToken !== leaseToken) {
            throw new errors_1.URAI_Error('LeaseInvalid', 'AUTH', 'Invalid job ID or lease token.');
        }
        await (0, lease_1.updateJob)(jobId, { status: 'RUNNING', 'execution.startedAt': admin.firestore.FieldValue.serverTimestamp() });
        await (0, logging_1.createLog)(jobDoc.tenantId, 'INFO', 'WORKER', 'JobExecutionStarted', `Execution started for job ${jobId}`);
        if (!NARRATOR_WORKER_URL) {
            throw new Error('NARRATOR_WORKER_URL environment variable not set.');
        }
        const response = await axios_1.default.post(`${NARRATOR_WORKER_URL}/execute-job`, jobDoc);
        const result = response.data;
        await (0, results_1.updateJobResult)(jobId, 'SUCCESS', result);
        await (0, lease_1.updateQueue)(jobId, { status: 'DONE' });
        await (0, logging_1.createLog)(jobDoc.tenantId, 'INFO', 'WORKER', 'JobExecutionSuccess', `Execution successful for job ${jobId}`);
        return { success: true };
    }
    catch (error) {
        (0, errors_1.logError)(error);
        await (0, handleJobFailure_1.handleJobFailure)(jobId, error);
        return { success: false };
    }
});
