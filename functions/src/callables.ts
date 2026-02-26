import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();
const storage = admin.storage();

/**
 * Checks if the user has the specified role for the given organization.
 * Throws an HttpsError if the user is not authorized.
 */
const ensureOrgRole = async (context: functions.https.CallableContext, orgId: string, allowedRoles: string[]) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }
    const uid = context.auth.uid;
    const adminRef = db.doc(`orgs/${orgId}/admins/${uid}`);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists || !allowedRoles.includes(adminDoc.data()?.role)) {
        throw new functions.https.HttpsError("permission-denied", "You do not have permission to perform this action.");
    }
};

/**
 * Creates a signed URL for uploading a resume.
 * The applicant must have a valid application.
 */
export const createResumeUploadUrl = functions.https.onCall(async (data, context) => {
    const { orgId, applicationId, filename, contentType } = data;

    if (!orgId || !applicationId || !filename || !contentType) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }

    // No auth check here, as we might have unauthenticated applicants
    // The security is handled by the existence of the application document
    // and the firestore rules on that document.

    const applicationRef = db.doc(`orgs/${orgId}/applications/${applicationId}`);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Application not found.");
    }

    const applicantId = applicationDoc.data()?.applicantId;
    if (!applicantId) {
        throw new functions.https.HttpsError("failed-precondition", "Applicant ID is missing from the application.");
    }

    const bucket = storage.bucket();
    const filePath = `orgs/${orgId}/resumes/${applicantId}/${applicationId}/${filename}`;
    const file = bucket.file(filePath);

    const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 minutes
    const [url] = await file.getSignedUrl({
        action: "write",
        expires: expiresAtMs,
        contentType,
    });

    return {
        uploadUrl: url,
        storagePath: filePath
    };
});

/**
 * Allows an admin to set the status of an application.
 * Logs an event for the status change.
 */
export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    const { orgId, applicationId, status, tags, rating } = data;

    if (!orgId || !applicationId || !status) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }

    await ensureOrgRole(context, orgId, ["admin", "reviewer"]);
    const uid = context.auth!.uid;

    const applicationRef = db.doc(`orgs/${orgId}/applications/${applicationId}`);
    const batch = db.batch();

    const updateData: { [key: string]: any } = {
        status,
        "internal.reviewerId": uid,
        "internal.reviewedAt": admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (tags && Array.isArray(tags)) {
        updateData.tags = tags;
    }

    if (rating && typeof rating === "number") {
        updateData["internal.rating"] = rating;
    }

    batch.update(applicationRef, updateData);

    // Log the event
    const eventRef = db.collection(`orgs/${orgId}/events`).doc();
    batch.set(eventRef, {
        orgId,
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status, changedBy: uid },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return { success: true };
});
