export type MarketplaceEnv = {
  firebaseProjectId: string;
  storageBucket: string;
  allowedOrigin: string;
  launchApproved: boolean;
};

export const readMarketplaceEnv = (
  source: Record<string, string | undefined> = process.env,
): MarketplaceEnv => {
  const firebaseProjectId = source.URAI_JOBS_FIREBASE_PROJECT_ID;
  const storageBucket = source.URAI_JOBS_STORAGE_BUCKET;
  const allowedOrigin = source.URAI_JOBS_ALLOWED_ORIGIN;
  const launchApproved = source.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED === 'true';

  const missing = [
    ['URAI_JOBS_FIREBASE_PROJECT_ID', firebaseProjectId],
    ['URAI_JOBS_STORAGE_BUCKET', storageBucket],
    ['URAI_JOBS_ALLOWED_ORIGIN', allowedOrigin],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `MARKETPLACE_ENV_MISSING:${missing.map(([name]) => name).join(',')}`,
    );
  }

  return {
    firebaseProjectId,
    storageBucket,
    allowedOrigin,
    launchApproved,
  };
};
