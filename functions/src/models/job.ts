import { Timestamp } from 'firebase-admin/firestore';

export interface Job {
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
  stats?: {
    applicantsCount?: number;
    statusCounts?: {
      NEW?: number;
      SCREEN?: number;
      INTERVIEW?: number;
      OFFER?: number;
      HIRED?: number;
      REJECTED?: number;
    };
  };
}

export interface JobPublic {
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
}
