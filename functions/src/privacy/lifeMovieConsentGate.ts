/**
 * No canonical Life Movie consent verifier is connected to Jobs yet.
 * A receipt supplied by a bridge caller, or the absence of a revocation
 * block, is not proof of a current grant. Keep processing closed until an
 * authenticated, subject- and purpose-bound authority is implemented.
 * This is deliberately not an environment-variable bypass.
 */
export const LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE = 'life_movie_consent_authority_unavailable';
export const LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS = 15 * 60 * 1000;

export function lifeMovieConsentAuthorityAvailable(): boolean {
  return false;
}

export function deferLifeMovieJob(job: { type?: unknown; jobType?: unknown }): boolean {
  const lifeMovieTypes = new Set(['studio.render.video', 'studio.assemble.video']);
  return !lifeMovieConsentAuthorityAvailable()
    && (lifeMovieTypes.has(String(job.type || '')) || lifeMovieTypes.has(String(job.jobType || '')));
}
