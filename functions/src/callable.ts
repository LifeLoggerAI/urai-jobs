import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';

// Helper to check for admin privileges
async function isAdmin(uid: string): Promise<boolean> {
  const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
  return adminDoc.exists;
}

export const createResumeUploadUrl = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to upload a resume.');
  }

  const { applicantId, applicationId, filename, contentType } = request.data;
  const uid = request.auth.uid;

  if (uid !== applicantId) {
    throw new functions.https.HttpsError('permission-denied', 'You can only upload a resume for yourself.');
  }

  const bucket = getStorage().bucket();
  const path = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(path);

  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires,
    contentType,
  });

  return { url, path };
});

export const adminSetApplicationStatus = onCall(async (request) => {
  if (!request.auth || !(await isAdmin(request.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to perform this action.');
  }

  const { applicationId, status, tags, rating } = request.data;

  const applicationRef = admin.firestore().collection('applications').doc(applicationId);

  const updateData: any = {
    status: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tags) {
    updateData.tags = tags;
  }

  if (rating) {
    updateData['internal.rating'] = rating;
  }

  await applicationRef.update(updateData);

  await admin.firestore().collection('events').add({
    type: 'status_changed',
    entityType: 'application',
    entityId: applicationId,
    metadata: {
      newStatus: status,
      adminId: request.auth.uid,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
