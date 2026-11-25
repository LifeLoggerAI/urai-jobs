import { verifyFirebaseIdToken } from './auth-runtime.js';
import { createApplicationRuntime } from './applications-runtime.js';
import { createSignedUploadRuntime } from './signed-upload-runtime.js';
import { createMarketplaceCrudRuntime } from './firestore-crud.js';
import { createJobSearchRuntime } from './job-search-runtime.js';
import { requireSignedIn } from './auth.js';
import type { MarketplaceConsent } from './auth.js';
import { fail, ok } from './responses.js';

export const runtimeListJobsHandler = async () => {
  const jobs = createJobSearchRuntime();
  return ok(await jobs.listPublishedJobs());
};

export const runtimeGetJobHandler = async (jobId: string) => {
  const snapshot = await createMarketplaceCrudRuntime().jobs.get(jobId);
  const data = snapshot.data();
  if (!snapshot.exists || data?.status !== 'published' || data.moderationStatus !== 'approved') {
    return fail('JOB_NOT_FOUND', 'Job not found', 404);
  }
  return ok({ job: { ...data, id: snapshot.id } });
};

export const runtimeCreateApplicationHandler = async (input: {
  authorization?: string; jobId: string; employerId: string; profileRevision: number;
  resumePath?: string; answers: Record<string, string>; consentGranted: boolean; consent: MarketplaceConsent;
}) => {
  const actor = await verifyFirebaseIdToken(input.authorization);
  requireSignedIn(actor);
  return ok(await createApplicationRuntime().createApplication(actor, input));
};

export const runtimeCreateResumeUploadHandler = async (input: { authorization?: string; contentType: string }) => {
  const auth = await verifyFirebaseIdToken(input.authorization);
  const candidateUid = requireSignedIn(auth);
  const result = await createSignedUploadRuntime().createResumeUpload({ candidateUid, contentType: input.contentType });
  return ok(result);
};
