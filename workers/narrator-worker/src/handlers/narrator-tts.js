"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNarratorTts = handleNarratorTts;
const text_to_speech_1 = require("@google-cloud/text-to-speech");
const storage_1 = require("@google-cloud/storage");
const node_crypto_1 = require("node:crypto");
const ttsClient = new text_to_speech_1.TextToSpeechClient();
const storage = new storage_1.Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
function normalizeAudioEncoding(format) {
    const normalized = String(format || 'MP3').toUpperCase();
    if (normalized === 'OGG_OPUS')
        return 'OGG_OPUS';
    return 'MP3';
}
function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('narrator.tts payload is required.');
    }
    const typed = payload;
    if (!typed.text || typeof typed.text !== 'string') {
        throw new Error('narrator.tts payload.text is required.');
    }
    return typed;
}
async function handleNarratorTts(job) {
    if (!BUCKET_NAME) {
        throw new Error('GCS_BUCKET_NAME environment variable is required.');
    }
    console.log(`Handling narrator.tts job: ${job.jobId}`);
    const payload = normalizePayload(job.payload);
    const audioEncoding = normalizeAudioEncoding(payload.format);
    const fileExtension = audioEncoding === 'OGG_OPUS' ? 'ogg' : 'mp3';
    const mimeType = audioEncoding === 'OGG_OPUS' ? 'audio/ogg' : 'audio/mpeg';
    const [response] = await ttsClient.synthesizeSpeech({
        input: { text: payload.text },
        voice: {
            languageCode: payload.locale || 'en-US',
            name: payload.voice || payload.voiceId,
        },
        audioConfig: { audioEncoding: audioEncoding },
    });
    if (!response.audioContent) {
        throw new Error('TTS synthesis failed to produce audio content.');
    }
    const audioBuffer = response.audioContent;
    const fileName = `${payload.outputPrefix || 'tts'}/${(0, node_crypto_1.randomUUID)()}.${fileExtension}`;
    const file = storage.bucket(BUCKET_NAME).file(fileName);
    await file.save(audioBuffer, {
        metadata: {
            contentType: mimeType,
        },
    });
    console.log(`Audio content written to GCS: gs://${BUCKET_NAME}/${fileName}`);
    return {
        artifactPath: `gs://${BUCKET_NAME}/${fileName}`,
        mimeType,
        size: audioBuffer.length,
    };
}
