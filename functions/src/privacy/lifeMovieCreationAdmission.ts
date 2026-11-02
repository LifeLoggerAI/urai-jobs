import type { LifeMovieAdmissionRequest } from './lifeMovieAdmissionPreflight.js';
import {
  createTrustedLifeMovieAdmissionPreflight,
  type TrustedLifeMovieAdmissionConfig,
  type TrustedLifeMovieAdmissionDependencies,
} from './lifeMovieTrustedAdmission.js';
import {
  LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE,
  lifeMovieConsentAuthorityAvailable,
} from './lifeMovieConsentGate.js';

/**
 * Exact-source creation boundary shared by short-form and long-form Jobs.
 *
 * No caller/Studio token or receipt may supply this authority. An approved
 * server-side owner-state, source-rights and Privacy configuration must be
 * assembled separately by reviewed infrastructure and passed explicitly.
 * It is deliberately not installed in either HTTP bridge today: without an
 * approved authority both bridges remain denied, including if an HTTP gate
 * check is accidentally removed. This is not a render-activation switch.
 */
export type ReviewedLifeMovieCreationAuthority = Readonly<{
  config: TrustedLifeMovieAdmissionConfig;
  dependencies: TrustedLifeMovieAdmissionDependencies;
}>;

export async function requireLifeMovieCreationAdmission(
  request: LifeMovieAdmissionRequest,
  authority?: ReviewedLifeMovieCreationAuthority,
): Promise<void> {
  if (!lifeMovieConsentAuthorityAvailable() || !authority) {
    throw new Error(LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE);
  }
  // The real composed verifier independently checks owner state, immutable
  // source rights, signed service identity and current Privacy consent.
  // A prior audit event or caller-supplied digest is never an allow token.
  const preflight = createTrustedLifeMovieAdmissionPreflight(
    authority.config,
    authority.dependencies,
  );
  await preflight(request);
}
