// Only recognized worker result shapes may be cleared after deletion. Unknown
// fields could contain another derivative and must be reconciled first.
const OUTPUT_FIELDS = new Set([
  'ok', 'mode', 'jobId', 'jobType', 'planId', 'projectId', 'providerCalled',
  'providerSpendAuthorized', 'publicReleaseAuthorized', 'spatialRequired',
  'outputs', 'renderPlanDigest', 'sceneTruthReceiptRef', 'sceneTruthDigest',
  'artifactUrl', 'manifestUrl', 'message', 'payloadEcho', 'completedAt',
]);
const ARTIFACT_FIELDS = new Set(['kind', 'ref', 'generation', 'mimeType', 'checksum', 'sizeBytes']);

export function lifeMovieArtifactRefs(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('life_movie_output_ref_invalid');
  const output = value as Record<string, unknown>;
  if (Object.keys(output).some((key) => !OUTPUT_FIELDS.has(key))) throw new Error('life_movie_output_ref_invalid');
  const refs: string[] = [];
  let recognized = false;
  if (Object.hasOwn(output, 'outputs')) {
    recognized = true;
    if (!Array.isArray(output.outputs) || output.outputs.length === 0) throw new Error('life_movie_output_ref_invalid');
    for (const artifact of output.outputs) {
      if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)
        || Object.keys(artifact).some((key) => !ARTIFACT_FIELDS.has(key))
        || typeof (artifact as Record<string, unknown>).ref !== 'string') {
        throw new Error('life_movie_output_ref_invalid');
      }
      refs.push((artifact as { ref: string }).ref);
    }
  }
  for (const key of ['artifactUrl', 'manifestUrl']) {
    if (!Object.hasOwn(output, key)) continue;
    recognized = true;
    if (typeof output[key] !== 'string') throw new Error('life_movie_output_ref_invalid');
    refs.push(output[key] as string);
  }
  if (!recognized) throw new Error('life_movie_output_ref_invalid');
  return refs;
}

export type LifeMovieArtifactBinding = Readonly<{ ref: string; generation?: string }>;

/** Carry verified worker-produced generations through destructive operations. */
export function lifeMovieArtifactBindings(value: unknown): LifeMovieArtifactBinding[] {
  const refs = lifeMovieArtifactRefs(value);
  if (!refs.length) return [];
  const root = value as Record<string, unknown>;
  const bindings: LifeMovieArtifactBinding[] = [];
  if (Array.isArray(root.outputs)) {
    for (const artifact of root.outputs) {
      const record = artifact as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(record, 'generation')) {
        const candidate = record.generation;
        if (typeof candidate !== 'string' || !/^[1-9][0-9]{0,19}$/.test(candidate) ||
            !Number.isSafeInteger(Number(candidate))) {
          throw new Error('life_movie_output_generation_invalid');
        }
        bindings.push({ ref: record.ref as string, generation: candidate });
      } else {
        bindings.push({ ref: record.ref as string });
      }
    }
  }
  for (const key of ['artifactUrl', 'manifestUrl']) {
    if (Object.prototype.hasOwnProperty.call(root, key)) bindings.push({ ref: root[key] as string });
  }
  if (bindings.length !== refs.length || bindings.some((binding, index) => binding.ref !== refs[index])) {
    throw new Error('life_movie_output_ref_invalid');
  }
  return bindings;
}
