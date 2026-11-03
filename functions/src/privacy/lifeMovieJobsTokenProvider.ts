import type { Auth } from 'firebase-admin/auth';
import { readLifeMovieBoundedJson } from './lifeMovieBoundedResponse.js';

/** Server-only acquisition of a Firebase ID token for the dedicated Jobs
 * identity in the *Privacy* Firebase project. Never forward inbound Studio,
 * user, or service HTTP bearer tokens as this identity.
 *
 * This prepares the existing Jobs->Privacy transport without activating it:
 * the existing lifeMovieConsentAuthorityAvailable() gate remains false.
 * IAM authority to mint custom tokens and the exact Firebase Auth project
 * must be separately approved and verified in the protected environment.
 */
export type JobsPrivacyIdentityConfig = Readonly<{
  firebaseProjectId: string;
  dedicatedJobsUid: string;
  firebaseWebApiKey: string;
}>;

export type JobsPrivacyIdentityDependencies = Readonly<{
  adminAuth: Pick<Auth, 'app' | 'createCustomToken'>;
  fetchImpl?: typeof fetch;
}>;

const PROJECT = /^[a-z][a-z0-9-]{4,39}$/;
const UID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const API_KEY = /^[A-Za-z0-9_-]{20,200}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_RESPONSE_BYTES = 16_384;
const UNAVAILABLE = 'life_movie_consent_jobs_identity_unavailable';

/** No cache: each call acquires an owner-independent dedicated system token.
 * The Privacy service rechecks the live scoped grant and deletion state.
 */
export function createDedicatedJobsFirebaseIdTokenProvider(
  config: JobsPrivacyIdentityConfig,
  dependencies: JobsPrivacyIdentityDependencies,
): () => Promise<string> {
  if (!config || !PROJECT.test(config.firebaseProjectId) || !UID.test(config.dedicatedJobsUid) ||
      !API_KEY.test(config.firebaseWebApiKey) || !dependencies?.adminAuth ||
      dependencies.adminAuth.app?.options?.projectId !== config.firebaseProjectId ||
      typeof dependencies.adminAuth.createCustomToken !== 'function') {
    throw new Error(UNAVAILABLE);
  }
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' +
    encodeURIComponent(config.firebaseWebApiKey);

  return async () => {
    // The UID and claims are source-pinned, never derived from a render request.
    let customToken: string;
    try {
      customToken = await dependencies.adminAuth.createCustomToken(config.dedicatedJobsUid, {
        system: true, role: 'system', consumerId: 'urai-jobs',
      });
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (typeof customToken !== 'string' || customToken.length > 8192 || !JWT.test(customToken)) {
      throw new Error(UNAVAILABLE);
    }

    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!response || response.status !== 200 || response.redirected ||
        !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error(UNAVAILABLE);
    }
    let data: unknown;
    try {
      // Never read an untrusted Identity Toolkit response unbounded.
      data = await readLifeMovieBoundedJson(response, MAX_RESPONSE_BYTES);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(UNAVAILABLE);
    const result = data as Record<string, unknown>;
    if (result.localId !== config.dedicatedJobsUid || typeof result.idToken !== 'string' ||
        result.idToken.length > 8192 || !JWT.test(result.idToken) ||
        typeof result.expiresIn !== 'string' || !/^[0-9]{1,4}$/.test(result.expiresIn) ||
        Number(result.expiresIn) <= 5 || Number(result.expiresIn) > 3600) {
      throw new Error(UNAVAILABLE);
    }
    // The existing transport rejects wrong audience/issuer/UID/claims/expiry,
    // and Privacy's onCall must verify token cryptography independently.
    return result.idToken;
  };
}
