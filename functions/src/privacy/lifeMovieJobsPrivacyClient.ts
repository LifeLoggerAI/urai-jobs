import { createLifeMoviePrivacyTransport, type LifeMoviePrivacyTransportConfig } from './lifeMovieConsentTransport.js';
import { createDedicatedJobsFirebaseIdTokenProvider, type JobsPrivacyIdentityConfig, type JobsPrivacyIdentityDependencies } from './lifeMovieJobsTokenProvider.js';

/** Complete preparatory client composition, NOT a render admission switch.
 * The factory has no environment-variable fallback, no user-supplied bearer,
 * and no public endpoint. Calling it requires a reviewed, Privacy-scoped
 * Firebase Admin signing identity and explicit, server-only configuration.
 */
export function createAuthenticatedJobsPrivacyConsentClient(
  config: LifeMoviePrivacyTransportConfig & JobsPrivacyIdentityConfig,
  dependencies: JobsPrivacyIdentityDependencies,
) {
  const getDedicatedJobsFirebaseIdToken = createDedicatedJobsFirebaseIdTokenProvider(config, dependencies);
  return createLifeMoviePrivacyTransport(
    { firebaseProjectId: config.firebaseProjectId, region: config.region, dedicatedJobsUid: config.dedicatedJobsUid },
    { getDedicatedJobsFirebaseIdToken, fetchImpl: dependencies.fetchImpl },
  );
}
