export type ApplicationStatus =
  | "submitted"
  | "reviewed"
  | "rejected"
  | "accepted";

export type ApplicationRecord = {
  id: string;
  userId: string;
  jobId: string;
  resumeUrl: string | null;
  status: ApplicationStatus;
  createdAt?: unknown;
};
