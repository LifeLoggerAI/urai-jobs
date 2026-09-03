import { trackJobsEvent } from "./analytics";

export type NotificationChannel = "email" | "in_app" | "webhook";

export type NotificationIntent =
  | "application_submitted"
  | "application_status_changed"
  | "job_post_submitted"
  | "job_post_approved"
  | "job_post_rejected"
  | "data_export_ready"
  | "data_deletion_completed"
  | "worker_job_failed"
  | "worker_job_dead";

export type NotificationDraft = {
  intent: NotificationIntent;
  channel: NotificationChannel;
  recipientRole: "candidate" | "employer" | "operator" | "admin";
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
};

const DEBUG_BUFFER_KEY = "urai_jobs_notification_drafts";

function readDrafts(): NotificationDraft[] {
  try {
    const raw = window.localStorage.getItem(DEBUG_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: NotificationDraft[]) {
  try {
    window.localStorage.setItem(DEBUG_BUFFER_KEY, JSON.stringify(drafts.slice(-50)));
  } catch {
    // Ignore restricted localStorage contexts.
  }
}

export function queueNotificationDraft(draft: NotificationDraft) {
  if (typeof window === "undefined") return;
  writeDrafts([...readDrafts(), draft]);
  trackJobsEvent("notification_draft_queued", {
    intent: draft.intent,
    channel: draft.channel,
    recipient_role: draft.recipientRole
  });
  window.dispatchEvent(new CustomEvent("urai-jobs:notification-draft", { detail: draft }));
}

export function flushNotificationDrafts() {
  const drafts = readDrafts();
  writeDrafts([]);
  return drafts;
}

export const notificationTemplates = {
  applicationSubmitted(jobId: string): NotificationDraft {
    return {
      intent: "application_submitted",
      channel: "email",
      recipientRole: "candidate",
      subject: "URAI Jobs application received",
      body: `Your application for ${jobId} was received. We will notify you when status changes.`,
      metadata: { job_id_present: Boolean(jobId) }
    };
  },
  jobPostSubmitted(): NotificationDraft {
    return {
      intent: "job_post_submitted",
      channel: "email",
      recipientRole: "employer",
      subject: "URAI Jobs post submitted for review",
      body: "Your job post was submitted for review. We will notify you after moderation.",
      metadata: { flow: "employer_posting" }
    };
  },
  dataExportReady(): NotificationDraft {
    return {
      intent: "data_export_ready",
      channel: "email",
      recipientRole: "candidate",
      subject: "Your URAI Jobs data export is ready",
      body: "Your requested data export is ready. Use the secure link in your account or support thread before it expires.",
      metadata: { flow: "data_rights" }
    };
  }
};

if (typeof window !== "undefined") {
  Object.assign(window, {
    uraiJobsNotifications: {
      queueDraft: queueNotificationDraft,
      flushDrafts: flushNotificationDrafts
    }
  });
}
