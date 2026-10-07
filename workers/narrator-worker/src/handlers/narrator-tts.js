"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNarratorTts = handleNarratorTts;
const text_to_speech_1 = require("@google-cloud/text-to-speech");
const storage_1 = require("@google-cloud/storage");
const node_crypto_1 = require("node:crypto");
const protected_spend_js_1 = require("../protected-spend.js");
const ttsClient = new text_to_speech_1.TextToSpeechClient();
const storage = new storage_1.Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
function normalizeAudioEncoding(format) {
    const normalized = String(format || "MP3").toUpperCase();
    if (normalized === "OGG_OPUS")
        return "OGG_OPUS";
    return "MP3";
}
function normalizePayload(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("narrator.tts payload is required.");
    }
    const typed = payload;
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
function nonEmpty(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function allowedElevenLabsVoiceIds() {
    return new Set(String(process.env.ELEVENLABS_ALLOWED_VOICE_IDS || "")
        .split(";")
        .map((value) => value.trim())
        .filter(Boolean));
}
function trustedProviderAuthorization(job, payload) {
    const authorization = job?.providerAuthorization;
    if (!authorization || typeof authorization !== "object") {
        throw new Error("elevenlabs_server_authorization_required");
    }
    const typed = authorization;
    if (typed.provider !== "elevenlabs" ||
        !nonEmpty(typed.ownerUid) ||
        typed.ownerUid !== job?.ownerUid ||
        !nonEmpty(typed.consentReceiptId) ||
        !nonEmpty(typed.rightsReceiptId) ||
        !nonEmpty(typed.provenanceRef) ||
        !nonEmpty(typed.voiceId) ||
        typed.voiceId !== payload.voiceId) {
        throw new Error("elevenlabs_server_authorization_invalid");
    }
    return typed;
}
async function synthesizeElevenLabs(payload, authorization) {
    if (process.env.URAI_NARRATOR_ELEVENLABS_ENABLED !== "true") {
        throw new Error("elevenlabs_provider_disabled");
    }
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey)
        throw new Error("elevenlabs_api_key_unconfigured");
    if (!nonEmpty(payload.voiceId))
        throw new Error("elevenlabs_voice_id_required");
    const allowed = allowedElevenLabsVoiceIds();
    if (!allowed.size || !allowed.has(payload.voiceId))
        throw new Error("elevenlabs_voice_not_allowlisted");
    const maxCharacters = Math.max(1, Math.min(5000, Number(process.env.ELEVENLABS_MAX_CHARACTERS_PER_REQUEST || 1200)));
    if (payload.text.length > maxCharacters)
        throw new Error("elevenlabs_text_limit_exceeded");
    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
    const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128";
    if (outputFormat !== "mp3_44100_128") {
        throw new Error("elevenlabs_output_format_not_verified");
    }
    const headers = {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    };
    const body = JSON.stringify({ text: payload.text, model_id: modelId });
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(payload.voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    const response = await (0, protected_spend_js_1.paidNarratorFetch)("elevenlabs", modelId, {
        endpoint, headers, body,
        assertCurrent() {
            if (process.env.URAI_NARRATOR_ELEVENLABS_ENABLED !== "true"
                || process.env.ELEVENLABS_API_KEY?.trim() !== apiKey
                || !allowedElevenLabsVoiceIds().has(payload.voiceId)
                || (process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2") !== modelId
                || (process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128") !== outputFormat
                || payload.text.length > Math.max(1, Math.min(5000, Number(process.env.ELEVENLABS_MAX_CHARACTERS_PER_REQUEST || 1200)))) {
                throw new Error("elevenlabs_configuration_changed_before_submission");
            }
        },
    });
    if (!response.ok)
        throw new Error(`elevenlabs_http_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length)
        throw new Error("elevenlabs_empty_audio");
    return {
        audioBuffer: bytes,
        audioEncoding: "MP3",
        fileExtension: "mp3",
        mimeType: "audio/mpeg",
        provider: "elevenlabs",
        modelId,
        voiceId: payload.voiceId,
    };
}
async function googleCredentials() {
    // Read the actual ADC client and effective quota project. No caller account label authorizes spend.
    const client = await ttsClient.auth.getClient();
    const access = await client.getAccessToken();
    if (!access.token)
        throw new Error("google_adc_access_token_unavailable");
    const credentials = await ttsClient.auth.getCredentials();
    const principal = credentials.client_email;
    if (!nonEmpty(principal))
        throw new Error("google_adc_principal_unavailable");
    const quotaProject = client.quotaProjectId || await ttsClient.auth.getProjectId();
    if (!nonEmpty(quotaProject))
        throw new Error("google_adc_quota_project_unavailable");
    const expiresAt = client.credentials.expiry_date;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
        throw new Error("google_adc_token_expiry_unavailable");
    return { token: access.token, principal, quotaProject, expiresAt: expiresAt };
}
async function synthesizeGoogle(payload) {
    const audioEncoding = normalizeAudioEncoding(payload.format);
    const body = JSON.stringify({
        input: { text: payload.text },
        voice: {
            languageCode: payload.locale || "en-US",
            name: payload.voice || payload.voiceId,
        },
        audioConfig: { audioEncoding },
    });
    const credential = await googleCredentials();
    const headers = { authorization: `Bearer ${credential.token}`, "content-type": "application/json; charset=utf-8", "x-goog-user-project": credential.quotaProject, accept: "application/json" };
    const binding = (0, protected_spend_js_1.narratorHeaderBindings)(headers);
    const response = await (0, protected_spend_js_1.paidNarratorFetch)("google", "google-cloud-text-to-speech", {
        endpoint: "https://texttospeech.googleapis.com/v1/text:synthesize", headers, body, credentialExpiresAt: credential.expiresAt, actualAccountId: `google:${credential.quotaProject}:${credential.principal}`,
        async assertCurrent() {
            const current = await googleCredentials();
            if (current.principal !== credential.principal || current.quotaProject !== credential.quotaProject || current.expiresAt !== credential.expiresAt
                || (0, protected_spend_js_1.narratorSourceJson)((0, protected_spend_js_1.narratorHeaderBindings)({ ...headers, authorization: `Bearer ${current.token}`, "x-goog-user-project": current.quotaProject })) !== (0, protected_spend_js_1.narratorSourceJson)(binding)) {
                throw new Error("google_adc_binding_changed_before_submission");
            }
        },
    });
    if (!response.ok)
        throw new Error(`google_tts_http_${response.status}`);
    const result = await response.json();
    if (typeof result.audioContent !== "string" || !result.audioContent || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.audioContent))
        throw new Error("google_tts_audio_content_invalid");
    const audioBuffer = Buffer.from(result.audioContent, "base64");
    if (!audioBuffer.length)
        throw new Error("TTS synthesis failed to produce audio content.");
    return {
        audioBuffer,
        audioEncoding,
        fileExtension: audioEncoding === "OGG_OPUS" ? "ogg" : "mp3",
        mimeType: audioEncoding === "OGG_OPUS" ? "audio/ogg" : "audio/mpeg",
        provider: "google",
        modelId: "google-cloud-text-to-speech",
        voiceId: payload.voice || payload.voiceId || "default",
    };
}
async function handleNarratorTts(job) {
    if (!BUCKET_NAME) {
        throw new Error("GCS_BUCKET_NAME environment variable is required.");
    }
    console.log(`Handling narrator.tts job: ${job.jobId}`);
    return (0, protected_spend_js_1.withProtectedNarratorSession)(job, async () => {
        const payload = normalizePayload(job.payload);
        const providerAuthorization = payload.provider === "elevenlabs"
            ? trustedProviderAuthorization(job, payload)
            : null;
        const synthesis = payload.provider === "elevenlabs"
            ? await synthesizeElevenLabs(payload, providerAuthorization)
            : await synthesizeGoogle(payload);
        const { audioBuffer, fileExtension, mimeType } = synthesis;
        const fileName = `${payload.outputPrefix || "tts"}/${(0, node_crypto_1.randomUUID)()}.${fileExtension}`;
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
    });
}
