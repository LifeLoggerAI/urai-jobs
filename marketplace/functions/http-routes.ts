export const marketplaceRoutes = [
  {
    method: 'GET',
    path: '/api/marketplace/health',
    auth: 'public',
  },
  {
    method: 'GET',
    path: '/api/marketplace/jobs',
    auth: 'public',
  },
  {
    method: 'GET',
    path: '/api/marketplace/jobs/:jobId',
    auth: 'public',
  },
  {
    method: 'POST',
    path: '/api/marketplace/profiles',
    auth: 'candidate',
  },
  {
    method: 'POST',
    path: '/api/marketplace/resume-intent',
    auth: 'candidate',
  },
  {
    method: 'POST',
    path: '/api/marketplace/applications',
    auth: 'candidate',
  },
  {
    method: 'GET',
    path: '/api/marketplace/applications/me',
    auth: 'candidate',
  },
  {
    method: 'POST',
    path: '/api/marketplace/employers',
    auth: 'employer',
  },
  {
    method: 'GET',
    path: '/api/marketplace/admin/review-queue',
    auth: 'admin',
  },
];
