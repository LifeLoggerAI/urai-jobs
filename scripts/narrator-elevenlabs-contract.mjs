import assert from 'node:assert/strict';
import fs from 'node:fs';

const handler = fs.readFileSync(new URL('../workers/narrator-worker/src/handlers/narrator-tts.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../workers/narrator-worker/src/index.ts', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./deploy-workers.sh', import.meta.url), 'utf8');

for (const token of [
  'provider?: "google" | "elevenlabs"',
  'externalProcessingConsent?: boolean',
  'providerExecutionAuthorized?: boolean',
  'voiceConsentRef?: string',
  'voiceRightsRef?: string',
  'provenanceRef?: string',
  'elevenlabs_provider_disabled',
  'elevenlabs_api_key_unconfigured',
  'elevenlabs_provider_execution_not_authorized',
  'elevenlabs_external_processing_consent_required',
  'elevenlabs_voice_consent_required',
  'elevenlabs_voice_rights_required',
  'elevenlabs_voice_provenance_required',
  'elevenlabs_voice_not_allowlisted',
  'elevenlabs_text_limit_exceeded',
  'ELEVENLABS_ALLOWED_VOICE_IDS',
  'ELEVENLABS_MODEL_ID',
  'ELEVENLABS_OUTPUT_FORMAT',
  '"xi-api-key": apiKey',
  'provider: synthesis.provider',
  'provenanceRef: payload.provenanceRef',
  'consentRef: payload.voiceConsentRef',
  'rightsRef: payload.voiceRightsRef',
]) assert.ok(handler.includes(token), `governed narrator contract missing ${token}`);

assert.ok(handler.indexOf('providerExecutionAuthorized !== true') < handler.indexOf('fetch('),
  'provider authorization must fail before network provider execution');
assert.ok(handler.indexOf('externalProcessingConsent !== true') < handler.indexOf('fetch('),
  'external processing consent must fail before network provider execution');
assert.ok(handler.indexOf('voiceConsentRef') < handler.indexOf('fetch('),
  'voice consent must be evaluated before network provider execution');
assert.ok(handler.indexOf('voiceRightsRef') < handler.indexOf('fetch('),
  'voice rights must be evaluated before network provider execution');
assert.ok(handler.indexOf('allowedElevenLabsVoiceIds') < handler.indexOf('fetch('),
  'voice allowlist must be evaluated before provider execution');

for (const token of [
  "URAI_NARRATOR_ELEVENLABS_ENABLED === 'true'",
  'elevenLabsApiKey',
  'elevenLabsVoiceAllowlist',
]) assert.ok(runtime.includes(token), `narrator readiness missing ${token}`);

assert.ok(runtime.includes('!elevenLabsEnabled || Boolean(process.env.ELEVENLABS_API_KEY)'));
assert.ok(runtime.includes('!elevenLabsEnabled || Boolean(process.env.ELEVENLABS_ALLOWED_VOICE_IDS)'));

console.log('Governed ElevenLabs narrator provider contract passed');


for (const token of [
  'URAI_NARRATOR_ELEVENLABS_ENABLED:=false',
  'ELEVENLABS_API_KEY_SECRET:=ELEVENLABS_API_KEY',
  'ELEVENLABS_ALLOWED_VOICE_IDS is required when ElevenLabs narrator execution is enabled',
  'required_secrets+=("$ELEVENLABS_API_KEY_SECRET")',
  'versions.ELEVENLABS_API_KEY = process.env.ELEVENLABS_SECRET_VERSION',
  'URAI_NARRATOR_ELEVENLABS_ENABLED=$URAI_NARRATOR_ELEVENLABS_ENABLED',
  'ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY_SECRET}:${SECRET_VERSION_IDS[$ELEVENLABS_API_KEY_SECRET]}',
]) assert.ok(deploy.includes(token), `narrator deploy boundary missing ${token}`);

assert.ok(deploy.includes('if [ "$worker" = "narrator-worker" ] && [ "$URAI_NARRATOR_ELEVENLABS_ENABLED" = "true" ]'));
assert.ok(deploy.includes('if [ "$worker" = "narrator-worker" ]; then'));
