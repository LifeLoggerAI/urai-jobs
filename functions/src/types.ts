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
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
}

export interface JobPublic {
  // public projection for read-only job board
  // only includes fields safe for public display
  // exists only when status="open"
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
}

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
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  lastActivityAt: FirebaseFirestore.Timestamp;
}

export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased
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
  submittedAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: FirebaseFirestore.Timestamp;
  };
}

export interface Referral {
  code: string;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

export interface Waitlist {
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Event {
  type: string;
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata: Record<string, any>;
  createdAt: FirebaseFirestore.Timestamp;
}
