
import { pubsub } from 'firebase-functions';
import { claimJobs, completeJob, failJob } from './engine';
import { handlers } from './handlers';
import { logger } from 'firebase-functions';

const WORKER_ID = 'scheduled-dispatcher';
const BATCH_SIZE = 10;

export const dispatcher = pubsub.schedule('every 1 minutes').onRun(async () => {
    const jobIds = await claimJobs(WORKER_ID, BATCH_SIZE);

    for (const jobId of jobIds) {
        try {
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            const job = jobDoc.data() as Job;

            const handler = handlers[job.type];
            if (handler) {
                await handler(job.payload);
                await completeJob(jobId);
            } else {
                throw new Error(`No handler found for job type: ${job.type}`);
            }
        } catch (error) {
            logger.error(`Error processing job ${jobId}:`, error);
            await failJob(jobId, error as Error);
        }
    }
});
