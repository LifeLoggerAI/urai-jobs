import { getStorage } from 'firebase-admin/storage';

/** Narrow compensation for a worker output rejected by the Jobs execution lease.
 * Never use a job request, an unpinned object version, or a foreign bucket to
 * infer authority over private Storage bytes. This is not a replacement for a
 * durable write reservation and orphan-inventory reconciliation protocol. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const GCS_GENERATION = /^[1-9][0-9]{0,19}$/;
const NARRATOR_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:mp3|ogg)$/i;

type NarratorOutputLocation = { bucket: string; objectPath: string; generation: string };

export function rejectedNarratorOutputLocation(job: unknown, result: unknown): NarratorOutputLocation | null {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw new Error('narrator_orphan_authority_unverified');
  const source = job as Record<string, unknown>;
  if ((source.jobType ?? source.type) !== 'narrator.tts') return null;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('narrator_orphan_result_unverified');
  const artifact = result as Record<string, unknown>;
  const owner = source.ownerUid;
  const session = source.sourceSessionId;
  const script = source.sourceNarratorScriptId;
  const jobId = source.jobId;
  const payload = source.payload;
  if (source.sourceSystem !== 'urai-storytime' || typeof owner !== 'string' || !SAFE_ID.test(owner)
    || typeof session !== 'string' || !SAFE_ID.test(session)
    || typeof script !== 'string' || !SAFE_ID.test(script)
    || typeof jobId !== 'string' || !SAFE_ID.test(jobId)
    || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('narrator_orphan_authority_unverified');
  }
  const prefix = `storytime/${owner}/${session}/${script}/`;
  if ((payload as Record<string, unknown>).outputPrefix !== prefix.slice(0, -1)) {
    throw new Error('narrator_orphan_authority_unverified');
  }
  const expectedBucket = String(process.env.GCS_BUCKET_NAME || '').trim();
  if (!expectedBucket) throw new Error('narrator_orphan_storage_authority_unavailable');
  const ref = artifact.artifactPath;
  const generation = artifact.artifactGeneration;
  if (typeof ref !== 'string' || !ref.startsWith(`gs://${expectedBucket}/`)
    || typeof generation !== 'string' || !GCS_GENERATION.test(generation)
    || !Number.isSafeInteger(Number(generation))) {
    throw new Error('narrator_orphan_result_unverified');
  }
  const objectPath = ref.slice(`gs://${expectedBucket}/`.length);
  if (!objectPath.startsWith(prefix) || !NARRATOR_FILE.test(objectPath.slice(prefix.length))) {
    throw new Error('narrator_orphan_result_unverified');
  }
  return {bucket: expectedBucket, objectPath, generation};
}

/** Compensate a response whose lease failed to finalize; 404 is idempotent only
 * when the path is still absent. A later generation must never be deleted. */
export async function cleanupRejectedNarratorOutput(job: unknown, result: unknown): Promise<'not-applicable' | 'deleted' | 'absent'> {
  const location = rejectedNarratorOutputLocation(job, result);
  if (!location) return 'not-applicable';
  const bucket = getStorage().bucket(location.bucket);
  let outcome: 'deleted' | 'absent' = 'deleted';
  try {
    await bucket.file(location.objectPath, {preconditionOpts: {ifGenerationMatch: location.generation}}).delete();
  } catch (error) {
    if ((error as {code?: unknown})?.code === 404) outcome = 'absent';
    else if ((error as {code?: unknown})?.code === 412) throw new Error('narrator_orphan_generation_changed');
    else throw error;
  }
  try {
    await bucket.file(location.objectPath).getMetadata();
    throw new Error('narrator_orphan_generation_changed');
  } catch (error) {
    if ((error as {code?: unknown})?.code !== 404) throw error;
  }
  return outcome;
}
