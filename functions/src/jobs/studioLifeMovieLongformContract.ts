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
    const source = value.sources.find((candidate) => candidate.id === item.sourceId);
    if (source?.mimeType.startsWith('image/') && (item.sourceStartMs ?? 0) !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index, 'sourceStartMs'], message: 'Still-image source time must be zero.' });
    }
    if (item.endMs - item.startMs > LIFE_MOVIE_LONGFORM_BUDGET.maxSegmentDurationMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', index], message: 'Long-form source intervals must be 15 seconds or less; the planner never hides an unbounded transcode inside segmentation.' });
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

export function assertLifeMovieLongformTenantPaths(payload: StudioLifeMovieLongformPayload, tenantId: string) {
  const allowedSourcePrefixes = [`studios/${tenantId}/`, `tenants/${tenantId}/`];
  const requiredOutputPrefix = `tenants/${tenantId}/life-movies/${payload.projectId}/`;
  if (!payload.outputPrefix.startsWith(requiredOutputPrefix)) {
    throw new Error('life_movie_longform_output_outside_tenant_project');
  }
  if (payload.sources.some((source) => !allowedSourcePrefixes.some((prefix) => source.objectPath.startsWith(prefix)))) {
    throw new Error('life_movie_longform_source_outside_tenant');
  }
  return payload;
}

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

type SubtitleCue = { startMs: number; endMs: number; text: string };

function parseSrtTimestamp(value: string) {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value.trim());
  if (!match) throw new Error('life_movie_longform_invalid_subtitles');
  const [, hours, minutes, seconds, millis] = match;
  const h = Number(hours);
  const m = Number(minutes);
  const s = Number(seconds);
  const ms = Number(millis);
  if (m > 59 || s > 59) throw new Error('life_movie_longform_invalid_subtitles');
  return (((h * 60 + m) * 60 + s) * 1000) + ms;
}

function formatSrtTimestamp(value: number) {
  const bounded = Math.max(0, Math.trunc(value));
  const hours = Math.floor(bounded / 3_600_000);
  const minutes = Math.floor((bounded % 3_600_000) / 60_000);
  const seconds = Math.floor((bounded % 60_000) / 1000);
  const millis = bounded % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function parseSrt(value: string): SubtitleCue[] {
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  return normalized.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    const timeIndex = lines[0]?.includes('-->') ? 0 : 1;
    const timing = lines[timeIndex] ?? '';
    const match = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})(?:\s+.*)?$/.exec(timing.trim());
    const text = lines.slice(timeIndex + 1).join('\n').trim();
    if (!match || !text) throw new Error('life_movie_longform_invalid_subtitles');
    const startMs = parseSrtTimestamp(match[1]);
    const endMs = parseSrtTimestamp(match[2]);
    if (endMs <= startMs) throw new Error('life_movie_longform_invalid_subtitles');
    return { startMs, endMs, text };
  });
}

function segmentSubtitleText(value: string, startMs: number, endMs: number) {
  const cues = parseSrt(value)
    .filter((cue) => cue.endMs > startMs && cue.startMs < endMs)
    .map((cue) => ({
      startMs: Math.max(cue.startMs, startMs) - startMs,
      endMs: Math.min(cue.endMs, endMs) - startMs,
      text: cue.text,
    }));
  return cues.map((cue, index) =>
    `${index + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}`
  ).join('\n\n') + (cues.length ? '\n' : '');
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
      subtitleText: segmentSubtitleText(value.subtitleText, range.startMs, range.endMs),
      spatialRequired: false,
      publicReleaseAuthorized: false,
      providerGenerationAuthorized: false,
    });

    return { index, startMs: range.startMs, endMs: range.endMs, childDigest: digest, payload };
  });
}
