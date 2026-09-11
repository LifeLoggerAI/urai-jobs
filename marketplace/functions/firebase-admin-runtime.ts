import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readMarketplaceEnv } from './env';

const FORBIDDEN_LONG_LIVED_FIREBASE_ENV = [
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
] as const;

export const initializeMarketplaceAdminRuntime = () => {
  const env = readMarketplaceEnv();
  const forbidden = FORBIDDEN_LONG_LIVED_FIREBASE_ENV.filter((name) => Boolean(process.env[name]?.trim()));
  if (forbidden.length) {
    throw new Error(
      `URAI Jobs marketplace rejects long-lived Firebase credential variables: ${forbidden.join(', ')}. Provider ADC/WIF is required.`,
    );
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
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
