import { Timestamp } from "firebase-admin/firestore";

export type JobStatus = "draft" | "open" | "paused" | "closed";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type LocationType = "remote" | "hybrid" | "onsite";
export type ApplicationStatus = "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";

export interface Job {
  id: string;
  title: string;
  department: string;
  locationType: LocationType;
  locationText: string;
  employmentType: EmploymentType;
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: JobStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // uid
  internal?: any;
  notesCount?: number;
}

export interface Applicant {
  id: string;
  primaryEmail: string; // lowercased
  name: string;
  phone?: string;
  links: {
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
  id: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased
  status: ApplicationStatus;
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
  id: string; // refCode
  code: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

export interface WaitlistEntry {
  id: string;
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}

export interface Admin {
  id: string; // uid
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp;
}

export interface Event {
  id: string;
  type: string;
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
}
