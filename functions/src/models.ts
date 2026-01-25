import { Timestamp } from "firebase-admin/firestore";

export interface Job {
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: "draft" | "open" | "paused" | "closed";
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
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: "open";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Applicant {
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
    type: "direct" | "referral" | "waitlist";
    refCode?: string;
    campaign?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}

export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string;
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
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

export interface Referral {
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

export interface Waitlist {
  email: string;
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}

export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp;
}

export interface Event {
  type: string;
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
}
