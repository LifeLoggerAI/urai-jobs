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
import { createOwnershipRuntime } from './ownership-runtime';
import { createApplicationRuntime } from './applications-runtime';
import { fromError, fail, ok } from './responses';
import { optionalBoolean, optionalString, requireString } from './validation';

export type MarketplaceRuntimeRequest = {
  method: string;
  path: string;
  authorization?: string;
  body?: Record<string, unknown>;
};

const jobIdFromPath = (path: string, prefix: string) =>
  path.replace(prefix, '').split('/')[0];

const employerIdFromPath = (path: string, prefix: string) =>
  path.replace(prefix, '').split('/')[0];

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
      const employerId = requireString(request.body, 'employerId');
      const jobId = requireString(request.body, 'jobId');
      const title = requireString(request.body, 'title');
      const description = requireString(request.body, 'description');
      const ownership = createOwnershipRuntime();
      await ownership.requireEmployerOwner({ employerId, uid });

      const jobs = createJobRuntime();
      return ok(await jobs.createJob({
        jobId,
        employerId,
        createdBy: uid,
        title,
        description,
        location: optionalString(request.body, 'location'),
        employmentType: optionalString(request.body, 'employmentType'),
        remote: optionalBoolean(request.body, 'remote'),
      }));
    }

    if (
      request.method === 'POST' &&
      request.path.startsWith('/api/marketplace/jobs/') &&
      request.path.endsWith('/close')
    ) {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const jobId = jobIdFromPath(request.path, '/api/marketplace/jobs/');
      const ownership = createOwnershipRuntime();
      await ownership.requireJobOwner({ jobId, uid });
      const jobs = createJobRuntime();
      return ok(await jobs.closeJob({ jobId, closedBy: uid }));
    }

    if (
      request.method === 'POST' &&
      request.path.startsWith('/api/marketplace/jobs/') &&
      request.path.endsWith('/update')
    ) {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const jobId = jobIdFromPath(request.path, '/api/marketplace/jobs/');
      const ownership = createOwnershipRuntime();
      await ownership.requireJobOwner({ jobId, uid });
      const jobs = createJobRuntime();
      return ok(await jobs.updateJob({
        jobId,
        title: optionalString(request.body, 'title'),
        description: optionalString(request.body, 'description'),
        location: optionalString(request.body, 'location'),
        employmentType: optionalString(request.body, 'employmentType'),
        remote: optionalBoolean(request.body, 'remote'),
      }));
    }

    if (request.method === 'POST' && request.path === '/api/marketplace/profiles/me') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const profiles = createProfileRuntime();
      return ok(await profiles.upsertProfile({
        uid,
        displayName: optionalString(request.body, 'displayName'),
        email: optionalString(request.body, 'email') ?? auth.email,
        location: optionalString(request.body, 'location'),
        resumePath: optionalString(request.body, 'resumePath'),
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
      const employerId = requireString(request.body, 'employerId');
      const companyName = requireString(request.body, 'companyName');

      const employers = createEmployerRuntime();
      return ok(await employers.createEmployer({
        employerId,
        ownerUid: uid,
        companyName,
        website: optionalString(request.body, 'website'),
        description: optionalString(request.body, 'description'),
      }));
    }

    if (
      request.method === 'GET' &&
      request.path.startsWith('/api/marketplace/employers/') &&
      request.path.endsWith('/applications')
    ) {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const employerId = employerIdFromPath(request.path, '/api/marketplace/employers/');
      const ownership = createOwnershipRuntime();
      await ownership.requireEmployerOwner({ employerId, uid });
      const applications = createApplicationRuntime();
      return ok({ applications: await applications.listByEmployer(employerId) });
    }

    if (
      request.method === 'POST' &&
      request.path === '/api/marketplace/resume-intent'
    ) {
      const contentType = requireString(request.body, 'contentType');

      return runtimeCreateResumeUploadHandler({
        authorization: request.authorization,
        contentType,
      });
    }

    if (
      request.method === 'POST' &&
      request.path === '/api/marketplace/applications'
    ) {
      const jobId = requireString(request.body, 'jobId');
      const employerId = requireString(request.body, 'employerId');
      const resumeUrl = optionalString(request.body, 'resumeUrl');

      return runtimeCreateApplicationHandler({
        authorization: request.authorization,
        jobId,
        employerId,
        resumeUrl,
      });
    }

    if (request.method === 'GET' && request.path === '/api/marketplace/applications/me') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const uid = requireSignedIn(auth);
      const applications = createApplicationRuntime();
      return ok({ applications: await applications.listByCandidate(uid) });
    }

    if (request.method === 'GET' && request.path === '/api/marketplace/admin/review-queue') {
      const auth = await verifyFirebaseIdToken(request.authorization);
      requireAdmin(auth);
      const admin = createMarketplaceAdminRuntime();
      const snapshot = await admin.listModerationQueue();
      return ok({ jobs: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }

    if (
      request.method === 'POST' &&
      request.path.startsWith('/api/marketplace/admin/jobs/') &&
      request.path.endsWith('/approve')
    ) {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const adminUid = requireAdmin(auth);
      const jobId = jobIdFromPath(request.path, '/api/marketplace/admin/jobs/');
      const admin = createMarketplaceAdminRuntime();
      return ok(await admin.approveJob({ adminUid, jobId }));
    }

    if (
      request.method === 'POST' &&
      request.path.startsWith('/api/marketplace/admin/jobs/') &&
      request.path.endsWith('/reject')
    ) {
      const auth = await verifyFirebaseIdToken(request.authorization);
      const adminUid = requireAdmin(auth);
      const jobId = jobIdFromPath(request.path, '/api/marketplace/admin/jobs/');
      const reason = optionalString(request.body, 'reason');
      const admin = createMarketplaceAdminRuntime();
      return ok(await admin.rejectJob({ adminUid, jobId, reason }));
    }

    return fail('ROUTE_NOT_FOUND', 'Route not found', 404);
  } catch (error) {
    return fromError(error);
  }
};
