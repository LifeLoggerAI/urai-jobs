"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpHealth = exports.scheduledDailyDigest = exports.adminSetApplicationStatus = exports.createResumeUpload = exports.onApplicationCreate = exports.onJobWrite = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const uuid_1 = require("uuid");
admin.initializeApp();
// ... (onJobWrite and onApplicationCreate functions remain the same)
exports.onJobWrite = functions.firestore
    .document("jobs/{jobId}")
    .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data();
    if (job && job.status === "open") {
        await admin.firestore().collection("jobPublic").doc(jobId).set(job);
    }
    else {
        await admin.firestore().collection("jobPublic").doc(jobId).delete();
    }
});
exports.onApplicationCreate = functions.firestore
    .document("applications/{applicationId}")
    .onCreate(async (snap, context) => {
    const application = snap.data();
    const { jobId, applicantEmail } = application;
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
        entityId: context.params.applicationId,
        metadata: { jobId, applicantEmail },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Increment job stats
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    await jobRef.update({
        "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
    });
});
// This function now creates a secure upload token
exports.createResumeUpload = functions.https.onCall(async (data, context) => {
    var _a;
    const { applicantId, applicationId, filename, contentType, size } = data;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
    }
    // Validate input
    if (!applicantId || !applicationId || !filename || !contentType || !size) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    // TODO: Add more robust validation (e.g., file type, size)
    const token = (0, uuid_1.v4)();
    const expires = Date.now() + 1000 * 60 * 5; // 5-minute expiry
    await admin.firestore().collection("uploadTokens").doc(token).set({
        applicantId,
        applicationId,
        filename,
        contentType,
        size,
        uid,
        expires: admin.firestore.Timestamp.fromMillis(expires),
    });
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;
    return { token, path };
});
exports.adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const adminRef = admin.firestore().collection("admins").doc(context.auth.uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
        throw new functions.https.HttpsError("permission-denied", "The function must be called by an admin.");
    }
    const { applicationId, status, tags, rating } = data;
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
});
exports.scheduledDailyDigest = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
    const today = new Date().toISOString().slice(0, 10);
    const newApplications = await admin.firestore().collection("applications").where("submittedAt", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000)).get();
    const pendingApplications = await admin.firestore().collection("applications").where("status", "in", ["NEW", "SCREEN"]).get();
    const topJobs = await admin.firestore().collection("jobs").orderBy("stats.applicantsCount", "desc").limit(5).get();
    await admin.firestore().collection("digests").doc(today).set({
        newApplications: newApplications.size,
        pendingApplications: pendingApplications.size,
        topJobs: topJobs.docs.map((doc) => doc.data()),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
exports.httpHealth = functions.https.onRequest((req, res) => {
    res.status(200).send("OK");
});
//# sourceMappingURL=index.js.map