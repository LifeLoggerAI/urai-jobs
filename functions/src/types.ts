
export type JobStatus =
  | "draft"
  | "open"
  | "paused"
  | "closed";

export type Job = {
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
    status: JobStatus;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
    createdBy: string;
};

export type JobPublic = Omit<Job, "createdBy" | "status">;

export type Applicant = {
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
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
    lastActivityAt: FirebaseFirestore.Timestamp;
};

export type ApplicationStatus =
  | "NEW"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";

export type Application = {
    jobId: string;
    applicantId: string;
    applicantEmail: string;
    status: ApplicationStatus;
    answers: Record<string, string>;
    resume?: {
        storagePath: string;
        filename: string;
        contentType: string;
        size: number;
    };
    tags?: string[];
    notesCount: number;
    submittedAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
    internal?: {
        rating?: number;
        reviewerId?: string;
        reviewedAt?: FirebaseFirestore.Timestamp;
    };
};

export type Referral = {
    code: string;
    createdBy: string;
    createdAt: FirebaseFirestore.Timestamp;
    clicksCount: number;
    submitsCount: number;
    active: boolean;
};

export type Waitlist = {
    email: string;
    name?: string;
    interests: string[];
    consent: {
        terms: boolean;
        marketing: boolean;
    };
    createdAt: FirebaseFirestore.Timestamp;
};

export type Admin = {
    role: "owner" | "admin" | "reviewer";
    createdAt: FirebaseFirestore.Timestamp;
};

export type Event = {
    type: string;
    entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
    entityId: string;
    metadata: Record<string, any>;
    createdAt: FirebaseFirestore.Timestamp;
};

