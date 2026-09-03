import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { JobDoc } from './types.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();

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
