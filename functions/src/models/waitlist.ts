import { FieldValue } from "firebase-admin/firestore";

export interface Waitlist {
  email: string; // lowercased
  name?: string;
  interests?: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: FieldValue;
}
