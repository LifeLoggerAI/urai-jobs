import type {
  CandidateProfile,
  Employer,
  JobApplication,
  MarketplaceJob,
} from '../shared/types';

export interface MarketplaceJobRepository {
  listPublished(): Promise<MarketplaceJob[]>;
  getPublished(jobIdOrSlug: string): Promise<MarketplaceJob | null>;
  create(job: MarketplaceJob): Promise<MarketplaceJob>;
}

export interface CandidateProfileRepository {
  get(uid: string): Promise<CandidateProfile | null>;
  upsert(profile: CandidateProfile): Promise<CandidateProfile>;
}

export interface ApplicationRepository {
  create(application: JobApplication): Promise<JobApplication>;
  listByCandidate(uid: string): Promise<JobApplication[]>;
  listByEmployer(employerId: string): Promise<JobApplication[]>;
}

export interface EmployerRepository {
  create(employer: Employer): Promise<Employer>;
  get(employerId: string): Promise<Employer | null>;
  listForUser(uid: string): Promise<Employer[]>;
}

export type MarketplaceRepositoryBundle = {
  jobs: MarketplaceJobRepository;
  profiles: CandidateProfileRepository;
  applications: ApplicationRepository;
  employers: EmployerRepository;
};
