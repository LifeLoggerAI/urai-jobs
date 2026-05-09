import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import type { Job } from './index.js';

interface NarratorTtsPayload {
  text: string;
  locale?: string;
  voice?: string;
  voiceId?: string;
  speed?: number;
  format?: string;
  outputPrefix?: string;
}

const ttsClient = new TextToSpeechClient();
const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

function normalizeAudioEncoding(format: unknown): 'MP3' | 'OGG_OPUS' {
  const normalized = String(format || 'MP3').toUpperCase();
  if (normalized === 'OGG_OPUS') return 'OGG_OPUS';
  return 'MP3';
}

function normalizePayload(payload: unknown): NarratorTtsPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('narrator.tts payload is required.');
  }

  const typed = payload as NarratorTtsPayload;
  if (!typed.text || typeof typed.text !== 'string') {
    throw new Error('narrator.tts payload.text is required.');
  }

  return typed;
}

export async function handleNarratorTts(job: Job): Promise<any> {
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
