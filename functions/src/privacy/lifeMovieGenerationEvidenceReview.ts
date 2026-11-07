/**
 * R872 review-only physical Storage evidence decision.
 * Pure, dependency-free logic; does NOT grant any private write, revoke IAM,
 * authorize playback, or acknowledge deletion.
 */
const UINT64_MAX = (1n << 64n) - 1n;

export function canonicalReviewOnlyStorageGeneration(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[1-9][0-9]{0,19}$/.test(value) &&
    BigInt(value) <= UINT64_MAX;
}

export type ReviewOnlyGenerationEvidence = {
  /** True only if the current exact Storage generation was observed. */
  storageCurrentlyObserved: boolean;
};

/**
 * A first observation requires an actual exact Storage generation.
 * A historical replay can survive 404 after cleanup, but a live replacement
 * is never treated as a harmless absence. Unsafe metadata fails closed.
 * Storage metadata and the Firestore ledger remain non-atomic.
 */
export function assessReviewOnlyGenerationEvidence(
  claimed: string,
  observed: unknown,
  objectNotFound: boolean,
  previouslyVerified: boolean,
): ReviewOnlyGenerationEvidence {
  if (!canonicalReviewOnlyStorageGeneration(claimed)) {
    throw new Error('life_movie_review_write_generation_invalid');
  }
  if (objectNotFound) {
    if (observed !== null && observed !== undefined) {
      throw new Error('life_movie_review_write_storage_unverified');
    }
    if (!previouslyVerified) {
      throw new Error('life_movie_review_write_generation_not_observed');
    }
    return { storageCurrentlyObserved: false };
  }

  // GCS generations are strings. Safely handle providers returning a number,
  // but never round a uint64 generation through IEEE-754.
  const value = typeof observed === 'number'
    ? (Number.isSafeInteger(observed) && observed > 0 ? String(observed) : null)
    : observed;
  if (!canonicalReviewOnlyStorageGeneration(value)) {
    throw new Error('life_movie_review_write_storage_unverified');
  }
  if (value !== claimed) {
    throw new Error(previouslyVerified
      ? 'life_movie_review_write_generation_replaced_unverified'
      : 'life_movie_review_write_generation_not_observed');
  }
  return { storageCurrentlyObserved: true };
}
