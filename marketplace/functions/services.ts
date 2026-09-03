import type { CandidateProfile, JobApplication, MarketplaceJob } from '../shared/types';
import { seedJobs } from '../shared/seed-jobs';

const jobs = new Map<string, MarketplaceJob>();
const profiles = new Map<string, CandidateProfile>();
const applications = new Map<string, JobApplication>();

for (const job of seedJobs) {
  jobs.set(job.id, job);
}

export const listPublishedJobs = (): MarketplaceJob[] => {
  return [...jobs.values()].filter((job) => job.status === 'published');
};

export const getPublishedJob = (jobIdOrSlug: string): MarketplaceJob | null => {
  return (
    [...jobs.values()].find(
      (job) =>
        job.status === 'published' &&
        (job.id === jobIdOrSlug || job.slug === jobIdOrSlug),
    ) ?? null
  );
};

export const upsertCandidateProfile = (
  profile: CandidateProfile,
): CandidateProfile => {
  profiles.set(profile.uid, profile);
  return profile;
};

export const getCandidateProfile = (uid: string): CandidateProfile | null => {
  return profiles.get(uid) ?? null;
};

export const createApplication = (
  input: Omit<JobApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
): JobApplication => {
  const existing = [...applications.values()].find(
    (application) =>
      application.jobId === input.jobId &&
      application.candidateUid === input.candidateUid &&
      application.status !== 'withdrawn',
  );

  if (existing) {
    throw new Error('DUPLICATE_APPLICATION');
  }

  const now = new Date().toISOString();
  const application: JobApplication = {
    ...input,
    id: `${input.jobId}-${input.candidateUid}-${Date.now()}`,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  };

  applications.set(application.id, application);
  return application;
};

export const listCandidateApplications = (uid: string): JobApplication[] => {
  return [...applications.values()].filter(
    (application) => application.candidateUid === uid,
  );
};
