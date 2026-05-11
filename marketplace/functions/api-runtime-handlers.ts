import { verifyFirebaseIdToken } from './auth-runtime';
import { createApplicationRuntime } from './applications-runtime';
import { createSignedUploadRuntime } from './signed-upload-runtime';
import { createMarketplaceCrudRuntime } from './firestore-crud';
import { createJobSearchRuntime } from './job-search-runtime';
import { requireSignedIn } from './auth';
import { fail, ok } from './responses';

export const runtimeListJobsHandler = async (input?: {
  search?: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  limit?: number;
}) => {
  const jobs = createJobSearchRuntime();

  return ok(await jobs.listPublishedJobs(input));
};

export const runtimeGetJobHandler = async (jobId: string) => {
  const crud = createMarketplaceCrudRuntime();
  const snapshot = await crud.jobs.get(jobId);

  if (!snapshot.exists) {
    return fail('JOB_NOT_FOUND', 'Job not found', 404);
  }

  return ok({
    job: { id: snapshot.id, ...snapshot.data() },
  });
};

export const runtimeCreateApplicationHandler = async (input: {
  authorization?: string;
  jobId: string;
  employerId: string;
  resumeUrl?: string;
}) => {
  const auth = await verifyFirebaseIdToken(input.authorization);
  const candidateUid = requireSignedIn(auth);
  const applications = createApplicationRuntime();

  const result = await applications.createApplication({
    candidateUid,
    jobId: input.jobId,
    employerId: input.employerId,
    resumeUrl: input.resumeUrl,
  });

  return ok(result);
};

export const runtimeCreateResumeUploadHandler = async (input: {
  authorization?: string;
  contentType: string;
}) => {
  const auth = await verifyFirebaseIdToken(input.authorization);
  const candidateUid = requireSignedIn(auth);
  const uploads = createSignedUploadRuntime();

  const result = await uploads.createResumeUpload({
    candidateUid,
    contentType: input.contentType,
  });

  return ok(result);
};
