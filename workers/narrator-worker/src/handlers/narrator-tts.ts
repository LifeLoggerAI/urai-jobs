import { Job, NarratorTtsPayload } from '@urai-jobs/shared-types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const ttsClient = new TextToSpeechClient();
const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'urai-jobs-artifacts';

const AUDIO_FORMATS: Record<string, string> = {
  mp3: 'MP3',
  linear16: 'LINEAR16',
  ogg_opus: 'OGG_OPUS',
  mulaw: 'MULAW',
  alaw: 'ALAW'
};

function requirePayload(job: Job): NarratorTtsPayload {
  const payload = (job.payload || {}) as NarratorTtsPayload;

  if (!payload.text || typeof payload.text !== 'string') {
    throw new Error('narrator.tts payload.text is required.');
  }

  return payload;
}

function normalizeAudioEncoding(format: string | undefined): string {
  const raw = String(format || 'mp3').trim();
  return AUDIO_FORMATS[raw.toLowerCase()] || raw.toUpperCase();
}

function extensionForEncoding(encoding: string): string {
  if (encoding === 'MP3') return 'mp3';
  if (encoding === 'OGG_OPUS') return 'ogg';
  if (encoding === 'LINEAR16') return 'wav';
  return encoding.toLowerCase();
}

export async function handleNarratorTts(job: Job): Promise<any> {
  console.log(`Handling narrator.tts job: ${job.jobId}`);
  const payload = requirePayload(job);
  const audioEncoding = normalizeAudioEncoding(payload.format);
  const languageCode = payload.locale || 'en-US';

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: payload.text },
    voice: { languageCode, name: payload.voice || payload.voiceId },
    audioConfig: {
      audioEncoding: audioEncoding as any,
      speakingRate: payload.speed,
    },
  });

  if (!response.audioContent) {
    throw new Error('TTS synthesis failed to produce audio content.');
  }

  const audioBuffer = response.audioContent as Buffer;
  const fileExtension = extensionForEncoding(audioEncoding);
  const outputPrefix = String(payload.outputPrefix || 'tts').replace(/^\/+|\/+$/g, '') || 'tts';
  const fileName = `${outputPrefix}/${uuidv4()}.${fileExtension}`;
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
