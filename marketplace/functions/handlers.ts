import type { CandidateProfile } from '../shared/types';
import {
  createApplication,
  getCandidateProfile,
  getPublishedJob,
  listCandidateApplications,
  listPublishedJobs,
  upsertCandidateProfile,
} from './services';

export const healthHandler = async () => {
  return {
    ok: true,
    service: 'urai-jobs-marketplace',
    launchState: 'launch-gated',
    timestamp: new Date().toISOString(),
  };
};

export const listJobsHandler = async () => {
  return {
    ok: true,
    jobs: listPublishedJobs(),
  };
};

export const getJobHandler = async (jobIdOrSlug: string) => {
  const job = getPublishedJob(jobIdOrSlug);

  if (!job) {
    return {
      ok: false,
      code: 'JOB_NOT_FOUND',
    };
  }

  return {
    ok: true,
    job,
  };
};

export const upsertProfileHandler = async (
  profile: CandidateProfile,
) => {
  return {
    ok: true,
    profile: upsertCandidateProfile(profile),
  };
};

export const getProfileHandler = async (uid: string) => {
  const profile = getCandidateProfile(uid);

  if (!profile) {
    return {
      ok: false,
      code: 'PROFILE_NOT_FOUND',
    };
  }

  return {
    ok: true,
    profile,
  };
};

export const createApplicationHandler = async (input: {
  jobId: string;
  employerId: string;
  candidateUid: string;
  resumePath?: string;
  answers: Record<string, string>;
}) => {
  const job = getPublishedJob(input.jobId);

  if (!job) {
    return {
      ok: false,
      code: 'JOB_NOT_FOUND',
    };
  }

  try {
    const application = createApplication(input);

    return {
      ok: true,
      application,
    };
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof Error ? error.message : 'APPLICATION_CREATE_FAILED',
    };
  }
};

export const listMyApplicationsHandler = async (uid: string) => {
  return {
    ok: true,
    applications: listCandidateApplications(uid),
  };
};
