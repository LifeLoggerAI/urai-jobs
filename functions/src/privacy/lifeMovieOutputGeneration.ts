/**
 * Exact GCS generation binding for a worker-produced private derivative.
 * Never derive generation from a caller, a latest-object read, or a missing
 * legacy worker artifact. A decimal string is required to avoid rounding.
 */
export function requirePinnedMovieOutputGeneration(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value) ||
      !Number.isSafeInteger(Number(value))) {
    throw new Error('life_movie_output_generation_invalid');
  }
  return value;
}
