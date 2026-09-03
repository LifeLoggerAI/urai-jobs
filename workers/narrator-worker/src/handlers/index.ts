import { handleNarratorTts } from './narrator-tts.js';

export interface Job {
  jobId: string;
  jobType?: string;
  type?: string;
  status?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export async function handleJob(job: Job): Promise<any> {
  const jobType = job.type || job.jobType;

  switch (jobType) {
    case 'narrator.tts':
      return handleNarratorTts(job);
    default:
      throw new Error(`Unknown job type: ${jobType || 'missing'}`);
  }
}
