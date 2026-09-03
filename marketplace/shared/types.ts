export type MarketplaceJobStatus = 'draft' | 'pending_review' | 'published' | 'paused' | 'closed' | 'rejected';

export type MarketplaceJob = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  location: string;
  remote: boolean;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship';
  description: string;
  requirements: string[];
  salaryRange?: string;
  status: MarketplaceJobStatus;
  featured: boolean;
  employerId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type CandidateProfile = {
  uid: string;
  displayName: string;
  email: string;
  location?: string;
  links: string[];
  skills: string[];
  experience?: string;
  resumePath?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobApplication = {
  id: string;
  jobId: string;
  employerId: string;
  candidateUid: string;
  status: 'submitted' | 'reviewing' | 'withdrawn' | 'rejected' | 'advanced';
  resumePath?: string;
  answers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type Employer = {
  id: string;
  orgName: string;
  website?: string;
  status: 'lead' | 'pending_review' | 'approved' | 'rejected' | 'paused';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
