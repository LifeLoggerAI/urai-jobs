import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  orgId: string; // Every user must belong to an organization
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
