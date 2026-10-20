export type MarketplaceEnv = {
  firebaseProjectId: string; storageBucket: string; allowedOrigin: string; launchApproved: boolean;
};

export const readMarketplaceEnv = (source: Record<string, string | undefined> = process.env): MarketplaceEnv => {
  const required = (key: string): string => {
    const value = source[key]?.trim();
    if (!value) throw new Error('MARKETPLACE_ENV_MISSING:' + key);
    return value;
  };
  return { firebaseProjectId: required('URAI_JOBS_FIREBASE_PROJECT_ID'),
    storageBucket: required('URAI_JOBS_STORAGE_BUCKET'), allowedOrigin: required('URAI_JOBS_ALLOWED_ORIGIN'),
    launchApproved: source.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED === 'true' };
};
