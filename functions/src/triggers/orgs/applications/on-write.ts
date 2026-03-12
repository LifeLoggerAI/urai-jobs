import { firestore } from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const onApplicationUpdate = firestore.document('/orgs/{orgId}/applications/{applicationId}').onUpdate(async (change, context) => {
  const { orgId } = context.params;
  const beforeData = change.before.data();
  const afterData = change.after.data();

  // If the status has not changed, do nothing
  if (beforeData.status === afterData.status) {
    return null;
  }

  const db = admin.firestore();
  const jobRef = db.collection('orgs').doc(orgId).collection('jobs').doc(afterData.jobId);

  // Update the status counts in the job statistics
  return db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    if (!jobDoc.exists) {
      console.error(`Job document ${afterData.jobId} not found in organization ${orgId}`);
      return;
    }

    const jobData = jobDoc.data();
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    const statusCounts = jobData.stats?.statusCounts || {};

    const updateData = {
      'stats.statusCounts': {
        ...statusCounts,
        [oldStatus]: admin.firestore.FieldValue.increment(-1),
        [newStatus]: admin.firestore.FieldValue.increment(1),
      },
    };

    transaction.update(jobRef, updateData);
  });
});
