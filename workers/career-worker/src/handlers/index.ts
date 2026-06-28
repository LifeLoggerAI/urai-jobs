type CareerJob = {
  id?: string;
  jobId?: string;
  type?: string;
  jobType?: string;
  payload?: unknown;
  payloadInline?: unknown;
};

type CareerWorkerBlockedResult = {
  ok: false;
  worker: 'career-worker';
  jobId: string;
  jobType: string;
  status: 'NOT_IMPLEMENTED';
  code: 'NOT_IMPLEMENTED';
  summary: string;
  completedAt: string;
};

function getJobId(job: CareerJob): string {
  return String(job.jobId || job.id || 'unknown-job');
}

function getJobType(job: CareerJob): string {
  return String(job.type || job.jobType || 'career.profile.summarize');
}

export async function handleJob(job: CareerJob): Promise<CareerWorkerBlockedResult> {
  const jobId = getJobId(job);
  const jobType = getJobType(job);

  return {
    ok: false,
    worker: 'career-worker',
    jobId,
    jobType,
    status: 'NOT_IMPLEMENTED',
    code: 'NOT_IMPLEMENTED',
    summary: 'Career worker execution is not production implemented yet. This endpoint refuses success until real execution and lifecycle proof exist.',
    completedAt: new Date().toISOString(),
  };
}
