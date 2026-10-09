import { runtimeGetJobHandler, runtimeListJobsHandler } from './api-runtime-handlers.js';
import { verifyFirebaseIdToken, parseConsent, requireApplicationPathIdentifier, requireIdentifier } from './auth-runtime.js';
import { requireAdmin, requireSignedIn } from './auth.js';
import { createProfileRuntime } from './profile-runtime.js';
import { createEmployerRuntime } from './employer-runtime.js';
import { createJobRuntime } from './job-runtime.js';
import { createMarketplaceAdminRuntime } from './admin-runtime.js';
import { createApplicationRuntime, type ApplicationStatus } from './applications-runtime.js';
import { fromError, fail, ok } from './responses.js';
import { assertBodyFields, employerNameInput, optionalBoolean, optionalString, requireString, requireRevision,
  stringList, privateResumePath, answersRecord } from './validation.js';

export type MarketplaceRuntimeRequest = {
  method: string; path: string; authorization?: string; body?: Record<string, unknown>;
};

export const routeMarketplaceRuntimeRequest = async (request: MarketplaceRuntimeRequest) => {
  try {
    const body = request.body ?? {};
    if (request.method === 'GET' && request.path === '/api/marketplace/jobs') return runtimeListJobsHandler();
    const jobPath = /^\/api\/marketplace\/jobs\/([^/]+)$/.exec(request.path);
    if (request.method === 'GET' && jobPath) return runtimeGetJobHandler(requireIdentifier(jobPath[1], 'jobId'));
    const actor = await verifyFirebaseIdToken(request.authorization);
    const uid = requireSignedIn(actor);
    const profiles = request.path === '/api/marketplace/profiles' || request.path === '/api/marketplace/profiles/me';
    if (request.method === 'GET' && request.path === '/api/marketplace/profiles/me') {
      const profile = await createProfileRuntime().getProfile(actor);
      return profile ? ok({ profile }) : fail('PROFILE_NOT_FOUND', 'Profile not found', 404);
    }
    if (request.method === 'POST' && profiles) {
      assertBodyFields(body, ['displayName', 'location', 'skills', 'links', 'experience', 'resumePath', 'expectedRevision', 'consentGranted', 'consent']);
      return ok(await createProfileRuntime().upsertProfile(actor, {
        displayName: requireString(body, 'displayName', 256), location: optionalString(body, 'location', 256),
        skills: stringList(body, 'skills'), links: stringList(body, 'links'),
        experience: optionalString(body, 'experience', 4096), resumePath: privateResumePath(optionalString(body, 'resumePath'), uid),
        expectedRevision: requireRevision(body, 'expectedRevision'), consentGranted: body.consentGranted === true,
        consent: parseConsent(body.consent, 'career.profile'),
      }));
    }
    if (request.method === 'POST' && request.path === '/api/marketplace/employers') {
      assertBodyFields(body, ['employerId', 'orgName', 'companyName', 'website', 'description']);
      return ok(await createEmployerRuntime().createEmployer(actor, {
        employerId: requireIdentifier(body.employerId, 'employerId'), companyName: employerNameInput(body),
        website: optionalString(body, 'website'), description: optionalString(body, 'description', 4096),
      }));
    }
    const employerPath = /^\/api\/marketplace\/employers\/([^/]+)$/.exec(request.path);
    if (request.method === 'GET' && employerPath) {
      const employer = await createEmployerRuntime().getEmployer(actor, requireIdentifier(employerPath[1], 'employerId'));
      return employer ? ok({ employer }) : fail('EMPLOYER_NOT_FOUND', 'Employer not found', 404);
    }
    if (request.method === 'POST' && request.path === '/api/marketplace/jobs') {
      assertBodyFields(body, ['employerId', 'jobId', 'title', 'description', 'location', 'employmentType', 'remote']);
      return ok(await createJobRuntime().createJob(actor, {
        employerId: requireIdentifier(body.employerId, 'employerId'), jobId: requireIdentifier(body.jobId, 'jobId'),
        title: requireString(body, 'title', 256), description: requireString(body, 'description', 8192),
        location: optionalString(body, 'location', 256), employmentType: optionalString(body, 'employmentType', 64),
        remote: optionalBoolean(body, 'remote'),
      }));
    }
    const jobAction = /^\/api\/marketplace\/jobs\/([^/]+)\/(close|update)$/.exec(request.path);
    if (request.method === 'POST' && jobAction) {
      const jobId = requireIdentifier(jobAction[1], 'jobId');
      if (jobAction[2] === 'close') {
        assertBodyFields(body, []);
        return ok(await createJobRuntime().closeJob(actor, { jobId }));
      }
      assertBodyFields(body, ['title', 'description', 'location', 'employmentType', 'remote']);
      return ok(await createJobRuntime().updateJob(actor, { jobId, title: optionalString(body, 'title', 256),
        description: optionalString(body, 'description', 8192), location: optionalString(body, 'location', 256),
        employmentType: optionalString(body, 'employmentType', 64), remote: optionalBoolean(body, 'remote') }));
    }
    if (request.method === 'POST' && request.path === '/api/marketplace/applications') {
      assertBodyFields(body, ['jobId', 'employerId', 'profileRevision', 'resumePath', 'answers', 'consentGranted', 'consent']);
      return ok(await createApplicationRuntime().createApplication(actor, {
        jobId: requireIdentifier(body.jobId, 'jobId'), employerId: requireIdentifier(body.employerId, 'employerId'),
        profileRevision: requireRevision(body, 'profileRevision'), resumePath: privateResumePath(optionalString(body, 'resumePath'), uid),
        answers: answersRecord(body), consentGranted: body.consentGranted === true,
        consent: parseConsent(body.consent, 'career.application'),
      }));
    }
    if (request.method === 'GET' && request.path === '/api/marketplace/applications/me') {
      return ok({ applications: await createApplicationRuntime().listByCandidate(actor) });
    }
    const withdraw = /^\/api\/marketplace\/applications\/([^/]+)\/withdraw$/.exec(request.path);
    if (request.method === 'PATCH' && withdraw) {
      assertBodyFields(body, []);
      return ok(await createApplicationRuntime().withdrawApplication(actor, requireApplicationPathIdentifier(withdraw[1])));
    }
    const employerApps = /^\/api\/marketplace\/employers\/([^/]+)\/applications(?:\/([^/]+))?$/.exec(request.path);
    if (employerApps) {
      const employerId = requireIdentifier(employerApps[1], 'employerId');
      if (request.method === 'GET' && !employerApps[2]) {
        return ok({ applications: await createApplicationRuntime().listByEmployer(actor, employerId) });
      }
      if (request.method === 'PATCH' && employerApps[2]) {
        assertBodyFields(body, ['status', 'note']);
        return ok(await createApplicationRuntime().updateApplicationStatus(actor, {
          employerId, applicationId: requireApplicationPathIdentifier(employerApps[2]),
          status: requireString(body, 'status') as ApplicationStatus, note: optionalString(body, 'note', 2048),
        }));
      }
    }
    if (request.method === 'POST' && request.path === '/api/marketplace/resume-intent') {
      // Upload safety/Storage acceptance is still open; do not make the existing
      // unverified signer reachable merely by enabling the global launch flag.
      return fail('RESUME_UPLOAD_UNAVAILABLE', 'Resume uploads are not available.', 503);
    }
    if (request.method === 'GET' && request.path === '/api/marketplace/admin/review-queue') {
      requireAdmin(actor);
      return ok(await createMarketplaceAdminRuntime().listModerationQueue(actor));
    }
    const employerModeration = /^\/api\/marketplace\/admin\/employers\/([^/]+)$/.exec(request.path);
    if (request.method === 'PATCH' && employerModeration) {
      requireAdmin(actor);
      assertBodyFields(body, ['action', 'reason']);
      if (body.action !== 'approve' && body.action !== 'reject') throw new Error('VALIDATION_EMPLOYER_MODERATION:action');
      return ok(await createMarketplaceAdminRuntime().moderateEmployer(actor, {
        employerId: requireIdentifier(employerModeration[1], 'employerId'), action: body.action,
        reason: optionalString(body, 'reason', 2048),
      }));
    }
    const moderation = /^\/api\/marketplace\/admin\/jobs\/([^/]+)\/(approve|reject)$/.exec(request.path);
    if (request.method === 'POST' && moderation) {
      requireAdmin(actor);
      assertBodyFields(body, ['reason']);
      const admin = createMarketplaceAdminRuntime();
      const jobId = requireIdentifier(moderation[1], 'jobId');
      return moderation[2] === 'approve' ? ok(await admin.approveJob(actor, { jobId }))
        : ok(await admin.rejectJob(actor, { jobId, reason: optionalString(body, 'reason', 2048) }));
    }
    return fail('ROUTE_NOT_FOUND', 'Route not found', 404);
  } catch (error) { return fromError(error); }
};
