import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

async function checkAdmin(context: functions.https.CallableContext) {
    const isAdmin = context.auth?.token.admin === true || process.env.FUNCTIONS_EMULATOR === 'true';
    if (!isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "User must be an admin.");
    }
}

export async function cancelJob(data: any, context: functions.https.CallableContext) {
    await checkAdmin(context);

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError("invalid-argument", "`jobId` is required.");
    }

    const db = admin.firestore();
    const jobRef = db.collection('jobs').doc(jobId);
    const now = admin.firestore.Timestamp.now();

    await jobRef.update({ status: 'CANCELLED', updatedAt: now });

    return { success: true };
}

export async function requeueJob(data: any, context: functions.https.CallableContext) {
    await checkAdmin(context);

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError("invalid-argument", "`jobId` is required.");
    }

    const db = admin.firestore();
    const jobRef = db.collection('jobs').doc(jobId);
    const now = admin.firestore.Timestamp.now();

    await jobRef.update({ status: 'PENDING', updatedAt: now, runAfter: now });

    return { success: true };
}
