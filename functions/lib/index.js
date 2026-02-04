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
exports.api = exports.httpHealth = exports.scheduledDailyDigest = exports.adminSetApplicationStatus = exports.createResumeUpload = exports.onApplicationCreate = exports.onJobWrite = void 0;
const admin = __importStar(require("firebase-admin"));
// v2 providers
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const express = require("express");
// AUTO-FIX: define express app at top-level (must be in module scope)
const app = (express.default || express)();
// Ensure default app exists during deploy-time analysis
if (!admin.apps.length)
    admin.initializeApp();
/**
 * Mirror jobs -> jobPublic (same semantics as v1 onWrite)
 */
exports.onJobWrite = (0, firestore_1.onDocumentWritten)("jobs/{jobId}", async (event) => {
    var _a;
    const jobId = event.params.jobId;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    const job = (after === null || after === void 0 ? void 0 : after.exists) ? after.data() : undefined;
    const pubRef = admin.firestore().collection("jobPublic").doc(jobId);
    if (job && job.status === "open") {
        await pubRef.set(job);
    }
    else {
        await pubRef.delete();
    }
});
/**
 * On application create (same semantics as v1 onCreate)
 */
exports.onApplicationCreate = (0, firestore_1.onDocumentCreated)("applications/{applicationId}", async (event) => {
    var _a;
    const application = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!application)
        return;
    const { jobId, applicantEmail } = application;
    if (!jobId || !applicantEmail)
        return;
    // Create or update applicant
    const applicantRef = admin.firestore().collection("applicants").doc(applicantEmail);
    const applicantSnap = await applicantRef.get();
    if (applicantSnap.exists) {
        await applicantRef.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    else {
        await applicantRef.set({
            primaryEmail: applicantEmail,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // Record event
    await admin.firestore().collection("events").add({
        type: "application_submitted",
        entityType: "application",
        entityId: event.params.applicationId,
        metadata: { jobId, applicantEmail },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Increment job stats
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    await jobRef.update({
        "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
    });
});
/**
 * Callable: createResumeUpload (same semantics, v2 request signature)
 */
exports.createResumeUpload = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e;
    const data = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    const { applicantId, applicationId, filename, contentType, size } = data;
    const uid = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
    }
    if (!applicantId || !applicationId || !filename || !contentType || !size) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters.");
    }
    // Keep your existing token approach; uuidv4 existed before — but if it was removed, fall back.
    const token = (_e = (_d = (_c = globalThis.crypto) === null || _c === void 0 ? void 0 : _c.randomUUID) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const expiresMs = Date.now() + 1000 * 60 * 5; // 5 minutes
    await admin.firestore().collection("uploadTokens").doc(token).set({
        applicantId,
        applicationId,
        filename,
        contentType,
        size,
        uid,
        expires: admin.firestore.Timestamp.fromMillis(expiresMs),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;
    return { token, path };
});
/**
 * Callable: adminSetApplicationStatus (same semantics, v2 request signature)
 */
exports.adminSetApplicationStatus = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const data = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!((_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid)) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const adminRef = admin.firestore().collection("admins").doc(request.auth.uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "The function must be called by an admin.");
    }
    const { applicationId, status, tags, rating } = data;
    if (!applicationId) {
        throw new https_1.HttpsError("invalid-argument", "Missing applicationId.");
    }
    await admin.firestore().collection("applications").doc(applicationId).update({
        status,
        tags,
        "internal.rating": rating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await admin.firestore().collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { status },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
/**
 * Scheduled: daily digest (v2 scheduler). Cron is UTC.
 */
exports.scheduledDailyDigest = (0, scheduler_1.onSchedule)("0 0 * * *", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newApplications = await admin
        .firestore()
        .collection("applications")
        .where("submittedAt", ">=", since)
        .get();
    const pendingApplications = await admin
        .firestore()
        .collection("applications")
        .where("status", "in", ["NEW", "SCREEN"])
        .get();
    const topJobs = await admin
        .firestore()
        .collection("jobs")
        .orderBy("stats.applicantsCount", "desc")
        .limit(5)
        .get();
    await admin.firestore().collection("digests").doc(today).set({
        newApplications: newApplications.size,
        pendingApplications: pendingApplications.size,
        topJobs: topJobs.docs.map((doc) => doc.data()),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
/**
 * HTTP health endpoint (v2)
 */
exports.httpHealth = (0, https_1.onRequest)((req, res) => {
    res.status(200).send("OK");
});
// AUTO-FIX: express app required by api export
exports.api = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, app);
//# sourceMappingURL=index.js.map