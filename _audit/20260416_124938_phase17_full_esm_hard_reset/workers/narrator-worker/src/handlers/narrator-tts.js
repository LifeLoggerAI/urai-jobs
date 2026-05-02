"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNarratorTts = handleNarratorTts;
const text_to_speech_1 = require("@google-cloud/text-to-speech");
const storage_1 = require("@google-cloud/storage");
const uuid_1 = require("uuid");
const ttsClient = new text_to_speech_1.TextToSpeechClient();
const storage = new storage_1.Storage();
// A real implementation would have a more robust way of getting the bucket name
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'urai-jobs-artifacts';
async function handleNarratorTts(job) {
    console.log(`Handling narrator.tts job: ${job.jobId}`);
    const payload = job.payload;
    const [response] = await ttsClient.synthesizeSpeech({
        input: { text: payload.text },
        voice: { languageCode: payload.locale, name: payload.voice },
        audioConfig: { audioEncoding: payload.format },
    });
    if (!response.audioContent) {
        throw new Error('TTS synthesis failed to produce audio content.');
    }
    const audioBuffer = response.audioContent;
    const fileExtension = (payload.format || 'mp3').toLowerCase();
    const fileName = `${payload.outputPrefix || 'tts'}/${(0, uuid_1.v4)()}.${fileExtension}`;
    const file = storage.bucket(BUCKET_NAME).file(fileName);
    await file.save(audioBuffer, {
        metadata: {
            contentType: `audio/${fileExtension}`,
        },
    });
    console.log(`Audio content written to GCS: gs://${BUCKET_NAME}/${fileName}`);
    return {
        artifactPath: `gs://${BUCKET_NAME}/${fileName}`,
        mimeType: `audio/${fileExtension}`,
        size: audioBuffer.length,
    };
}
