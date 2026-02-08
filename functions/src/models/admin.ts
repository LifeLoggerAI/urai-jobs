import { FieldValue } from "firebase-admin/firestore";

export type AdminRole = "owner" | "admin" | "reviewer";

export interface Admin {
  role: AdminRole;
  createdAt: FieldValue;
}
