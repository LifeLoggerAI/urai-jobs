
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK
initializeApp();

// Export all v1 functions
export * from "./triggers/on-job-write";
export * from "./triggers/on-application-create";
export * from "./callable/create-resume-upload";
export * from "./callable/admin-set-application-status";
export * from "./scheduled/daily-digest";

// Export all v2 functions
export * from "./http/health";
