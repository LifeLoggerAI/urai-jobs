import * as admin from 'firebase-admin';
import { JobDoc } from './types.js.js.js.js';

const db = admin.firestore();

export const findJobByIdempotencyKey = async (tenantId: string, type: string, key: string): Promise<JobDoc | null> => {
  const snapshot = await db.collection('jobs')
    .where('tenantId', '==', tenantId)
    .where('type', '==', type)
    .where('idempotencyKey', '==', key)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as JobDoc;
};
