
import { defineString } from 'firebase-functions/params';

// General configuration
export const PROJECT_ID = defineString('PROJECT_ID', { default: process.env.GCP_PROJECT });
export const REGION = 'us-central1';

// Admin configuration
export const BOOTSTRAP_ADMIN_UID = defineString('URAI_JOBS_BOOTSTRAP_ADMIN_UID');
