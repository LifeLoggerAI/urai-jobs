import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Job, jobAuditCollection } from '@urai-jobs/types';

admin.initializeApp();

export const onJobWritten = onDocumentWritten("jobs/{jobId}", (event) => {
  const { jobId } = event.params;
  const before = event.data?.before.data() as Job | undefined;
  const after = event.data?.after.data() as Job | undefined;

  const auditData = {
    jobId,
    before,
    after,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  return admin.firestore().collection(jobAuditCollection).add(auditData);
});
