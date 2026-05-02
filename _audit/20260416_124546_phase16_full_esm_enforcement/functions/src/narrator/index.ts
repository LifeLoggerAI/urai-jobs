import { NarratorTtsPayload } from '../shared-types.js';
import { createJob } from '../core/jobs.js';

function isNarratorTtsPayload(value: any): value is NarratorTtsPayload {
  return !!value && typeof value === 'object' && typeof value.text === 'string';
}

export async function queueNarratorTts(payload: unknown, ownerId: string) {
  if (!isNarratorTtsPayload(payload)) {
    throw new Error('Invalid narrator TTS payload');
  }

  return createJob('narrator.tts', payload, ownerId);
}
