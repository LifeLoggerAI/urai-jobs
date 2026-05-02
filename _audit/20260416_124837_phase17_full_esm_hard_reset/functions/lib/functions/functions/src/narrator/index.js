import { createJob } from '../core/jobs';
function isNarratorTtsPayload(value) {
    return !!value && typeof value === 'object' && typeof value.text === 'string';
}
export async function queueNarratorTts(payload, ownerId) {
    if (!isNarratorTtsPayload(payload)) {
        throw new Error('Invalid narrator TTS payload');
    }
    return createJob('narrator.tts', payload, ownerId);
}
