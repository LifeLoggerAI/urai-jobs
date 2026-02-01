import * as functions from "firebase-functions";

export const config = {
  project: {
    id: process.env.GCLOUD_PROJECT || "urai-jobs",
  },
  emulators: {
    using: process.env.FUNCTIONS_EMULATOR === "true",
  },
  admin: {
    bootstrap_uid: functions.config().admin?.bootstrap_uid || process.env.URAI_JOBS_BOOTSTRAP_ADMIN_UID,
  },
};
