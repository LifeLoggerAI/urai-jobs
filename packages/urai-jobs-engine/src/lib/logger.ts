import { Job } from "../types/jobs";

export const log = (level: 'info' | 'error', message: string, job: Job<any>, extra?: any) => {
  console.log(JSON.stringify({
    severity: level.toUpperCase(),
    message,
    jobId: job.id,
    jobType: job.type,
    traceId: job.traceId,
    ...extra
  }));
};
