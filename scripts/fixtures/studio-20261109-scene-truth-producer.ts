import { createHash } from 'node:crypto';

export const LIFE_MOVIE_JOBS_BRIDGE_BUDGET = {
  maxDurationMs: 30_000,
  maxPixelFrames: 1920 * 1080 * 30 * 15,
  maxFramePixels: 3840 * 2160,
  maxSources: 12,
  maxTimelineItems: 12,
  maxAudioCues: 12,
} as const;

const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RECEIPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]+[a-z0-9]$/;
const SAFE_PROJECT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SOURCE_GENERATION = /^[1-9][0-9]{0,19}$/;
const SOURCE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
]);
const SOURCE_PROVENANCE = new Set([
  'original-source', 'user-provided-fact', 'verified-metadata', 'user-recorded-memory',
  'inferred', 'reconstructed', 'generated', 'artistic-interpretation', 'unknown',
]);
const AUDIO_ROLES = new Set(['narration', 'dialogue', 'music', 'ambience', 'foley', 'effects']);
const SOURCE_KEYS = new Set([
  'id', 'bucket', 'objectPath', 'generation', 'mimeType', 'provenance',
  'sourceRefs', 'consentRef', 'ownerOrRightsRef',
]);

export type JobsLifeMovieSource = {
  id: string;
  bucket: string;
  objectPath: string;
  generation: string;
  mimeType:
    | 'image/jpeg' | 'image/png' | 'image/webp'
    | 'video/mp4' | 'video/quicktime' | 'video/webm'
    | 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav' | 'audio/webm' | 'audio/ogg';
  provenance:
    | 'original-source' | 'user-provided-fact' | 'verified-metadata' | 'user-recorded-memory'
    | 'inferred' | 'reconstructed' | 'generated' | 'artistic-interpretation' | 'unknown';
  sourceRefs: string[];
  consentRef: string;
  ownerOrRightsRef: string;
};

export type JobsLifeMovieTimelineItem = {
  sourceId: string;
  startMs: number;
  endMs: number;
  // Optional offset into original video/audio bytes; never default into plan hashing.
  sourceStartMs?: number;
};

export type JobsLifeMovieAudioCue = {
  sourceId: string;
  role: 'narration' | 'dialogue' | 'music' | 'ambience' | 'foley' | 'effects';
  startMs: number;
  endMs: number;
  sourceStartMs?: number;
  gainDb?: number;
};

export type BuildJobsLifeMovieEnvelopeInput = {
  tenantId: string;
  projectId: string;
  sceneTruthReceiptRef: string;
  sceneTruthDigest: string;
  sources: JobsLifeMovieSource[];
  timeline: JobsLifeMovieTimelineItem[];
  audioCues?: JobsLifeMovieAudioCue[];
  subtitleText?: string;
  width?: number;
  height?: number;
  fps?: 24 | 25 | 30 | 50 | 60;
};

function fail(code: string): never {
  throw new Error(code);
}

function safeSegment(value: string, code: string) {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.includes('..') || value.includes('/') || value.includes('\\') || Buffer.byteLength(value, 'utf8') > 256) fail(code);
  return value;
}

function safeObjectPath(value: string, code: string) {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.startsWith('/') || value.includes('..') || value.includes('\\') || Buffer.byteLength(value, 'utf8') > 1024) fail(code);
  return value;
}

function positiveInteger(value: number, code: string) {
  if (!Number.isInteger(value) || value <= 0) fail(code);
  return value;
}

function nonnegativeInteger(value: number, code: string) {
  if (!Number.isInteger(value) || value < 0) fail(code);
  return value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildJobsLifeMovieEnvelope(input: BuildJobsLifeMovieEnvelopeInput) {
  const tenantId = safeSegment(input.tenantId, 'life_movie_invalid_tenant');
  if (!SAFE_PROJECT.test(tenantId)) fail('life_movie_invalid_tenant');
  const projectId = safeSegment(input.projectId, 'life_movie_invalid_project');
  if (!SAFE_PROJECT.test(projectId)) fail('life_movie_invalid_project');
  const sceneTruthReceiptRef = input.sceneTruthReceiptRef;
  if (typeof sceneTruthReceiptRef !== 'string' || !/^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/.test(sceneTruthReceiptRef)) fail('life_movie_invalid_scene_truth_receipt');
  const sceneTruthDigest = input.sceneTruthDigest;
  if (typeof sceneTruthDigest !== 'string' || !/^[a-f0-9]{64}$/.test(sceneTruthDigest)) fail('life_movie_invalid_scene_truth_digest');

  const width = input.width ?? 1280;
  const height = input.height ?? 720;
  const fps = input.fps ?? 30;
  positiveInteger(width, 'life_movie_invalid_width');
  positiveInteger(height, 'life_movie_invalid_height');
  if (width < 320 || width > 3840 || width % 2 !== 0) fail('life_movie_invalid_width');
  if (height < 320 || height > 3840 || height % 2 !== 0) fail('life_movie_invalid_height');
  if (![24,25,30,50,60].includes(fps)) fail('life_movie_invalid_fps');
  if (width * height > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxFramePixels) fail('life_movie_frame_budget_exceeded');

  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxSources) fail('life_movie_invalid_sources');
  if (!Array.isArray(input.timeline) || input.timeline.length < 1 || input.timeline.length > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxTimelineItems) fail('life_movie_invalid_timeline');
  const audioCues = input.audioCues ?? [];
  if (!Array.isArray(audioCues) || audioCues.length > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxAudioCues) fail('life_movie_invalid_audio_cues');

  const allowedSourcePrefixes = [`studios/${tenantId}/`, `tenants/${tenantId}/`];
  const sourceIds = new Set<string>();
  const sources = input.sources.map((source) => {
    // The Studio HTTP caller casts untrusted JSON to JobsLifeMovieSource[];
    // TypeScript types are not a runtime authorization or shape check.
    if (!source || typeof source !== 'object' || Array.isArray(source)
      || Reflect.ownKeys(source).length !== SOURCE_KEYS.size
      || Reflect.ownKeys(source).some((key) => typeof key !== 'string' || !SOURCE_KEYS.has(key))) {
      fail('life_movie_invalid_source_shape');
    }
    if (typeof source.id !== 'string' || !SOURCE_ID.test(source.id) || sourceIds.has(source.id)) fail('life_movie_invalid_source_id');
    sourceIds.add(source.id);
    if (typeof source.bucket !== 'string' || source.bucket.length > 255 || !BUCKET.test(source.bucket)) fail('life_movie_invalid_bucket');
    if (typeof source.generation !== 'string' || !SOURCE_GENERATION.test(source.generation)
      || !Number.isSafeInteger(Number(source.generation))) fail('life_movie_invalid_source_generation');
    if (!SOURCE_MIME_TYPES.has(source.mimeType)) fail('life_movie_invalid_source_mime');
    if (!SOURCE_PROVENANCE.has(source.provenance)) fail('life_movie_invalid_source_provenance');
    const objectPath = safeObjectPath(source.objectPath, 'life_movie_invalid_source_path');
    if (!allowedSourcePrefixes.some((prefix) => objectPath.startsWith(prefix))) fail('life_movie_source_outside_tenant');
    if (!Array.isArray(source.sourceRefs) || source.sourceRefs.length < 1 || source.sourceRefs.length > 32 || source.sourceRefs.some((ref) => typeof ref !== 'string' || !ref.trim() || ref.trim() !== ref || ref.length > 512)) fail('life_movie_invalid_source_refs');
    if (typeof source.consentRef !== 'string' || !RECEIPT_ID.test(source.consentRef)) fail('life_movie_invalid_consent_ref');
    if (typeof source.ownerOrRightsRef !== 'string' || !RECEIPT_ID.test(source.ownerOrRightsRef)) fail('life_movie_invalid_rights_ref');
    // Build the exact Jobs strict source schema; never propagate surplus keys.
    return {
      id: source.id, bucket: source.bucket, objectPath, generation: source.generation,
      mimeType: source.mimeType, provenance: source.provenance, sourceRefs: [...source.sourceRefs],
      consentRef: source.consentRef, ownerOrRightsRef: source.ownerOrRightsRef,
    };
  });

  const timeline = [...input.timeline].map((item) => {
    if (!sourceIds.has(item.sourceId)) fail('life_movie_unknown_timeline_source');
    const startMs = nonnegativeInteger(item.startMs, 'life_movie_invalid_timeline_start');
    const endMs = positiveInteger(item.endMs, 'life_movie_invalid_timeline_end');
    if (endMs <= startMs) fail('life_movie_invalid_timeline_duration');
    const sourceStartMs = item.sourceStartMs;
    if (sourceStartMs !== undefined) {
      nonnegativeInteger(sourceStartMs, 'life_movie_invalid_timeline_source_start');
      if (sourceStartMs > 45 * 60 * 1000) fail('life_movie_invalid_timeline_source_start');
      const source = sources.find((candidate) => candidate.id === item.sourceId)!;
      if (source.mimeType.startsWith('image/') && sourceStartMs !== 0) fail('life_movie_image_source_offset_not_allowed');
    }
    // Jobs' optional field is absent when not explicitly supplied: an undefined
    // or defaulted zero value would silently change the canonical render hash.
    return sourceStartMs === undefined
      ? { sourceId:item.sourceId, startMs, endMs }
      : { sourceId:item.sourceId, startMs, endMs, sourceStartMs };
  }).sort((a,b) => a.startMs - b.startMs);

  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index].startMs < timeline[index - 1].endMs) fail('life_movie_overlapping_timeline');
  }
  const totalTimelineMs = timeline.reduce((max,item) => Math.max(max,item.endMs),0);
  if (totalTimelineMs > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxDurationMs) fail('life_movie_duration_budget_exceeded');
  if (width * height * fps * totalTimelineMs / 1000 > LIFE_MOVIE_JOBS_BRIDGE_BUDGET.maxPixelFrames) fail('life_movie_pixel_frame_budget_exceeded');

  const normalizedAudio = audioCues.map((cue) => {
    if (!sourceIds.has(cue.sourceId)) fail('life_movie_unknown_audio_source');
    const source = sources.find((candidate) => candidate.id === cue.sourceId)!;
    if (!source.mimeType.startsWith('audio/') && !source.mimeType.startsWith('video/')) fail('life_movie_audio_source_not_audio_capable');
    if (!AUDIO_ROLES.has(cue.role)) fail('life_movie_invalid_audio_role');
    const startMs = nonnegativeInteger(cue.startMs, 'life_movie_invalid_audio_start');
    const endMs = positiveInteger(cue.endMs, 'life_movie_invalid_audio_end');
    if (endMs <= startMs || endMs > totalTimelineMs) fail('life_movie_invalid_audio_duration');
    const sourceStartMs = nonnegativeInteger(cue.sourceStartMs ?? 0, 'life_movie_invalid_audio_source_start');
    if (sourceStartMs > 45 * 60 * 1000) fail('life_movie_invalid_audio_source_start');
    const gainDb = cue.gainDb ?? 0;
    if (!Number.isFinite(gainDb) || gainDb < -60 || gainDb > 12) fail('life_movie_invalid_audio_gain');
    return { sourceId:cue.sourceId, role:cue.role, startMs, endMs, sourceStartMs, gainDb };
  });

  const subtitleText = input.subtitleText ?? '';
  if (Buffer.byteLength(subtitleText,'utf8') > 2 * 1024 * 1024) fail('life_movie_subtitles_too_large');

  const outputPrefix = `tenants/${tenantId}/life-movies/${projectId}/`;
  const plan = { projectId, sceneTruthReceiptRef, sceneTruthDigest, outputPrefix, width, height, fps, sources, timeline, audioCues:normalizedAudio, subtitleText };
  const renderPlanDigest = createHash('sha256').update(canonicalJson(plan)).digest('hex');
  const idempotencyKey = `life-movie:${projectId}:${renderPlanDigest.slice(0,32)}`;
  if (idempotencyKey.length > 160) fail('life_movie_invalid_idempotency_key');

  const payload = {
    schemaVersion: 'urai-life-movie-render-v1' as const,
    projectId,
    renderPlanDigest,
    sceneTruthReceiptRef,
    sceneTruthDigest,
    outputPrefix,
    width,
    height,
    fps,
    sources,
    timeline,
    audioCues: normalizedAudio,
    subtitleText,
    spatialRequired: false as const,
    publicReleaseAuthorized: false as const,
    providerGenerationAuthorized: false as const,
  };

  return {
    schemaVersion: 'urai-studio-jobs-envelope-1' as const,
    jobType: 'studio.render.video' as const,
    idempotencyKey,
    payload,
    executionAuthority: 'urai-jobs' as const,
    dispatchAuthorized: false as const,
    providerGenerationAuthorized: false as const,
    publicReleaseAuthorized: false as const,
  };
}
