
/**
 * @fileoverview Main entrypoint for URAI-Jobs Cloud Functions.
 */

import { initializeApp } from "firebase-admin/app";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
initializeApp();

logger.info("URAI-Jobs functions cold start.");

// --- Export Functions ---

// Firestore Triggers
import { onjobwrite } from "./triggers/on-job-write";
import { onapplicationcreate } from "./triggers/on-application-create";
export { onjobwrite, onapplicationcreate };


// Callable Functions
import { createresumeupload } from "./callable/create-resume-upload";
import { adminsetapplicationstatus } from "./callable/admin-set-application-status";
export { createresumeupload, adminsetapplicationstatus };


// HTTP Functions
import { health } from "./http/health";
export { health };

// Scheduled Functions
import { scheduleddailydigest } from "./scheduled/daily-digest";
export { scheduleddailydigest };
