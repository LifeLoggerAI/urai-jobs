
import {z} from "zod";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {Handler} from "../../../types";

const FirestoreWritePayloadSchema = z.object({
  path: z.string(),
  data: z.record(z.unknown()),
  options: z.object({merge: z.boolean().optional()}).optional(),
});

export const firestoreWrite: Handler = async (payload, job) => {
  const {path, data, options} = FirestoreWritePayloadSchema.parse(payload);

  // Security: You might want to add allow-listing of paths here
  // based on job creator or other criteria.
  if (job.createdBy.uid) {
    // Can add user-specific logic here
  }

  const docRef = admin.firestore().doc(path);
  const writeData = {
    ...data,
    _updatedAt: FieldValue.serverTimestamp(),
    _updatedByJob: job.id,
  };

  await docRef.set(writeData, {merge: options?.merge || false});

  return {success: true, path, data: writeData};
};
