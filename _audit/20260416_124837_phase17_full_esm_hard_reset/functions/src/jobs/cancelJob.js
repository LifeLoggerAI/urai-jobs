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
exports.cancelJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("../core/auth");
const logging_1 = require("../core/logging");
const lease_1 = require("../core/lease");
const errors_1 = require("../core/errors");
exports.cancelJob = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { jobId } = data;
    try {
        const authContext = await (0, auth_1.getAuthContext)(context.auth.uid);
        const jobRef = admin.firestore().collection('jobs').doc(jobId);
        const jobDoc = (await jobRef.get()).data();
        if (!jobDoc) {
            throw new errors_1.URAI_Error('NotFound', 'VALIDATION', 'Job not found');
        }
        if (jobDoc.requestedBy.uid === authContext.uid) {
            (0, auth_1.ensureHasPermission)(authContext, 'jobs.cancel.own');
        }
        else {
            (0, auth_1.ensureHasPermission)(authContext, 'jobs.cancel.any');
        }
        if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(jobDoc.status)) {
            return { status: jobDoc.status }; // Already terminal
        }
        await (0, lease_1.updateJob)(jobId, { status: 'CANCELLED', 'flags.cancelRequested': true });
        await (0, lease_1.updateQueue)(jobId, { status: 'DONE' });
        await (0, logging_1.createLog)(jobDoc.tenantId, 'INFO', 'API', 'JobCancelled', `Job ${jobId} was cancelled by user ${authContext.uid}.`);
        return { status: 'CANCELLED' };
    }
    catch (error) {
        (0, errors_1.logError)(error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'An internal error occurred while cancelling the job.');
    }
});
