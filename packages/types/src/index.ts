
import { firestore } from "firebase-admin";

// --- Base Types ---
export type ServerTimestamp = firestore.FieldValue;

// --- Firestore Collections ---

/**
 * The main job document, managed by admins.
 */
export interface Job {
  id?: string; // Not stored, but useful on the client
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
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
  createdBy: string; // UID
  stats?: {
    applicantCount?: number;
    statusCounts?: {
      [key in ApplicationStatus]?: number;
    };
  };
}

/**
 * A public-facing, read-only projection of a job.
 * Exists only when a job's status is "open".
 */
export interface JobPublic {
  id?: string;
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: Job["compensationRange"];
  updatedAt: ServerTimestamp; // To show when it was last updated
}

/**
 * Represents a unique job applicant.
 * ID should be a hash of the lowercased primary email.
 */
export interface Applicant {
  id?: string;
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
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
  lastActivityAt: ServerTimestamp;
}

export type ApplicationStatus =
  | "NEW"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";

/**
 * An application submitted by an applicant for a specific job.
 */
export interface Application {
  id?: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased, denormalized for lookups
  status: ApplicationStatus;
  answers: { [key: string]: string }; // Map of question keys to answer strings
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags?: string[];
  notesCount?: number;
  submittedAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
  internal?: {
    rating?: number; // e.g., 1-5
    reviewerId?: string; // UID of admin who reviewed
    reviewedAt?: ServerTimestamp;
  };
}

/**
 * A referral code for tracking application sources.
 */
export interface Referral {
  id?: string;
  code: string;
  createdBy: string; // UID
  createdAt: ServerTimestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

/**
 * An entry for the general talent waitlist.
 */
export interface Waitlist {
  id?: string;
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: ServerTimestamp;
}

/**
 * Defines an admin user's role.
 * Doc ID is the Firebase Auth UID.
 */
export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: ServerTimestamp;
}

/**
 * A generic event for internal tracking.
 */
export interface Event {
  id?: string;
  type: string; // e.g., "page_view", "application_submitted"
  entityType:
    | "job"
    | "applicant"
    | "application"
    | "referral"
    | "waitlist"
    | "page";
  entityId: string;
  metadata?: { [key: string]: any };
  createdAt: ServerTimestamp;
}
