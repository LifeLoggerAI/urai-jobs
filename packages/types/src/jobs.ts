import { Timestamp } from 'firebase/firestore';

export interface Job {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'onsite';
  locationText: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: 'draft' | 'open' | 'paused' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface JobPublic {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'onsite';
  locationText: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
}

export interface Applicant {
  id: string;
  primaryEmail: string;
  name: string;
  phone?: string;
  links?: {
    portfolio?: string;
    linkedin?: string;
    github?: string;
    other?: string[];
  };
  source: {
    type: 'direct' | 'referral' | 'waitlist';
    refCode?: string;
    campaign?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}

export interface Application {
  id: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string;
  status: 'NEW' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
  answers: Record<string, string>;
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags: string[];
  notesCount: number;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: Timestamp;
  };
}
