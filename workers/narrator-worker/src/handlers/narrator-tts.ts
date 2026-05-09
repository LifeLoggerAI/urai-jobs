import { Job, NarratorTtsPayload } from '@urai-jobs/shared-types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';

const ttsClient = new TextToSpeechClient();
const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

function normalizeAudioEncoding(format: unknown): 'MP3' | 'OGG_OPUS' {
  const normalized = String(format || 'MP3').toUpperCase();
  if (normalized === 'OGG_OPUS') return 'OGG_OPUS';
  return 'MP3';
}

export async function handleNarratorTts(job: Job): Promise<any> {
  if (!BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME environment variable is required.');
  }

  console.log(`Handling narrator.tts job: ${job.jobId}`);
  const payload = job.payload as NarratorTtsPayload;
  const audioEncoding = normalizeAudioEncoding(payload.format);
  const fileExtension = audioEncoding === 'OGG_OPUS' ? 'ogg' : 'mp3';
  const mimeType = audioEncoding === 'OGG_OPUS' ? 'audio/ogg' : 'audio/mpeg';

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: payload.text },
    voice: { languageCode: payload.locale, name: payload.voice },
    audioConfig: { audioEncoding: audioEncoding as any },
  });

  if (!response.audioContent) {
    throw new Error('TTS synthesis failed to produce audio content.');
  }

  const audioBuffer = response.audioContent as Buffer;
  const fileName = `${payload.outputPrefix || 'tts'}/${randomUUID()}.${fileExtension}`;
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
