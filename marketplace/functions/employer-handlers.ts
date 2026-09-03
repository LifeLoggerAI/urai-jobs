import { requireAdmin, requireEmployerMember } from './auth';
import type { MarketplaceAuthContext } from './auth';

export const createEmployerHandler = async (
  auth: MarketplaceAuthContext,
  input: {
    orgName: string;
    website?: string;
  },
) => {
  const uid = requireEmployerMember(
    {
      ...auth,
      employerIds: auth.employerIds ?? ['self-bootstrap'],
    },
    'self-bootstrap',
  );

  return {
    ok: true,
    employer: {
      id: `employer-${Date.now()}`,
      orgName: input.orgName,
      website: input.website,
      status: 'pending_review',
      createdBy: uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    launchState: 'launch-gated',
  };
};

export const employerApplicationsHandler = async (
  auth: MarketplaceAuthContext,
  employerId: string,
) => {
  requireEmployerMember(auth, employerId);

  return {
    ok: true,
    employerId,
    applications: [],
    launchState: 'launch-gated',
  };
};

export const adminReviewQueueHandler = async (
  auth: MarketplaceAuthContext,
) => {
  requireAdmin(auth);

  return {
    ok: true,
    queue: {
      pendingJobs: [],
      pendingEmployers: [],
    },
    launchState: 'launch-gated',
  };
};
