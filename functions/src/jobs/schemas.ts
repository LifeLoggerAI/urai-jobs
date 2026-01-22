import { z } from 'zod';

export const jobSchemas = {
  render_cinematic: z.object({
    assetId: z.string(),
    resolution: z.enum(['1080p', '4k']),
    schemaVersion: z.literal(1),
  }),
  generate_clips: z.object({
    videoId: z.string(),
    clipDurationSeconds: z.number().min(5).max(60),
    schemaVersion: z.literal(1),
  }),
  transcribe_audio: z.object({
    audioUri: z.string().url(),
    language: z.string().optional().default('en-US'),
    schemaVersion: z.literal(1),
  }),
  tag_entities: z.object({
    text: z.string(),
    schemaVersion: z.literal(1),
  }),
  build_life_map_snapshot: z.object({
    userId: z.string(),
    schemaVersion: z.literal(1),
  }),
  send_digest_email: z.object({
    recipientEmail: z.string().email(),
    subject: z.string(),
    content: z.string(),
    schemaVersion: z.literal(1),
  }),
  export_scroll: z.object({
    scrollId: z.string(),
    format: z.enum(['pdf', 'json']),
    schemaVersion: z.literal(1),
  }),
  maintenance_compact_logs: z.object({
    daysToKeep: z.number().int().positive(),
    schemaVersion: z.literal(1),
  }),
};

export const enqueueJobRequestSchema = z.object({
  type: z.enum([
    'render_cinematic',
    'generate_clips',
    'transcribe_audio',
    'tag_entities',
    'build_life_map_snapshot',
    'send_digest_email',
    'export_scroll',
    'maintenance_compact_logs',
  ]),
  priority: z.number().min(0).max(100).optional().default(50),
  scheduledAt: z.string().datetime().optional(),
  payload: z.any(),
});
