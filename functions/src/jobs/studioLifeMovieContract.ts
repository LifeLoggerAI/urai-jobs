import { z } from 'zod';

// Admission for the existing bounded synchronous worker, not an authoring limit.
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
  objectPath: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\\\'), 'Unsafe object path'),
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
  outputPrefix: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\\\'), 'Unsafe output prefix'),
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
  for (const [index, item] of value.timeline.entries()) {
    if (!sourceIds.has(item.sourceId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index, 'sourceId'], message: 'Timeline source must exist in sources.' });
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
