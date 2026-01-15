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
exports.createResumeUploadUrl = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const storage = admin.storage();
const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";
exports.createResumeUploadUrl = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const { uid } = context.auth;
    const { applicationId, filename, contentType } = data;
    if (!applicationId || !filename || !contentType) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    // Validate file type and size on the client, but enforce here too.
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(contentType)) {
        throw new functions.https.HttpsError("invalid-argument", "Unsupported file type.");
    }
    const filePath = `resumes/${uid}/${applicationId}/${filename}`;
    const file = storage.bucket(BUCKET_NAME).file(filePath);
    const options = {
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
    };
    try {
        const [url] = await file.getSignedUrl(options);
        return { url, storagePath: filePath };
    }
    catch (error) {
        functions.logger.error("Error creating signed URL:", error);
        throw new functions.https.HttpsError("internal", "Could not create upload URL.");
    }
});
//# sourceMappingURL=createResumeUpload.js.map