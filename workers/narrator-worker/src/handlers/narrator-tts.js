"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNarratorTts = handleNarratorTts;
const text_to_speech_1 = require("@google-cloud/text-to-speech");
const storage_1 = require("@google-cloud/storage");
const node_crypto_1 = require("node:crypto");
const admin = __importStar(require("firebase-admin"));
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
function narratorCanonicalInput(job) {
    return (0, protected_spend_js_1.narratorSourceJson)({
        type: job.type || job.jobType, payload: job.payload, consent: job.consent, consents: job.consents,
    });
}
async function assertNarratorLifecycle(job) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId))
        throw new Error("narrator_canonical_project_required");
    if (typeof job.jobId !== "string" || !job.jobId || job.jobId.includes("/"))
        throw new Error("narrator_canonical_job_required");
    const name = "urai-narrator-canonical";
    const app = admin.apps.find(value => value?.name === name) || admin.initializeApp({ projectId }, name);
    if (app.options.projectId !== projectId)
        throw new Error("narrator_canonical_project_changed");
    const db = admin.firestore(app);
    let timer;
    try {
        await Promise.race([
            db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(db.collection("jobs").doc(job.jobId));
                const current = snapshot.exists ? snapshot.data() : null;
                if (!current || current.status !== "RUNNING" || current.ownerUid !== job.ownerUid
                    || current.tenantId !== job.tenantId || current.execution?.leaseToken !== job.leaseToken
                    || narratorCanonicalInput(current) !== narratorCanonicalInput(job))
                    throw new Error("narrator_canonical_job_changed");
                // The governed DELETE executor installs this permanent owner fence
                // before enumerating data. A RUNNING job or delayed consent callback
                // cannot authorize another paid call or retain a new output after it.
                const ownerHash = (0, protected_spend_js_1.narratorDigest)(current.ownerUid);
                const [localFence, centralFence] = await Promise.all([
                    transaction.get(db.collection("uraiPrivateLifeModelOwnerFences").doc(ownerHash)),
                    transaction.get(db.collection("privacyDeletionTombstones").doc(current.ownerUid)),
                ]);
                const own = localFence.exists ? localFence.data() : null;
                const central = centralFence.exists ? centralFence.data() : null;
                // Unknown or malformed durable deletion state grants no authority.
                if ((localFence.exists && (own?.ownerHash !== ownerHash || own?.deleted !== false))
                    || (centralFence.exists && (central?.uid !== current.ownerUid || central?.active !== false))) {
                    throw new Error("narrator_canonical_owner_deleted");
                }
                const valid = (value) => value && typeof value === "object"
                    && ["purpose", "policyVersion", "decisionReceiptId"].every(key => typeof value[key] === "string" && value[key].length > 0);
                const contexts = [current.consent, ...(Array.isArray(current.consents) ? current.consents : [])].filter(valid);
                const purposes = [...new Set(contexts.map(value => value.purpose))];
                const blocks = await Promise.all(purposes.map(purpose => transaction.get(db.collection("jobConsentBlocks")
                    .doc((0, protected_spend_js_1.narratorDigest)(current.ownerUid + "\n" + purpose)))));
                if (blocks.some(block => block.exists && block.data()?.active === true))
                    throw new Error("narrator_canonical_consent_revoked");
                if (current.payload?.provider === "elevenlabs") {
                    const auth = await transaction.get(db.doc("users/" + current.ownerUid + "/providerAuthorizations/elevenlabs"));
                    const data = auth.exists ? auth.data() : null;
                    const consent = current.consent;
                    if (!data || !valid(consent) || data.enabled !== true || data.provider !== "elevenlabs"
                        || data.ownerUid !== current.ownerUid || data.consentPurpose !== consent.purpose
                        || data.policyVersion !== consent.policyVersion || data.decisionReceiptId !== consent.decisionReceiptId
                        || !Array.isArray(data.voiceIds) || !data.voiceIds.includes(current.payload.voiceId)
                        || !data.rightsReceiptId || !data.provenanceRef)
                        throw new Error("narrator_canonical_voice_authority_revoked");
                    const expected = { provider: "elevenlabs", ownerUid: current.ownerUid,
                        consentReceiptId: data.decisionReceiptId, rightsReceiptId: data.rightsReceiptId,
                        provenanceRef: data.provenanceRef, voiceId: current.payload.voiceId };
                    if ((0, protected_spend_js_1.narratorSourceJson)(expected) !== (0, protected_spend_js_1.narratorSourceJson)(job.providerAuthorization))
                        throw new Error("narrator_canonical_voice_authority_changed");
                }
            }),
            new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error("narrator_canonical_read_timeout")), 5000); }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function synthesizeElevenLabs(payload, authorization, assertLifecycle) {
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
        async assertCurrent() {
            await assertLifecycle();
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
async function synthesizeGoogle(payload, assertLifecycle) {
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
            await assertLifecycle();
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
    let cleanup;
    try {
        return await (0, protected_spend_js_1.withProtectedNarratorSession)(job, async () => {
            const assertLifecycle = () => assertNarratorLifecycle(job);
            await assertLifecycle();
            const payload = normalizePayload(job.payload);
            const providerAuthorization = payload.provider === "elevenlabs"
                ? trustedProviderAuthorization(job, payload)
                : null;
            const synthesis = payload.provider === "elevenlabs"
                ? await synthesizeElevenLabs(payload, providerAuthorization, assertLifecycle)
                : await synthesizeGoogle(payload, assertLifecycle);
            (0, protected_spend_js_1.assertProtectedNarratorCurrent)();
            await assertLifecycle();
            const { audioBuffer, fileExtension, mimeType } = synthesis;
            const outputNonce = (0, node_crypto_1.randomUUID)();
            const fileName = `${payload.outputPrefix || "tts"}/${outputNonce}.${fileExtension}`;
            const file = storage.bucket(BUCKET_NAME).file(fileName);
            const ownedOutput = { uraiNarratorOutputNonce: outputNonce, uraiNarratorJobId: job.jobId,
                uraiNarratorLeaseSha256: (0, protected_spend_js_1.narratorDigest)(job.leaseToken), uraiNarratorOwnerSha256: (0, protected_spend_js_1.narratorDigest)(job.ownerUid) };
            // Only erase the exact new output generation bearing this attempt's marker.
            // Existing originals and a concurrently replaced object never become cleanup targets.
            let ownedGeneration;
            const eraseOwnedOutput = async () => {
                let metadata;
                try {
                    [metadata] = await file.getMetadata();
                }
                catch (error) {
                    if (error.code === 404)
                        return;
                    throw error;
                }
                if (!metadata.generation || !Object.entries(ownedOutput).every(([key, value]) => metadata.metadata?.[key] === value)) {
                    throw new Error("narrator_output_cleanup_authority_mismatch");
                }
                if (ownedGeneration && ownedGeneration !== String(metadata.generation))
                    throw new Error("narrator_output_generation_changed");
                ownedGeneration = String(metadata.generation);
                await file.delete({ ignoreNotFound: true, ifGenerationMatch: ownedGeneration });
            };
            cleanup = async () => {
                let timer;
                try {
                    await Promise.race([eraseOwnedOutput(), new Promise((_resolve, reject) => {
                            timer = setTimeout(() => reject(new Error("narrator_output_cleanup_timeout")), 5000);
                        })]);
                }
                finally {
                    if (timer)
                        clearTimeout(timer);
                }
            };
            try {
                (0, protected_spend_js_1.assertProtectedNarratorCurrent)();
                await file.save(audioBuffer, {
                    preconditionOpts: { ifGenerationMatch: 0 },
                    metadata: {
                        contentType: mimeType,
                        metadata: {
                            ...ownedOutput,
                            uraiProvider: synthesis.provider,
                            uraiModelId: synthesis.modelId,
                            uraiVoiceId: synthesis.voiceId,
                            uraiProvenanceRef: providerAuthorization?.provenanceRef || "provider-native",
                        },
                    },
                });
                (0, protected_spend_js_1.assertProtectedNarratorCurrent)();
                await assertLifecycle();
            }
            catch (error) {
                // The outer deadline may return before Storage completes. Its continuation
                // still erases only this attempt's newly created output generation.
                try {
                    await cleanup();
                }
                catch {
                    throw new Error("narrator_output_cleanup_incomplete");
                }
                throw error;
            }
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
    catch (error) {
        if (cleanup) {
            try {
                await cleanup();
            }
            catch {
                throw new Error("narrator_output_cleanup_incomplete");
            }
        }
        throw error;
    }
}
