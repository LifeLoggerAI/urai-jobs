import { readMarketplaceEnv } from './env';

let initialized = false;

export const initializeMarketplaceFirebaseAdmin = () => {
  const env = readMarketplaceEnv();

  if (initialized) {
    return {
      ok: true,
      reused: true,
      projectId: env.firebaseProjectId,
    };
  }

  initialized = true;

  return {
    ok: true,
    reused: false,
    projectId: env.firebaseProjectId,
    storageBucket: env.storageBucket,
    launchApproved: env.launchApproved,
    state: 'firebase-admin-scaffolded',
  };
};
