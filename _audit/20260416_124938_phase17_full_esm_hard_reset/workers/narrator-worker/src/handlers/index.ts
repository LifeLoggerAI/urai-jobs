import { Job } from '@urai-jobs/shared-types';
import { handleNarratorTts } from './narrator-tts.js.js.js';

export async function handleJob(job: Job): Promise<any> {
  switch (job.jobType) {
    case 'narrator.tts':
      return handleNarratorTts(job);
    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}
