import { createHash } from 'node:crypto';
import { z } from 'zod';

// Admission for the existing bounded synchronous worker, not an authoring limit.
// Must match Privacy's distinct life-movie.render policy (v1.1.0).
// This only validates a receipt reference shape; no grant is implied.
export const LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION = '1.1.0' as const;
export const LifeMovieConsentReferenceSchema = z.object({
  purpose: z.literal('life-movie.render'),
  policyVersion: z.literal(LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION),
  decisionReceiptId: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export const LIFE_MOVIE_EXECUTION_BUDGET = {
  maxDurationMs: 30_000,
  maxPixelFrames: 1920 * 1080 * 30 * 15,
  maxFramePixels: 3840 * 2160,
  maxSources: 12,
  maxTimelineItems: 12,
  maxAudioCues: 12,
} as const;

export const LifeMovieSourceSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  bucket: z.string().trim().min(3).max(255).regex(/^[a-z0-9][a-z0-9._-]+[a-z0-9]$/),
  objectPath: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\'), 'Unsafe object path'),
  // A selection names immutable object bytes, never the current version at a path.
  generation: z.string().regex(/^[1-9][0-9]{0,19}$/).refine((value) => /^[1-9][0-9]{0,19}$/.test(value) && Number.isSafeInteger(Number(value)), 'Invalid object generation'),
  mimeType: z.enum([
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
  ]),
  provenance: z.enum([
    'original-source', 'user-provided-fact', 'verified-metadata', 'user-recorded-memory',
    'inferred', 'reconstructed', 'generated', 'artistic-interpretation', 'unknown',
  ]),
  sourceRefs: z.array(z.string().trim().min(1).max(512)).min(1).max(32),
  consentRef: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  ownerOrRightsRef: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

export const LifeMovieTimelineItemSchema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  // Optional, not defaulted: absent must remain absent in the Studio plan digest.
  sourceStartMs: z.number().int().nonnegative().max(45 * 60 * 1000).optional(),
}).strict().refine((value) => value.endMs > value.startMs && value.endMs - value.startMs <= 30 * 60 * 1000, {
  message: 'Each timeline item must have a positive duration no longer than 30 minutes.',
});


export const LifeMovieAudioCueSchema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  role: z.enum(['narration', 'dialogue', 'music', 'ambience', 'foley', 'effects']),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  sourceStartMs: z.number().int().nonnegative().default(0),
  gainDb: z.number().finite().min(-60).max(12).default(0),
}).strict().refine((value) => value.endMs > value.startMs, {
  message: 'Audio cue must have positive output duration.',
});

export const StudioLifeMovieRenderPayloadSchema = z.object({
  schemaVersion: z.literal('urai-life-movie-render-v1'),
  projectId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  renderPlanDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sceneTruthReceiptRef: z.string().trim().regex(/^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/),
  sceneTruthDigest: z.string().trim().regex(/^[a-f0-9]{64}$/),
  outputPrefix: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\'), 'Unsafe output prefix'),
  width: z.number().int().min(320).max(3840).multipleOf(2).default(1920),
  height: z.number().int().min(320).max(3840).multipleOf(2).default(1080),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).default(30),
  sources: z.array(LifeMovieSourceSchema).min(1).max(LIFE_MOVIE_EXECUTION_BUDGET.maxSources),
  timeline: z.array(LifeMovieTimelineItemSchema).min(1).max(LIFE_MOVIE_EXECUTION_BUDGET.maxTimelineItems),
  audioCues: z.array(LifeMovieAudioCueSchema).max(LIFE_MOVIE_EXECUTION_BUDGET.maxAudioCues).default([]),
  subtitleText: z.string().max(2 * 1024 * 1024).default(''),
  spatialRequired: z.literal(false),
  publicReleaseAuthorized: z.literal(false),
  providerGenerationAuthorized: z.literal(false),
}).strict().superRefine((value, context) => {
  const sourceIds = new Set(value.sources.map((source) => source.id));
  const sourceById = new Map(value.sources.map((source) => [source.id, source]));
  for (const [index, item] of value.timeline.entries()) {
    const source = sourceById.get(item.sourceId);
    if (!source) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index, 'sourceId'], message: 'Timeline source must exist in sources.' });
    } else if (source.mimeType.startsWith('image/') && (item.sourceStartMs ?? 0) !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index, 'sourceStartMs'], message: 'Still images cannot use nonzero source offsets.' });
    }
  }
  for (const [index, cue] of value.audioCues.entries()) {
    const source = value.sources.find((candidate) => candidate.id === cue.sourceId);
    if (!source) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'sourceId'], message: 'Audio cue source must exist in sources.' });
      continue;
    }
    if (!source.mimeType.startsWith('audio/') && !source.mimeType.startsWith('video/')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'sourceId'], message: 'Audio cue source must contain an audio-capable media type.' });
    }
  }
  const ordered = [...value.timeline].sort((left, right) => left.startMs - right.startMs);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startMs < ordered[index - 1].endMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index], message: 'Overlapping timeline items are not supported.' });
    }
  }
  const totalTimelineMs = ordered.reduce((max, item) => Math.max(max, item.endMs), 0);
  for (const [index, cue] of value.audioCues.entries()) {
    if (cue.endMs > totalTimelineMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'endMs'], message: 'Audio cue must fit inside the rendered timeline.' });
    }
  }
  if (totalTimelineMs > LIFE_MOVIE_EXECUTION_BUDGET.maxDurationMs
    || value.width * value.height > LIFE_MOVIE_EXECUTION_BUDGET.maxFramePixels
    || value.width * value.height * value.fps * totalTimelineMs / 1000 > LIFE_MOVIE_EXECUTION_BUDGET.maxPixelFrames) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline'], message: 'Life Movie exceeds the synchronous render budget (15 seconds at 1080p30, at most 30 seconds at lower resolution). Long-form rendering requires a separately verified execution path.' });
  }
});

export type StudioLifeMovieRenderPayload = z.infer<typeof StudioLifeMovieRenderPayloadSchema>;

/**
 * Recompute the hash of the exact normalized worker plan produced by Studio.
 * Do not trust a renderPlanDigest merely because it has a SHA-256 shape.
 * This is a payload-integrity check, not consent or source-rights authority.
 */
export function canonicalRenderPlanJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRenderPlanJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalRenderPlanJson(record[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (typeof encoded !== 'string') throw new Error('life_movie_render_plan_digest_mismatch');
  return encoded;
}

export function computeStudioLifeMovieRenderPlanDigest(payload: StudioLifeMovieRenderPayload): string {
  const plan = {
    projectId: payload.projectId,
    sceneTruthReceiptRef: payload.sceneTruthReceiptRef,
    sceneTruthDigest: payload.sceneTruthDigest,
    outputPrefix: payload.outputPrefix,
    width: payload.width,
    height: payload.height,
    fps: payload.fps,
    sources: payload.sources,
    timeline: payload.timeline,
    audioCues: payload.audioCues,
    subtitleText: payload.subtitleText,
  };
  return createHash('sha256').update(canonicalRenderPlanJson(plan)).digest('hex');
}

export function assertStudioLifeMovieRenderPlanDigest(payload: StudioLifeMovieRenderPayload): StudioLifeMovieRenderPayload {
  if (payload.renderPlanDigest !== computeStudioLifeMovieRenderPlanDigest(payload)) {
    throw new Error('life_movie_render_plan_digest_mismatch');
  }
  return payload;
}

/**
 * Versioned source-selection fingerprint shared with Studio. It binds immutable
 * Storage generations and rights references, not merely bucket/object paths.
 * This is an identifier, NOT proof of user consent, source ownership, or IAM.
 */
export function deriveStudioLifeMovieRenderScope(payload: Pick<StudioLifeMovieRenderPayload, 'projectId' | 'renderPlanDigest' | 'sources'>) {
  const selection = payload.sources.map((source) => [
    source.id,
    source.bucket,
    source.objectPath,
    source.generation,
    source.mimeType,
    source.provenance,
    source.sourceRefs,
    source.consentRef,
    source.ownerOrRightsRef,
  ] as const);
  // Source order does not change which media are selected. Use bytewise order,
  // never a locale-sensitive sort, to keep independent services deterministic.
  selection.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  if (selection.some((source, index) => index > 0 && source[0] === selection[index - 1][0])) {
    throw new Error('life_movie_duplicate_source_id');
  }
  const sourceSetDigest = createHash('sha256')
    .update('urai-life-movie-source-set-v1\n')
    .update(JSON.stringify(selection))
    .digest('hex');
  return { projectId: payload.projectId, renderPlanDigest: payload.renderPlanDigest, sourceSetDigest };
}


// Transport references are not an allow decision. The closed authority gate
// remains responsible for preventing processing until canonical verification.
export const StudioLifeMovieCreateRequestSchema = z.object({
  tenantId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  userId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  action: z.literal('create'),
  idempotencyKey: z.string().trim().min(8).max(160),
  consent: LifeMovieConsentReferenceSchema,
  payload: StudioLifeMovieRenderPayloadSchema,
}).strict();

export function assertLifeMovieTenantPaths(payload: StudioLifeMovieRenderPayload, tenantId: string) {
  const allowedSourcePrefixes = [`studios/${tenantId}/`, `tenants/${tenantId}/`];
  const requiredOutputPrefix = `tenants/${tenantId}/life-movies/${payload.projectId}/`;
  if (!payload.outputPrefix.startsWith(requiredOutputPrefix)) {
    throw new Error('life_movie_output_outside_tenant_project');
  }
  if (payload.sources.some((source) => !allowedSourcePrefixes.some((prefix) => source.objectPath.startsWith(prefix)))) {
    throw new Error('life_movie_source_outside_tenant');
  }
  return payload;
}
