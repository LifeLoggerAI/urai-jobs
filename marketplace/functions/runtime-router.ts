import {
  runtimeCreateApplicationHandler,
  runtimeCreateResumeUploadHandler,
  runtimeGetJobHandler,
  runtimeListJobsHandler,
} from './api-runtime-handlers';
import { fromError, fail } from './responses';

export type MarketplaceRuntimeRequest = {
  method: string;
  path: string;
  authorization?: string;
  body?: Record<string, unknown>;
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

    return fail('ROUTE_NOT_FOUND', 'Route not found', 404);
  } catch (error) {
    return fromError(error);
  }
};
