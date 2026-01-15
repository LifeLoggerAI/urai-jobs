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
exports.onJobWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.onJobWrite = functions.firestore
    .document("jobs/{jobId}")
    .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const jobPublicRef = db.collection("jobPublic").doc(jobId);
    const jobAfter = change.after.data();
    // If job is deleted or status is not 'open', delete the public doc.
    if (!jobAfter || jobAfter.status !== "open") {
        try {
            await jobPublicRef.delete();
            functions.logger.info(`Deleted public job: ${jobId}`);
        }
        catch (error) {
            // Ignore if the doc doesn't exist
            if (error.code !== 'not-found') {
                functions.logger.error(`Error deleting public job ${jobId}:`, error);
            }
        }
        return;
    }
    // If job is 'open', create/update the public-facing document.
    const { createdBy, ...restOfJob } = jobAfter;
    const publicJob = {
        ...restOfJob,
        status: "open", // Ensure status is explicitly open
        updatedAt: jobAfter.updatedAt, // Carry over the update time
    };
    functions.logger.info(`Updating public job: ${jobId}`);
    await jobPublicRef.set(publicJob, { merge: true });
});
//# sourceMappingURL=onJobWrite.js.map