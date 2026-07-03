import { z } from 'zod';
import {
  buildReleaseSequencePlan as buildParsedReleaseSequencePlan,
  ReleasePlanRequestSchema,
} from './releaseSequencePlan.js';

export type ReleasePlanInput = z.input<typeof ReleasePlanRequestSchema>;

export function buildReleaseSequencePlan(input: ReleasePlanInput = {}) {
  return buildParsedReleaseSequencePlan(ReleasePlanRequestSchema.parse(input));
}
