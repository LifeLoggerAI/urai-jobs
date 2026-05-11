import { trackJobsEvent } from "./analytics";
const DEBUG_BUFFER_KEY = "urai_jobs_notification_drafts";
function readDrafts() {
    try {
        const raw = window.localStorage.getItem(DEBUG_BUFFER_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function writeDrafts(drafts) {
    try {
        window.localStorage.setItem(DEBUG_BUFFER_KEY, JSON.stringify(drafts.slice(-50)));
    }
    catch {
        // Ignore restricted localStorage contexts.
    }
}
export function queueNotificationDraft(draft) {
    if (typeof window === "undefined")
        return;
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
    applicationSubmitted(jobId) {
        return {
            intent: "application_submitted",
            channel: "email",
            recipientRole: "candidate",
            subject: "URAI Jobs application received",
            body: `Your application for ${jobId} was received. We will notify you when status changes.`,
            metadata: { job_id_present: Boolean(jobId) }
        };
    },
    jobPostSubmitted() {
        return {
            intent: "job_post_submitted",
            channel: "email",
            recipientRole: "employer",
            subject: "URAI Jobs post submitted for review",
            body: "Your job post was submitted for review. We will notify you after moderation.",
            metadata: { flow: "employer_posting" }
        };
    },
    dataExportReady() {
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
