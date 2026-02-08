import { FieldValue } from "firebase-admin/firestore";

export interface Referral {
  code: string;
  createdBy: string; // UID
  createdAt: FieldValue;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}
