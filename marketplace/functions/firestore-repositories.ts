import type {
  CandidateProfile,
  Employer,
  JobApplication,
  MarketplaceJob,
} from '../shared/types.js';
import type { MarketplaceRepositoryBundle } from './repositories.js';

const notConnected = (): never => {
  throw new Error('FIRESTORE_NOT_CONNECTED');
};

export const firestoreRepositories: MarketplaceRepositoryBundle = {
  jobs: {
    async listPublished(): Promise<MarketplaceJob[]> {
      return notConnected();
    },
    async getPublished(
      _jobIdOrSlug: string,
    ): Promise<MarketplaceJob | null> {
      return notConnected();
    },
    async create(job: MarketplaceJob): Promise<MarketplaceJob> {
      return notConnected();
    },
  },

  profiles: {
    async get(_uid: string): Promise<CandidateProfile | null> {
      return notConnected();
    },
    async upsert(profile: CandidateProfile): Promise<CandidateProfile> {
      return notConnected();
    },
  },

  applications: {
    async create(application: JobApplication): Promise<JobApplication> {
      return notConnected();
    },
    async listByCandidate(_uid: string): Promise<JobApplication[]> {
      return notConnected();
    },
    async listByEmployer(_employerId: string): Promise<JobApplication[]> {
      return notConnected();
    },
  },

  employers: {
    async create(employer: Employer): Promise<Employer> {
      return notConnected();
    },
    async get(_employerId: string): Promise<Employer | null> {
      return notConnected();
    },
    async listForUser(_uid: string): Promise<Employer[]> {
      return notConnected();
    },
  },
};
