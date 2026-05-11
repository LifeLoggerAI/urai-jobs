import type {
  CandidateProfile,
  Employer,
  JobApplication,
  MarketplaceJob,
} from '../shared/types';
import type { MarketplaceRepositoryBundle } from './repositories';

const notConnected = () => {
  throw new Error('FIRESTORE_NOT_CONNECTED');
};

export const firestoreRepositories: MarketplaceRepositoryBundle = {
  jobs: {
    async listPublished(): Promise<MarketplaceJob[]> {
      notConnected();
    },
    async getPublished(
      _jobIdOrSlug: string,
    ): Promise<MarketplaceJob | null> {
      notConnected();
    },
    async create(job: MarketplaceJob): Promise<MarketplaceJob> {
      notConnected();
      return job;
    },
  },

  profiles: {
    async get(_uid: string): Promise<CandidateProfile | null> {
      notConnected();
    },
    async upsert(profile: CandidateProfile): Promise<CandidateProfile> {
      notConnected();
      return profile;
    },
  },

  applications: {
    async create(application: JobApplication): Promise<JobApplication> {
      notConnected();
      return application;
    },
    async listByCandidate(_uid: string): Promise<JobApplication[]> {
      notConnected();
    },
    async listByEmployer(_employerId: string): Promise<JobApplication[]> {
      notConnected();
    },
  },

  employers: {
    async create(employer: Employer): Promise<Employer> {
      notConnected();
      return employer;
    },
    async get(_employerId: string): Promise<Employer | null> {
      notConnected();
    },
    async listForUser(_uid: string): Promise<Employer[]> {
      notConnected();
    },
  },
};
