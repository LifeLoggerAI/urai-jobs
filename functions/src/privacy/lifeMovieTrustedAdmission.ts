import { createLifeMovieAdmissionPreflight } from './lifeMovieAdmissionPreflight.js';
import { createFirebaseLifeMovieSourceRightsVerifier } from './lifeMovieFirebaseSourceRightsAdapter.js';
import { createAuthenticatedJobsPrivacyConsentClient } from './lifeMovieJobsPrivacyClient.js';
import type { LifeMoviePrivacyTransportConfig } from './lifeMovieConsentTransport.js';
import type { JobsPrivacyIdentityConfig, JobsPrivacyIdentityDependencies } from './lifeMovieJobsTokenProvider.js';
import type { RightsBackend } from './lifeMovieSourceRightsVerifier.js';

/**
 * Compose real server-owned source-rights reads and audited Storage evidence
 * with the dedicated Jobs-to-Privacy identity/decision transport.
 *
 * This is PREPARATORY. The operational Jobs/worker consent-availability gate
 * stays hard-closed. No implicit environment credentials, user/Studio bearer,
 * client-controlled owner checker, or synthetic rights issuer is provided.
 * The owner-state verifier must be supplied by an approved server authority;
 * an unreviewed callback is not sufficient to activate this composition.
 */
export type TrustedLifeMovieAdmissionConfig = Readonly<{
  sourceRights: Readonly<{
    firebaseProjectId: string;
    allowedBuckets: readonly string[];
    assertCurrentOwner: RightsBackend['assertCurrentOwner'];
  }>;
  privacy: LifeMoviePrivacyTransportConfig & JobsPrivacyIdentityConfig;
}>;

export type TrustedLifeMovieAdmissionDependencies = Readonly<{
  privacyIdentity: JobsPrivacyIdentityDependencies;
  nowMs?: () => number;
}>;

const UNAVAILABLE = 'life_movie_admission_authority_unavailable';

export function createTrustedLifeMovieAdmissionPreflight(
  config: TrustedLifeMovieAdmissionConfig,
  dependencies: TrustedLifeMovieAdmissionDependencies,
) {
  if (!config || !config.sourceRights || !config.privacy ||
      !dependencies || !dependencies.privacyIdentity ||
      (dependencies.nowMs !== undefined && typeof dependencies.nowMs !== 'function')) {
    throw new Error(UNAVAILABLE);
  }
  // The adapter and transport constructors independently validate their
  // allowlists, Firebase project, service UID, signing authority and endpoint.
  // Never fall back to a caller, static 'allow', or a generic admin role.
  try {
    const verifySourceRights = createFirebaseLifeMovieSourceRightsVerifier({
      firebaseProjectId: config.sourceRights.firebaseProjectId,
      allowedBuckets: config.sourceRights.allowedBuckets,
      assertCurrentOwner: config.sourceRights.assertCurrentOwner,
      nowMs: dependencies.nowMs,
    });
    const getCurrentPrivacyDecision = createAuthenticatedJobsPrivacyConsentClient(
      config.privacy,
      dependencies.privacyIdentity,
    );
    return createLifeMovieAdmissionPreflight({
      verifySourceRights,
      getCurrentPrivacyDecision,
      nowMs: dependencies.nowMs,
    });
  } catch {
    throw new Error(UNAVAILABLE);
  }
}
