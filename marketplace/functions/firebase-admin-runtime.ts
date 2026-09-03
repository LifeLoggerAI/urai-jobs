import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readMarketplaceEnv } from './env';

export const initializeMarketplaceAdminRuntime = () => {
  const env = readMarketplaceEnv();

  if (getApps().length === 0) {
    initializeApp({
      credential:
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
          ? cert({
              projectId: env.firebaseProjectId,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            })
          : undefined,
      projectId: env.firebaseProjectId,
      storageBucket: env.storageBucket,
    });
  }

  return {
    ok: true,
    auth: getAuth(),
    firestore: getFirestore(),
    storage: getStorage(),
    state: 'firebase-admin-runtime-enabled',
  };
};
