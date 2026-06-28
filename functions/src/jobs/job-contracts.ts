import { z } from 'zod';

export const SUPPORTED_JOB_TYPES = ['narrator.tts'] as const;
export type SupportedJobType = (typeof SUPPORTED_JOB_TYPES)[number];

const outputPrefixSchema = z.string().trim().min(1).max(256).optional();

const narratorTtsPayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(5000),
    locale: z.string().trim().min(2).max(32).optional(),
    voice: z.string().trim().min(1).max(128).optional(),
    voiceId: z.string().trim().min(1).max(128).optional(),
    speed: z.number().min(0.25).max(4).optional(),
    format: z.enum(['MP3', 'OGG_OPUS']).default('MP3').optional(),
    outputPrefix: outputPrefixSchema,
  })
  .strict();

const payloadSchemas: Record<SupportedJobType, z.ZodType<Record<string, unknown>>> = {
  'narrator.tts': narratorTtsPayloadSchema,
};

export function isSupportedJobType(jobType: string): jobType is SupportedJobType {
  return (SUPPORTED_JOB_TYPES as readonly string[]).includes(jobType);
}

export function parseJobPayload(jobType: string, payload: unknown): Record<string, unknown> {
  if (!isSupportedJobType(jobType)) {
    throw new Error(`Unsupported job type: ${jobType}. Supported job types: ${SUPPORTED_JOB_TYPES.join(', ')}`);
  }

  const result = payloadSchemas[jobType].safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid ${jobType} payload: ${JSON.stringify(result.error.flatten())}`);
  }

  return result.data;
}
