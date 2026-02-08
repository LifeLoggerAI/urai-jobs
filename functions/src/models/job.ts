import { FieldValue } from "firebase-admin/firestore";

export type JobStatus = "draft" | "open" | "paused" | "closed";
export type LocationType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export interface Job {
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
  createdAt: FieldValue;
  updatedAt: FieldValue;
  createdBy: string; // UID
}

export interface JobPublic {
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
  status: "open";
  updatedAt: FieldValue;
}
