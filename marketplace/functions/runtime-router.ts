import {
  runtimeCreateApplicationHandler,
  runtimeCreateResumeUploadHandler,
  runtimeGetJobHandler,
  runtimeListJobsHandler,
} from './api-runtime-handlers';
import { verifyFirebaseIdToken } from './auth-runtime';
import { requireAdmin, requireSignedIn } from './auth';
import { createProfileRuntime } from './profile-runtime';
import { createEmployerRuntime } from './employer-runtime';
import { createJobRuntime } from './job-runtime';
import { createMarketplaceAdminRuntime } from './admin-runtime';
import { fromError, fail, ok } from './responses';

export type MarketplaceRuntimeRequest = {
  method: string;
  path: string;
  authorization?: string;
  body?: Record<string, unknown>;
};

const readString = (body: Record<string, unknown> | undefined, key: string) => {
  const value = body?.[key];
  return typeof value === 'string' ? value : undefined;
};

export const routeMarketplaceRuntimeRequest = async (
  request: MarketplaceRuntimeRequest,
) => {
  try {
    if (request.method === 'GET' && request.path === '/api/marketplace/jobs') {
      return runtimeListJobsHandler();
    }

    if (
      request.method === 'GET' &&
      request.path.startsWith('/api/marketplace/jobs/')
    ) {
      const jobId = request.path.replace('/api/marketplace/jobs/', '');
      return runtimeGetJobHandler(jobId);
    }

    if (request.method === 'POST' && request.path === '/api/marketplace/jobs') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const employerId = readString(request.body, 'employerId');
      const jobId = readString(request.body, 'jobId');
      const title = readString(request.body, 'title');
      const description = readString(request.body, 'description');

      if (!employerId || !jobId || !title || !description) {
        return fail('INVALID_JOB_INPUT', 'employerId, jobId, title, and description are required');
      }

      const jobs = createJobRuntime();
      return ok(await jobs.createJob({
        jobId,
        employerId,
        createdBy: uid,
        title,
        description,
        location: readString(request.body, 'location'),
        employmentType: readString(request.body, 'employmentType'),
        remote: request.body?.remote === true,
      }));
    }

    if (request.method === 'POST' && request.path === '/api/marketplace/profiles/me') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const profiles = createProfileRuntime();
      return ok(await profiles.upsertProfile({
        uid,
        displayName: readString(request.body, 'displayName'),
        email: readString(request.body, 'email') ?? auth.email,
        location: readString(request.body, 'location'),
        resumePath: readString(request.body, 'resumePath'),
      }));
    }

    if (request.method === 'GET' && request.path === '/api/marketplace/profiles/me') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const profiles = createProfileRuntime();
      const profile = await profiles.getProfile(uid);
      return profile ? ok({ profile }) : fail('PROFILE_NOT_FOUND', 'Profile not found', 404);
    }

    if (request.method === 'POST' && request.path === '/api/marketplace/employers') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const employerId = readString(request.body, 'employerId');
      const companyName = readString(request.body, 'companyName');

      if (!employerId || !companyName) {
        return fail('INVALID_EMPLOYER_INPUT', 'employerId and companyName are required');
      }

      const employers = createEmployerRuntime();
      return ok(await employers.createEmployer({
        employerId,
        ownerUid: uid,
        companyName,
        website: readString(request.body, 'website'),
        description: readString(request.body, 'description'),
      }));
    }

    if (
      request.method === 'POST' &&
      request.path === '/api/marketplace/resume-intent'
    ) {
      const contentType = request.body?.contentType;

      if (typeof contentType !== 'string') {
        return fail('INVALID_CONTENT_TYPE', 'contentType is required');
      }

      return runtimeCreateResumeUploadHandler({
        authorization: request.authorization,
        contentType,
      });
    }

    if (
      request.method === 'POST' &&
      request.path === '/api/marketplace/applications'
    ) {
      const jobId = request.body?.jobId;
      const employerId = request.body?.employerId;
      const resumeUrl = request.body?.resumeUrl;

      if (typeof jobId !== 'string' || typeof employerId !== 'string') {
        return fail('INVALID_APPLICATION_INPUT', 'jobId and employerId are required');
      }

      return runtimeCreateApplicationHandler({
        authorization: request.authorization,
        jobId,
        employerId,
        resumeUrl: typeof resumeUrl === 'string' ? resumeUrl : undefined,
      });
    }

    if (request.method === 'GET' && request.path === '/api/marketplace/admin/review-queue') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      requireAdmin(auth);
      const admin = createMarketplaceAdminRuntime();
      const snapshot = await admin.listModerationQueue();
      return ok({ jobs: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }

    return fail('ROUTE_NOT_FOUND', 'Route not found', 404);
  } catch (error) {
    return fromError(error);
  }
};
