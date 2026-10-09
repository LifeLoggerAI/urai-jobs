import { randomUUID } from 'node:crypto';

export const ok = <T extends Record<string, unknown>>(payload: T) => ({ ...payload, ok: true });
export const fail = (code: string, message = code, status = 400) => ({
  ok: false, status, code, message, requestId: randomUUID(),
});

const knownErrors = new Set([
  'AUTH_REQUIRED', 'INVALID_AUTHORIZATION_HEADER', 'ACCOUNT_NOT_ACTIVE', 'ACCOUNT_AUTHORITY_CHANGED',
  'TENANT_MISMATCH', 'ADMIN_REQUIRED', 'EMPLOYER_MEMBERSHIP_REQUIRED', 'EMPLOYER_OWNER_REQUIRED',
  'JOB_OWNER_REQUIRED', 'APPLICATION_OWNER_REQUIRED', 'RESUME_OWNER_REQUIRED',
  'CONSENT_REQUIRED', 'CONSENT_REVOKED', 'CONSENT_AUTHORITY_INVALID', 'PROFILE_REVISION_CHANGED',
  'PROFILE_NOT_FOUND', 'EMPLOYER_NOT_FOUND', 'JOB_NOT_FOUND', 'APPLICATION_NOT_FOUND',
  'EMPLOYER_ALREADY_EXISTS', 'JOB_ALREADY_EXISTS', 'DUPLICATE_APPLICATION', 'JOB_NOT_PUBLISHED',
  'EMPLOYER_MISMATCH', 'EMPLOYER_NOT_ACTIVE', 'JOB_NOT_EDITABLE', 'APPLICATION_NOT_PENDING',
  'APPLICATION_NOT_REVIEWABLE', 'APPLICATION_STATUS_INVALID',
]);

export const fromError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const base = message.split(':')[0];
  if (base === 'MARKETPLACE_LAUNCH_BLOCKED') return fail(base, 'Marketplace launch approval is required.', 503);
  if (base === 'MARKETPLACE_ENV_MISSING') return fail(base, 'Marketplace configuration is incomplete.', 503);
  if (base.startsWith('VALIDATION_')) return fail(base, 'Invalid marketplace request.', 400);
  if (!knownErrors.has(base)) return fail('INTERNAL_MARKETPLACE_ERROR', 'Marketplace request failed.', 500);
  const status = /^(AUTH_REQUIRED|INVALID_AUTHORIZATION_HEADER)$/.test(base) ? 401
    : /NOT_FOUND$/.test(base) ? 404
    : /ALREADY_EXISTS|DUPLICATE|REVISION_CHANGED|NOT_PENDING|NOT_REVIEWABLE|NOT_EDITABLE/.test(base) ? 409
    : /STATUS_INVALID/.test(base) ? 400 : 403;
  return fail(base, base, status);
};
