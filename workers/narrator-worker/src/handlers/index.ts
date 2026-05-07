import { Job } from '@urai-jobs/shared-types';
import { handleNarratorTts } from './narrator-tts.js';

function jobTypeFor(job: Job): string {
  return String(job.jobType || job.type || '').trim();
}

export async function handleJob(job: Job): Promise<any> {
  const jobType = jobTypeFor(job);

  switch (jobType) {
    case 'narrator.tts':
      return handleNarratorTts({ ...job, jobType, type: job.type || jobType });
    default:
      throw new Error(`Unknown job type: ${jobType || 'missing'}`);
  }
}
