import { firestore } from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const onApplicationUpdate = firestore.document('/orgs/{orgId}/applications/{applicationId}').onUpdate(async (change, context) => {
  console.log(`Application ${context.params.applicationId} updated in org ${context.params.orgId}`);
  console.log('Before:', change.before.data());
  console.log('After:', change.after.data());
  return null;
});
