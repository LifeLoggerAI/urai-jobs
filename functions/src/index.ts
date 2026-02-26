import * as admin from 'firebase-admin';

admin.initializeApp();

// Export all functions from this file
export * from './on-job-write';
export * from './on-application-create';
export * from './create-resume-upload';
export * from './admin-set-application-status';
export * from './scheduled-daily-digest';
export * from './http-health';
