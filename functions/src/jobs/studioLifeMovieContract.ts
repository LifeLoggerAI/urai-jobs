import { z } from 'zod';

export const LifeMovieSourceSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
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

export const StudioLifeMovieRenderPayloadSchema = z.object({
  schemaVersion: z.literal('urai-life-movie-render-v1'),
  projectId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  renderPlanDigest: z.string().regex(/^[a-f0-9]{64}$/),
  outputPrefix: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\\\'), 'Unsafe output prefix'),
  width: z.number().int().min(320).max(3840).default(1920),
  height: z.number().int().min(320).max(3840).default(1080),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).default(30),
  sources: z.array(LifeMovieSourceSchema).min(1).max(100),
  timeline: z.array(LifeMovieTimelineItemSchema).min(1).max(250),
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
  const ordered = [...value.timeline].sort((left, right) => left.startMs - right.startMs);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startMs < ordered[index - 1].endMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index], message: 'Overlapping timeline items are not supported.' });
    }
  }
  const totalTimelineMs = ordered.reduce((max, item) => Math.max(max, item.endMs), 0);
  if (totalTimelineMs > 45 * 60 * 1000) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline'], message: 'Launch Life Movies are limited to 45 minutes on the synchronous Studio render worker.' });
  }
});

export type StudioLifeMovieRenderPayload = z.infer<typeof StudioLifeMovieRenderPayloadSchema>;

export function assertLifeMovieTenantPaths(payload: StudioLifeMovieRenderPayload, tenantId: string) {
  const requiredSourcePrefix = `tenants/${tenantId}/`;
  const requiredOutputPrefix = `tenants/${tenantId}/life-movies/${payload.projectId}/`;
  if (!payload.outputPrefix.startsWith(requiredOutputPrefix)) {
    throw new Error('life_movie_output_outside_tenant_project');
  }
  if (payload.sources.some((source) => !source.objectPath.startsWith(requiredSourcePrefix))) {
    throw new Error('life_movie_source_outside_tenant');
  }
  return payload;
}
