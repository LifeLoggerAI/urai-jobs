import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const handler = fs.readFileSync(new URL('../workers/narrator-worker/src/handlers/narrator-tts.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../workers/narrator-worker/src/index.ts', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./deploy-workers.sh', import.meta.url), 'utf8');
const approvedDeploy = fs.readFileSync(new URL('./deploy-workers-approved.sh', import.meta.url), 'utf8');
const executeJob = fs.readFileSync(new URL('../functions/src/jobs/executeJob.ts', import.meta.url), 'utf8');

for (const token of [
  'provider?: "google" | "elevenlabs"',
  'elevenlabs_provider_disabled',
  'elevenlabs_api_key_unconfigured',
  'elevenlabs_server_authorization_required',
  'elevenlabs_server_authorization_invalid',
  'elevenlabs_voice_not_allowlisted',
  'elevenlabs_text_limit_exceeded',
  'elevenlabs_output_format_not_verified',
  'ELEVENLABS_ALLOWED_VOICE_IDS',
  'ELEVENLABS_MODEL_ID',
  'ELEVENLABS_OUTPUT_FORMAT',
  '"xi-api-key": apiKey',
  'provider: synthesis.provider',
  'providerAuthorization?.provenanceRef',
  'providerAuthorization?.consentReceiptId',
  'providerAuthorization?.rightsReceiptId',
]) assert.ok(handler.includes(token), `governed narrator contract missing ${token}`);

for (const forbidden of [
  'providerExecutionAuthorized?: boolean',
  'externalProcessingConsent?: boolean',
  'voiceConsentRef?: string',
  'voiceRightsRef?: string',
]) assert.ok(!handler.includes(forbidden), `caller-controlled authorization field remains: ${forbidden}`);

const handleStart = handler.indexOf('export async function handleNarratorTts');
assert.ok(handleStart >= 0, 'narrator handler entry point must exist');
const handleBody = handler.slice(handleStart);
assert.ok(handleBody.indexOf('trustedProviderAuthorization(job, payload)') >= 0,
  'trusted provider authorization must be evaluated by the narrator handler');
assert.ok(
  handleBody.indexOf('trustedProviderAuthorization(job, payload)') < handleBody.indexOf('synthesizeElevenLabs(payload, providerAuthorization'),
  'trusted provider authorization must be evaluated before ElevenLabs synthesis is invoked',
);
const synthesisStart = handler.indexOf('async function synthesizeElevenLabs');
const synthesisBody = handler.slice(synthesisStart, handleStart);
assert.ok(synthesisStart >= 0 && synthesisBody.indexOf('allowedElevenLabsVoiceIds') < synthesisBody.indexOf('paidNarratorFetch("elevenlabs"'),
  'voice allowlist must be evaluated before provider execution');
assert.ok(!synthesisBody.includes('await fetch(') && !handler.includes('ttsClient.synthesizeSpeech('),
  'every narrator paid provider leaf must use protected exact REST dispatch');
assert.ok(handler.includes('outputFormat !== "mp3_44100_128"'),
  'worker must fail closed until additional ElevenLabs output formats have verified MIME/extension handling');

for (const token of [
  "resolveTrustedNarratorProviderAuthorization",
  "users/${job.ownerUid}/providerAuthorizations/elevenlabs",
  "data.enabled !== true",
  "data.provider !== 'elevenlabs'",
  "consentPurpose !== consent.purpose",
  "policyVersion !== consent.policyVersion",
  "consentReceiptId !== consent.decisionReceiptId",
  "!voiceIds.includes(voiceId)",
  "providerAuthorization ? { providerAuthorization } : {}",
]) assert.ok(executeJob.includes(token), `trusted Jobs authorization contract missing ${token}`);

for (const token of [
  "URAI_NARRATOR_ELEVENLABS_ENABLED === 'true'",
  'elevenLabsApiKey',
  'elevenLabsVoiceAllowlist',
]) assert.ok(runtime.includes(token), `narrator readiness missing ${token}`);

assert.ok(runtime.includes('!elevenLabsEnabled || Boolean(process.env.ELEVENLABS_API_KEY)'));
assert.ok(runtime.includes('!elevenLabsEnabled || Boolean(process.env.ELEVENLABS_ALLOWED_VOICE_IDS)'));

for (const token of [
  'URAI_NARRATOR_ELEVENLABS_ENABLED:=false',
  'ELEVENLABS_API_KEY_SECRET:=ELEVENLABS_API_KEY',
  'ELEVENLABS_ALLOWED_VOICE_IDS is required when ElevenLabs narrator execution is enabled',
  'ELEVENLABS_OUTPUT_FORMAT must remain mp3_44100_128',
  'required_secrets+=("$ELEVENLABS_API_KEY_SECRET")',
  'versions.ELEVENLABS_API_KEY = process.env.ELEVENLABS_SECRET_VERSION',
  'URAI_NARRATOR_ELEVENLABS_ENABLED=$URAI_NARRATOR_ELEVENLABS_ENABLED',
  'ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY_SECRET}:${SECRET_VERSION_IDS[$ELEVENLABS_API_KEY_SECRET]}',
]) assert.ok(deploy.includes(token), `narrator deploy boundary missing ${token}`);

for (const token of [
  'URAI_NARRATOR_ELEVENLABS_ENABLED',
  'ELEVENLABS_API_KEY_SECRET',
  "bindings.add('ELEVENLABS_API_KEY')",
  '"$ELEVENLABS_API_KEY_SECRET") printf \'%s\' \'ELEVENLABS_API_KEY\'',
  'Approved version $version for $ELEVENLABS_API_KEY_SECRET is not ENABLED',
  'ELEVENLABS_API_KEY: String(approval.ELEVENLABS_API_KEY)',
]) assert.ok(approvedDeploy.includes(token), `approved deployment wrapper missing ${token}`);

assert.ok(deploy.includes('if [ "$worker" = "narrator-worker" ] && [ "$URAI_NARRATOR_ELEVENLABS_ENABLED" = "true" ]'));
assert.ok(deploy.includes('if [ "$worker" = "narrator-worker" ]; then'));

console.log('Governed ElevenLabs narrator provider contract passed');
execFileSync(process.execPath, [fileURLToPath(new URL('./narrator-paid-leaf-smoke.mjs', import.meta.url))], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./narrator-build-context.test.mjs', import.meta.url))], { stdio: 'inherit' });
