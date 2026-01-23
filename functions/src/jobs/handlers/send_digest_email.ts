import { Job } from '../../jobs/types';
import { logger } from '../../observability/logger';

export async function sendDigestEmailHandler(job: Job<'send_digest_email'>): Promise<void> {
  logger.info(`Sending digest email to ${job.payload.recipientEmail}`, { jobId: job.id });
  // In a real implementation, this would use an email sending service.
  await new Promise(resolve => setTimeout(resolve, 500));
  logger.info(`Finished sending digest email to ${job.payload.recipientEmail}`, { jobId: job.id });
}
