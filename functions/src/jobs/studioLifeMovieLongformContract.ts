import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  LIFE_MOVIE_EXECUTION_BUDGET,
  LifeMovieAudioCueSchema,
  LifeMovieSourceSchema,
  LifeMovieTimelineItemSchema,
  StudioLifeMovieRenderPayloadSchema,
  type StudioLifeMovieRenderPayload,
} from './studioLifeMovieContract.js';

export const LIFE_MOVIE_LONGFORM_BUDGET = {
  maxDurationMs: 45 * 60 * 1000,
  maxSegmentDurationMs: 15_000,
  maxSegments: 180,
  maxSources: 128,
  maxTimelineItems: 360,
  maxAudioCues: 720,
} as const;

export const StudioLifeMovieLongformPayloadSchema = z.object({
  schemaVersion: z.literal('urai-life-movie-longform-v1'),
  projectId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  renderPlanDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sceneTruthReceiptRef: z.string().trim().regex(/^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/),
  sceneTruthDigest: z.string().trim().regex(/^[a-f0-9]{64}$/),
  outputPrefix: z.string().trim().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !value.includes('\\'), 'Unsafe output prefix'),
  width: z.number().int().min(320).max(1920).multipleOf(2).default(1920),
  height: z.number().int().min(320).max(1080).multipleOf(2).default(1080),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30)]).default(30),
  sources: z.array(LifeMovieSourceSchema).min(1).max(LIFE_MOVIE_LONGFORM_BUDGET.maxSources),
  timeline: z.array(LifeMovieTimelineItemSchema).min(1).max(LIFE_MOVIE_LONGFORM_BUDGET.maxTimelineItems),
  audioCues: z.array(LifeMovieAudioCueSchema).max(LIFE_MOVIE_LONGFORM_BUDGET.maxAudioCues).default([]),
  subtitleText: z.string().max(8 * 1024 * 1024).default(''),
  spatialRequired: z.literal(false),
  publicReleaseAuthorized: z.literal(false),
  providerGenerationAuthorized: z.literal(false),
}).strict().superRefine((value, context) => {
  const sourceIds = new Set(value.sources.map((source) => source.id));
  const ordered = [...value.timeline].sort((left, right) => left.startMs - right.startMs);

  for (const [index, item] of ordered.entries()) {
    if (!sourceIds.has(item.sourceId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index, 'sourceId'], message: 'Timeline source must exist in sources.' });
    }
    if (item.endMs - item.startMs > LIFE_MOVIE_LONGFORM_BUDGET.maxSegmentDurationMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index], message: 'Long-form source clips must already be cut to 15 seconds or less; the planner never hides an unbounded transcode inside segmentation.' });
    }
    if (index > 0 && item.startMs < ordered[index - 1].endMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index], message: 'Overlapping timeline items are not supported.' });
    }
  }

  const totalTimelineMs = ordered.reduce((max, item) => Math.max(max, item.endMs), 0);
  if (totalTimelineMs > LIFE_MOVIE_LONGFORM_BUDGET.maxDurationMs) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline'], message: 'Long-form plan exceeds the 45-minute authoring ceiling.' });
  }

  for (const [index, cue] of value.audioCues.entries()) {
    const source = value.sources.find((candidate) => candidate.id === cue.sourceId);
    if (!source) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'sourceId'], message: 'Audio cue source must exist in sources.' });
      continue;
    }
    if (!source.mimeType.startsWith('audio/') && !source.mimeType.startsWith('video/')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'sourceId'], message: 'Audio cue source must be audio-capable.' });
    }
    if (cue.endMs > totalTimelineMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['audioCues', index, 'endMs'], message: 'Audio cue must fit inside the rendered timeline.' });
    }
  }
});

export type StudioLifeMovieLongformPayload = z.infer<typeof StudioLifeMovieLongformPayloadSchema>;

export type LifeMovieLongformSegment = {
  index: number;
  startMs: number;
  endMs: number;
  childDigest: string;
  payload: StudioLifeMovieRenderPayload;
};

function childDigest(parentDigest: string, index: number, startMs: number, endMs: number) {
  return createHash('sha256')
    .update(`urai-life-movie-longform-segment-v1\n${parentDigest}\n${index}\n${startMs}\n${endMs}`)
    .digest('hex');
}

export function planLifeMovieLongformSegments(input: StudioLifeMovieLongformPayload): LifeMovieLongformSegment[] {
  const value = StudioLifeMovieLongformPayloadSchema.parse(input);
  const sourceById = new Map(value.sources.map((source) => [source.id, source]));
  const ordered = [...value.timeline].sort((left, right) => left.startMs - right.startMs);
  const ranges: Array<{ startMs: number; endMs: number; items: typeof ordered }> = [];

  let current: { startMs: number; endMs: number; items: typeof ordered } | null = null;
  for (const item of ordered) {
    if (!current) {
      current = { startMs: item.startMs, endMs: item.endMs, items: [item] };
      continue;
    }

    const proposedDuration = item.endMs - current.startMs;
    const gapMs = item.startMs - current.endMs;
    const canAppend = proposedDuration <= LIFE_MOVIE_LONGFORM_BUDGET.maxSegmentDurationMs
      && gapMs <= LIFE_MOVIE_LONGFORM_BUDGET.maxSegmentDurationMs
      && current.items.length < LIFE_MOVIE_EXECUTION_BUDGET.maxTimelineItems;

    if (!canAppend) {
      ranges.push(current);
      current = { startMs: item.startMs, endMs: item.endMs, items: [item] };
    } else {
      current.items.push(item);
      current.endMs = item.endMs;
    }
  }
  if (current) ranges.push(current);

  if (ranges.length > LIFE_MOVIE_LONGFORM_BUDGET.maxSegments) {
    throw new Error('life_movie_longform_segment_count_exceeded');
  }

  return ranges.map((range, index) => {
    const audioCues = value.audioCues
      .filter((cue) => cue.endMs > range.startMs && cue.startMs < range.endMs)
      .map((cue) => {
        const overlapStart = Math.max(cue.startMs, range.startMs);
        const overlapEnd = Math.min(cue.endMs, range.endMs);
        return {
          ...cue,
          startMs: overlapStart - range.startMs,
          endMs: overlapEnd - range.startMs,
          sourceStartMs: cue.sourceStartMs + (overlapStart - cue.startMs),
        };
      });

    if (audioCues.length > LIFE_MOVIE_EXECUTION_BUDGET.maxAudioCues) {
      throw new Error(`life_movie_longform_segment_audio_budget_exceeded:${index}`);
    }

    const timeline = range.items.map((item) => ({
      ...item,
      startMs: item.startMs - range.startMs,
      endMs: item.endMs - range.startMs,
    }));
    const usedSourceIds = new Set([
      ...timeline.map((item) => item.sourceId),
      ...audioCues.map((cue) => cue.sourceId),
    ]);
    const sources = [...usedSourceIds].map((id) => {
      const source = sourceById.get(id);
      if (!source) throw new Error(`life_movie_longform_unknown_source:${id}`);
      return source;
    });
    if (sources.length > LIFE_MOVIE_EXECUTION_BUDGET.maxSources) {
      throw new Error(`life_movie_longform_segment_source_budget_exceeded:${index}`);
    }

    const digest = childDigest(value.renderPlanDigest, index, range.startMs, range.endMs);
    const segmentName = String(index).padStart(4, '0');
    const payload = StudioLifeMovieRenderPayloadSchema.parse({
      schemaVersion: 'urai-life-movie-render-v1',
      projectId: value.projectId,
      renderPlanDigest: digest,
      sceneTruthReceiptRef: value.sceneTruthReceiptRef,
      sceneTruthDigest: value.sceneTruthDigest,
      outputPrefix: `${value.outputPrefix.replace(/\/+$/, '')}/segments/${segmentName}/`,
      width: value.width,
      height: value.height,
      fps: value.fps,
      sources,
      timeline,
      audioCues,
      subtitleText: '',
      spatialRequired: false,
      publicReleaseAuthorized: false,
      providerGenerationAuthorized: false,
    });

    return { index, startMs: range.startMs, endMs: range.endMs, childDigest: digest, payload };
  });
}
