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
  provider?: "google" | "elevenlabs";
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
    provider: typed.provider === "elevenlabs" ? "elevenlabs" : "google",
  };
}


function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function allowedElevenLabsVoiceIds() {
  return new Set(
    String(process.env.ELEVENLABS_ALLOWED_VOICE_IDS || "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

type TrustedProviderAuthorization = {
  provider: "elevenlabs";
  ownerUid: string;
  consentReceiptId: string;
  rightsReceiptId: string;
  provenanceRef: string;
  voiceId: string;
};

function trustedProviderAuthorization(job: any, payload: NarratorTtsPayload): TrustedProviderAuthorization {
  const authorization = job?.providerAuthorization;
  if (!authorization || typeof authorization !== "object") {
    throw new Error("elevenlabs_server_authorization_required");
  }
  const typed = authorization as Partial<TrustedProviderAuthorization>;
  if (
    typed.provider !== "elevenlabs" ||
    !nonEmpty(typed.ownerUid) ||
    typed.ownerUid !== job?.ownerUid ||
    !nonEmpty(typed.consentReceiptId) ||
    !nonEmpty(typed.rightsReceiptId) ||
    !nonEmpty(typed.provenanceRef) ||
    !nonEmpty(typed.voiceId) ||
    typed.voiceId !== payload.voiceId
  ) {
    throw new Error("elevenlabs_server_authorization_invalid");
  }
  return typed as TrustedProviderAuthorization;
}

async function synthesizeElevenLabs(payload: NarratorTtsPayload, authorization: TrustedProviderAuthorization) {
  if (process.env.URAI_NARRATOR_ELEVENLABS_ENABLED !== "true") {
    throw new Error("elevenlabs_provider_disabled");
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("elevenlabs_api_key_unconfigured");
  if (!nonEmpty(payload.voiceId)) throw new Error("elevenlabs_voice_id_required");

  const allowed = allowedElevenLabsVoiceIds();
  if (!allowed.size || !allowed.has(payload.voiceId)) throw new Error("elevenlabs_voice_not_allowlisted");

  const maxCharacters = Math.max(1, Math.min(5000, Number(process.env.ELEVENLABS_MAX_CHARACTERS_PER_REQUEST || 1200)));
  if (payload.text.length > maxCharacters) throw new Error("elevenlabs_text_limit_exceeded");

  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128";
  if (outputFormat !== "mp3_44100_128") {
    throw new Error("elevenlabs_output_format_not_verified");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(payload.voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: payload.text,
          model_id: modelId,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`elevenlabs_http_${response.status}:${body.replace(/\s+/g, " ")}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("elevenlabs_empty_audio");
    return {
      audioBuffer: bytes,
      audioEncoding: "MP3" as const,
      fileExtension: "mp3",
      mimeType: "audio/mpeg",
      provider: "elevenlabs" as const,
      modelId,
      voiceId: payload.voiceId,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeGoogle(payload: NarratorTtsPayload) {
  const audioEncoding = normalizeAudioEncoding(payload.format);
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

  return {
    audioBuffer: Buffer.isBuffer(response.audioContent)
      ? response.audioContent
      : Buffer.from(response.audioContent as Uint8Array),
    audioEncoding,
    fileExtension: audioEncoding === "OGG_OPUS" ? "ogg" : "mp3",
    mimeType: audioEncoding === "OGG_OPUS" ? "audio/ogg" : "audio/mpeg",
    provider: "google" as const,
    modelId: "google-cloud-text-to-speech",
    voiceId: payload.voice || payload.voiceId || "default",
  };
}

export async function handleNarratorTts(job: any) {
  if (!BUCKET_NAME) {
    throw new Error("GCS_BUCKET_NAME environment variable is required.");
  }

  console.log(`Handling narrator.tts job: ${job.jobId}`);

  const payload = normalizePayload(job.payload);
  const providerAuthorization = payload.provider === "elevenlabs"
    ? trustedProviderAuthorization(job, payload)
    : null;
  const synthesis = payload.provider === "elevenlabs"
    ? await synthesizeElevenLabs(payload, providerAuthorization as TrustedProviderAuthorization)
    : await synthesizeGoogle(payload);
  const { audioBuffer, fileExtension, mimeType } = synthesis;

  const fileName = `${payload.outputPrefix || "tts"}/${randomUUID()}.${fileExtension}`;
  const file = storage.bucket(BUCKET_NAME).file(fileName);

  await file.save(audioBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        uraiProvider: synthesis.provider,
        uraiModelId: synthesis.modelId,
        uraiVoiceId: synthesis.voiceId,
        uraiProvenanceRef: providerAuthorization?.provenanceRef || "provider-native",
      },
    },
  });

  console.log(`Audio content written to GCS: gs://${BUCKET_NAME}/${fileName}`);

  return {
    artifactPath: `gs://${BUCKET_NAME}/${fileName}`,
    mimeType,
    size: audioBuffer.length,
    provider: synthesis.provider,
    modelId: synthesis.modelId,
    voiceId: synthesis.voiceId,
    provenanceRef: providerAuthorization?.provenanceRef || "provider-native",
    consentRef: providerAuthorization?.consentReceiptId || null,
    rightsRef: providerAuthorization?.rightsReceiptId || null,
  };
}
