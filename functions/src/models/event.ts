import { FieldValue } from "firebase-admin/firestore";

export type EventType =
  | "page_view"
  | "apply_start"
  | "apply_submit"
  | "waitlist_submit"
  | "referral_click"
  | "status_changed";

export type EventEntityType =
  | "job"
  | "applicant"
  | "application"
  | "referral"
  | "waitlist"
  | "page";

export interface Event {
  type: EventType;
  entityType: EventEntityType;
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: FieldValue;
}
