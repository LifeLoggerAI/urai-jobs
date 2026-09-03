export type MarketplaceHealthResponse = {
  ok: boolean;
  service: string;
  launchState: string;
  timestamp: string;
};

export const marketplaceHealth = async (): Promise<MarketplaceHealthResponse> => {
  return {
    ok: true,
    service: 'urai-jobs-marketplace',
    launchState: 'launch-gated',
    timestamp: new Date().toISOString(),
  };
};

export const notImplemented = (route: string) => {
  return {
    ok: false,
    code: 'MARKETPLACE_NOT_IMPLEMENTED',
    route,
    message:
      'Marketplace workflow not implemented yet. See docs/marketplace for contracts and launch requirements.',
  };
};

export const getJobs = async () => notImplemented('/api/marketplace/jobs');

export const getJobDetail = async () =>
  notImplemented('/api/marketplace/jobs/:jobId');

export const createCandidateProfile = async () =>
  notImplemented('/api/marketplace/profiles');

export const createApplication = async () =>
  notImplemented('/api/marketplace/applications');

export const createEmployer = async () =>
  notImplemented('/api/marketplace/employers');

export const adminReviewQueue = async () =>
  notImplemented('/api/marketplace/admin/review-queue');
