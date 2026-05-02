import { Job, NarratorTtsPayload } from '@urai-jobs/shared-types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const ttsClient = new TextToSpeechClient();
const storage = new Storage();

// A real implementation would have a more robust way of getting the bucket name
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'urai-jobs-artifacts';

export async function handleNarratorTts(job: Job): Promise<any> {
  console.log(`Handling narrator.tts job: ${job.jobId}`);
  const payload = job.payload as NarratorTtsPayload;

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: payload.text },
    voice: { languageCode: payload.locale, name: payload.voice },
    audioConfig: { audioEncoding: payload.format as any },
  });

  if (!response.audioContent) {
    throw new Error('TTS synthesis failed to produce audio content.');
  }

  const audioBuffer = response.audioContent as Buffer;
  const fileExtension = (payload.format || 'mp3').toLowerCase();
  const fileName = `${payload.outputPrefix || 'tts'}/${uuidv4()}.${fileExtension}`;
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
