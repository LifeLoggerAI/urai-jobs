import type { FieldValue, Timestamp } from "firebase-admin/firestore";

// 1. jobs/{jobId}
export interface Job {
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: { min?: number; max?: number; currency?: string };
  status: "draft" | "open" | "paused" | "closed";
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  createdBy: string; // Admin UID
}

// 2. jobPublic/{jobId}
export type JobPublic = Pick<
  Job,
  | "title"
  | "department"
  | "locationType"
  | "locationText"
  | "employmentType"
  | "descriptionMarkdown"
  | "requirements"
  | "niceToHave"
  | "compensationRange"
> & {
  status: "open";
  updatedAt: Timestamp | FieldValue;
};

// 3. applicants/{applicantId}
export interface Applicant {
  primaryEmail: string; // lowercased
  name: string;
  phone?: string;
  links?: { portfolio?: string; linkedin?: string; github?: string; other?: string[] };
  source: { type: "direct" | "referral" | "waitlist"; refCode?: string; campaign?: string };
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  lastActivityAt: Timestamp | FieldValue;
}

// 4. applications/{applicationId}
export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased, denormalized
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
  answers: Record<string, string>;
  resume?: { storagePath: string; filename: string; contentType: string; size: number };
  tags: string[];
  notesCount: number;
  submittedAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  internal?: { rating?: number; reviewerId?: string; reviewedAt?: Timestamp };
}

// 5. referrals/{refCode}
export interface Referral {
  code: string;
  createdBy: string; // Admin UID
  createdAt: Timestamp | FieldValue;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

// 6. waitlist/{id}
export interface WaitlistEntry {
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: { terms: boolean; marketing: boolean };
  createdAt: Timestamp | FieldValue;
}

// 7. admins/{uid}
export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp | FieldValue;
}

// 8. events/{eventId}
export interface TrackingEvent {
  type: string; // e.g., page_view, apply_submit
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp | FieldValue;
}
