
import { Timestamp } from "firebase-admin/firestore";

// B) ADMIN CONSOLE (PROTECTED)
// Under /admin:
// - Job CRUD: draft/open/paused/closed
// - View applicants per job with filters (status, tag)
// - Applicant/Application detail: status changes, internal notes, tags
// - Export CSV per job (client-side export ok)
// - Simple metrics:
//   - applicants per job
//   - funnel counts by status
//   - average time from submit → first review (if timestamps exist)

// C) FIRESTORE DATA MODEL (IMPLEMENT)
// Collections:

// 1) jobs/{jobId}
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
  createdBy: string; // uid
}

// 2) jobPublic/{jobId}
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
  updatedAt: Timestamp;
}

// 3) applicants/{applicantId}
export interface Applicant {
  primaryEmail: string; // lowercased
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

// 4) applications/{applicationId}
export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased (denormalized for lookups)
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
  answers: { [key: string]: string }; // q -> a
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

// 5) referrals/{refCode}
export interface Referral {
  code: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

// 6) waitlist/{id}
export interface WaitlistEntry {
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}

// 7) admins/{uid}
export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp;
}

// 8) events/{eventId}
export interface Event {
  type: string;
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata: { [key: string]: any };
  createdAt: Timestamp;
}
