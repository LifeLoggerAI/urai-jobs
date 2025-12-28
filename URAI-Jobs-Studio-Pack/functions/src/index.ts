import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { dispatchNewJob, scheduleTick } from './jobsQueue.js';
import { onApplicationCreate } from './ats.js';
import { createResumeUploadUrl } from './resume.js';
import { secureApply } from './secureApply.js';
import { resendEmailWebhook } from './webhooks/resend.js';
import { sendgridEmailWebhook } from './webhooks/sendgrid.js';
import { openPixel } from './tracking/pixel.js';
import { trackRedirect } from './tracking/click.js';
import { rollupEmailEventsDay } from './cron/rollups.js';
import { sendWeeklySummary } from './cron/weeklySummary.js';
import { admin_runWeeklySummary, admin_runDailyRollup, admin_runCampaignRollup } from './admin.js';

admin.initializeApp();

export const queue_dispatchNewJob = functions.firestore.document('jobs_queue/{jobId}').onCreate(dispatchNewJob);
export const queue_scheduleTick = functions.pubsub.schedule('every 5 minutes').onRun(scheduleTick);

export const ats_onApplicationCreate = functions.firestore.document('applications/{appId}').onCreate(onApplicationCreate);
export const resumes_createUploadUrl = createResumeUploadUrl;
export const ats_secureApply = secureApply;

export const webhook_resend = resendEmailWebhook;
export const webhook_sendgrid = sendgridEmailWebhook;

export const openPixel = openPixel;
export const trackRedirect = trackRedirect;

export const cron_rollupEmailEventsDay = functions.pubsub.schedule('0 2 * * *').timeZone('UTC').onRun(rollupEmailEventsDay);
export const cron_sendWeeklySummary = functions.pubsub.schedule('0 9 * * 1').timeZone('UTC').onRun(sendWeeklySummary);

export const admin_runWeeklySummary = admin_runWeeklySummary;
export const admin_runDailyRollup = admin_runDailyRollup;
export const admin_runCampaignRollup = admin_runCampaignRollup;
