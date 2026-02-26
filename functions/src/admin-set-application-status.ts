
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Event } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  // 1. Admin-Only Access
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }

  const adminRef = db.collection('admins').doc(context.auth.uid);
  const adminDoc = await adminRef.get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'You are not authorized to perform this action.');
  }

  const { applicationId, status, tags, rating } = data;

  // 2. Input Validation
  if (!applicationId || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
  }

  const applicationRef = db.collection('applications').doc(applicationId);

  // 3. Application Update
  const updateData: any = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tags) {
    updateData.tags = tags;
  }

  if (rating) {
    updateData['internal.rating'] = rating;
    updateData['internal.reviewerId'] = context.auth.uid;
    updateData['internal.reviewedAt'] = admin.firestore.FieldValue.serverTimestamp();
  }

  await applicationRef.update(updateData);

  // 4. Event Logging
  const event: Event = {
    id: uuidv4(),
    type: 'status_changed',
    entityType: 'application',
    entityId: applicationId,
    metadata: { newStatus: status, adminId: context.auth.uid },
    createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
  };
  await db.collection('events').add(event);

  return { success: true };
});
