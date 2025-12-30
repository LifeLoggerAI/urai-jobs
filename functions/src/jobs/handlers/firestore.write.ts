
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { Job } from '../../types';

const FirestoreWritePayload = z.object({
  path: z.string().min(1),
  data: z.object({}).passthrough(),
  options: z.object({ merge: z.boolean().optional() }).optional(),
});

export const firestoreWrite = async (payload: unknown, job: Job) => {
  // Security check: Only admins should be able to run this.
  if (!job.createdBy?.uid || !job.createdBy.uid.startsWith('admin:')) {
      const user = await admin.auth().getUser(job.createdBy.uid!)
      if(!user.customClaims?.admin) {
          throw new Error('Permission denied: firestore.write can only be triggered by an admin.');
      }
  }

  const validation = FirestoreWritePayload.safeParse(payload);
  if (!validation.success) {
    throw new Error(`Invalid payload: ${validation.error.message}`);
  }

  const { path, data, options } = validation.data;

  await admin.firestore().doc(path).set(data, { merge: options?.merge === true });

  return { success: true, path, data };
};
