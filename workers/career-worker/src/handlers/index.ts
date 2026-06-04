type CareerJob = {
  id?: string;
  jobId?: string;
  type?: string;
  jobType?: string;
  payload?: unknown;
  payloadInline?: unknown;
};

type CareerWorkerResult = {
  ok: true;
  worker: 'career-worker';
  jobId: string;
  jobType: string;
  status: 'stubbed';
  outputs: Record<string, string>;
  summary: string;
  payloadEcho: unknown;
  completedAt: string;
};

function getJobId(job: CareerJob): string {
  return String(job.jobId || job.id || 'unknown-job');
}

function getJobType(job: CareerJob): string {
  return String(job.type || job.jobType || 'career.profile.summarize');
}

function getPayload(job: CareerJob): unknown {
  return job.payload ?? job.payloadInline ?? {};
}

function outputPrefix(jobId: string, jobType: string): string {
  return `career/${jobType.replace(/[^a-z0-9]+/gi, '-')}/${jobId}`;
}

function buildResult(job: CareerJob, outputName: string, summary: string): CareerWorkerResult {
  const jobId = getJobId(job);
  const jobType = getJobType(job);
  const prefix = outputPrefix(jobId, jobType);

  return {
    ok: true,
    worker: 'career-worker',
    jobId,
    jobType,
    status: 'stubbed',
    outputs: {
      manifest: `gs://urai-jobs-career-artifacts/${prefix}/manifest.json`,
      [outputName]: `gs://urai-jobs-career-artifacts/${prefix}/${outputName}.json`,
    },
    summary,
    payloadEcho: getPayload(job),
    completedAt: new Date().toISOString(),
  };
}

export async function handleJob(job: CareerJob): Promise<CareerWorkerResult> {
  const jobType = getJobType(job);

  switch (jobType) {
    case 'career.profile.summarize':
      return buildResult(job, 'profile', 'Career profile summary scaffold completed.');
    case 'career.fit.score':
      return buildResult(job, 'fit-score', 'Career fit score scaffold completed.');
    case 'career.document.parse':
      return buildResult(job, 'document-parse', 'Career document parse scaffold completed.');
    case 'career.document.tailor':
      return buildResult(job, 'document-tailor', 'Career document tailoring scaffold completed.');
    case 'career.packet.generate':
      return buildResult(job, 'packet', 'Career packet scaffold completed.');
    case 'career.followup.plan':
      return buildResult(job, 'followup-plan', 'Career follow-up plan scaffold completed.');
    case 'career.interview.prep':
      return buildResult(job, 'interview-prep', 'Career interview prep scaffold completed.');
    case 'career.offer.compare':
      return buildResult(job, 'offer-compare', 'Career offer comparison scaffold completed.');
    case 'career.spatial.portal.generate':
      return buildResult(job, 'spatial-portal', 'Career spatial portal scaffold completed.');
    case 'career.passport.export':
      return buildResult(job, 'passport', 'Career Passport export scaffold completed.');
    default:
      throw new Error(`Unsupported career job type: ${jobType}`);
  }
}
