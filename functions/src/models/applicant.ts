import { FieldValue } from "firebase-admin/firestore";

export interface Applicant {
  primaryEmail: string; // lowercased
  name?: string;
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
  createdAt: FieldValue;
  updatedAt: FieldValue;
  lastActivityAt: FieldValue;
}
