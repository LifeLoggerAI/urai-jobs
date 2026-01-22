import { Job } from '../../jobs/types';
import { logger } from '../../observability/logger';

export async function tagEntitiesHandler(job: Job<'tag_entities'>): Promise<void> {
  logger.info(`Tagging entities in text`, { jobId: job.id });
  // In a real implementation, this would use a natural language processing API.
  await new Promise(resolve => setTimeout(resolve, 1000));
  logger.info(`Finished tagging entities`, { jobId: job.id });
}
