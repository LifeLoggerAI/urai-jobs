import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

const ttsClient = new TextToSpeechClient();
const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

type NarratorTtsPayload = {
  text: string;
  locale?: string;
  voice?: string;
  voiceId?: string;
  format?: string;
  outputPrefix?: string;
};

function normalizeAudioEncoding(format: unknown): "MP3" | "OGG_OPUS" {
  const normalized = String(format || "MP3").toUpperCase();
  if (normalized === "OGG_OPUS") return "OGG_OPUS";
  return "MP3";
}

function normalizePayload(payload: unknown): NarratorTtsPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("narrator.tts payload is required.");
  }

  const typed = payload as Partial<NarratorTtsPayload>;

  if (!typed.text || typeof typed.text !== "string") {
    throw new Error("narrator.tts payload.text is required.");
  }

  return {
    text: typed.text,
    locale: typed.locale,
    voice: typed.voice,
    voiceId: typed.voiceId,
    format: typed.format,
    outputPrefix: typed.outputPrefix,
  };
}

export async function handleNarratorTts(job: any) {
  if (!BUCKET_NAME) {
    throw new Error("GCS_BUCKET_NAME environment variable is required.");
  }

  console.log(`Handling narrator.tts job: ${job.jobId}`);

  const payload = normalizePayload(job.payload);
  const audioEncoding = normalizeAudioEncoding(payload.format);
  const fileExtension = audioEncoding === "OGG_OPUS" ? "ogg" : "mp3";
  const mimeType = audioEncoding === "OGG_OPUS" ? "audio/ogg" : "audio/mpeg";

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: payload.text },
    voice: {
      languageCode: payload.locale || "en-US",
      name: payload.voice || payload.voiceId,
    },
    audioConfig: { audioEncoding },
  });

  if (!response.audioContent) {
    throw new Error("TTS synthesis failed to produce audio content.");
  }

  const audioBuffer = Buffer.isBuffer(response.audioContent)
    ? response.audioContent
    : Buffer.from(response.audioContent as Uint8Array);

  const fileName = `${payload.outputPrefix || "tts"}/${randomUUID()}.${fileExtension}`;
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
