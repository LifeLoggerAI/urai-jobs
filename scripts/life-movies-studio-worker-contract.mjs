import './life-movies-dimensions-smoke.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const dockerfile = fs.readFileSync(new URL('../workers/studio-worker/Dockerfile', import.meta.url), 'utf8');
const createJob = fs.readFileSync(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const sharedContract = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8');
assert.ok(sharedContract.includes("!value.includes('\\\\')"), 'Studio render admission must reject a single backslash in private object paths');
assert.ok(worker.includes("value.includes('\\\\')"), 'Studio worker must retain matching single-backslash rejection');
const bridge = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieBridge.ts', import.meta.url), 'utf8');
const functionsIndex = fs.readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./deploy-workers.sh', import.meta.url), 'utf8');
const approved = fs.readFileSync(new URL('./deploy-workers-approved.sh', import.meta.url), 'utf8');

for (const token of [
  "schemaVersion !== 'urai-life-movie-render-v1'",
  "job.type !== 'studio.render.video'",
  'output_prefix_outside_tenant_project',
  'source_outside_tenant',
  'public_release_must_be_false',
  'provider_generation_must_be_false',
  'invalid_scene_truth_receipt_ref',
  'spatial_required_must_be_false',
  "renderEngine: 'ffmpeg'",
  'providerCalled: false',
  'providerSpendAuthorized: false',
  "app.get('/readyz'",
  "app.get('/authz', requireWorkerAuth",
  "app.post('/', requireWorkerAuth",
  "uploadPrivateFile(moviePath",
  "uploadPrivateFile(subtitlePath",
  "uploadPrivateFile(manifestPath",
  "audioCues",
  "narration",
  "dialogue",
  "music",
  "ambience",
  "foley",
  "effects",
  "mixAudioCues",
  "amix=inputs=",
  "audio_cue_source_missing_audio",
  "audioCueCount: input.audioCues.length",
]) assert.ok(worker.includes(token), `studio worker missing ${token}`);

assert.ok(dockerfile.includes('apt-get install -y --no-install-recommends ffmpeg'), 'Studio worker image must include FFmpeg');
assert.ok(createJob.includes('StudioLifeMovieRenderPayloadSchema'), 'createJob must validate Life Movies render payloads');
assert.ok(sharedContract.includes('sceneTruthReceiptRef: z.string()'), 'Life Movies contract must require a SceneTruth receipt');
assert.ok(worker.includes('sceneTruthReceiptRef: input.sceneTruthReceiptRef'), 'Render manifest must retain SceneTruth receipt provenance');
assert.ok(sharedContract.includes('assertLifeMovieTenantPaths'), 'Life Movies contract must bind source/output paths to tenant authority');
assert.ok(bridge.includes("defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN')"), 'Studio bridge must use a dedicated Secret Manager identity');
assert.ok(bridge.includes("action: z.literal('create')"), 'Studio bridge must expose bounded create semantics');
assert.ok(bridge.includes("purpose: z.literal('life-movie.render')"), 'Short Life Movie creation must require canonical render consent');
assert.ok(bridge.includes("consentBlockRef(input.userId, input.consent.purpose)"), 'Short Life Movie creation must fail closed on revoked consent');
assert.ok(bridge.includes("consent: input.consent"), 'Short Life Movie jobs must persist canonical consent context');
assert.ok(bridge.includes("const fingerprintPayload = { tenantId: input.tenantId, userId: input.userId, consent: input.consent, payload }"), 'Short Life Movie idempotency must bind consent identity');
assert.ok(bridge.includes("action: z.enum(['status', 'cancel', 'playback', 'download', 'delete-output'])"), 'Studio bridge must expose bounded status/cancel/playback/download/delete semantics');
const signedAccessStart = bridge.indexOf('async function signedMovieAccess(');
const signedAccessEnd = bridge.indexOf('async function deleteBoundMovieOutput(', signedAccessStart);
assert.ok(signedAccessStart >= 0 && signedAccessEnd > signedAccessStart, 'Studio bridge must expose bounded signed playback/download access');
const signedAccess = bridge.slice(signedAccessStart, signedAccessEnd);
assert.ok(signedAccess.indexOf('await loadBoundJob(tenantId, userId, jobId)') >= 0, 'Playback/download must validate owner/tenant/job boundary');
assert.ok(signedAccess.indexOf('await loadBoundJob(tenantId, userId, jobId)') < signedAccess.indexOf('getSignedUrl('), 'Boundary validation must occur before any signed playback/download URL is issued');
assert.ok(signedAccess.includes("String(job.status) !== 'SUCCESS'"), 'Playback must require a successful render');
assert.ok(signedAccess.includes("isConsentContext(job.consent)"), 'Playback/download must reject legacy or malformed consent context');
assert.ok(signedAccess.includes("consentBlockRef(userId, job.consent.purpose)"), 'Playback/download must recheck current consent before issuing access');
assert.ok(signedAccess.indexOf("consentBlockRef(userId, job.consent.purpose)") < signedAccess.indexOf('getSignedUrl('), 'Consent revocation check must run before any signed playback/download URL');
assert.ok(signedAccess.includes('Date.now() + 5 * 60 * 1000'), 'Playback access must be short-lived');
assert.ok(signedAccess.includes('responseDisposition: disposition'), 'Playback/download disposition must remain explicit and caller-bounded');
assert.ok(bridge.includes("signedMovieAccess(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId, 'inline')"), 'Playback action must request inline private access');
assert.ok(bridge.includes('life_movie_subtitles_too_large'), 'Subtitle playback response must be byte bounded');
assert.ok(bridge.includes('sanitizedOutput(job.output)'), 'Status projection must sanitize worker output');
assert.ok(bridge.includes("signedMovieAccess(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId, 'attachment')"), 'Download must use owner-bound short-lived access');
assert.ok(bridge.includes('deleteBoundMovieOutput'), 'Generated-output deletion must use an owner-bound path');
assert.ok(bridge.includes('output_delete_boundary_mismatch'), 'Deletion must fail closed outside the Life Movies tenant prefix');
assert.ok(bridge.includes('allowedLifeMovieOutputBuckets'), 'Playback/delete must enforce configured output bucket authority');
assert.ok(bridge.includes('life_movie_output_boundary_mismatch'), 'Playback must fail closed outside bucket/path authority');
assert.ok(bridge.includes('life_movie_output_bucket_authority_unavailable'), 'Playback must fail closed when output bucket authority is not configured');
assert.ok(bridge.includes('retainedSourceMedia: true'), 'Deleting generated output must not silently delete source memories');
assert.ok(bridge.includes('output: FieldValue.delete()'), 'Deletion must scrub generated-output references from the job');
assert.ok(bridge.includes('result: FieldValue.delete()'), 'Deletion must scrub duplicate generated-result references from the job');
assert.ok(bridge.includes('outputDeletedAt: now'), 'Deletion must retain an audit timestamp');
assert.ok(!bridge.includes('output: job.output'), 'Status must not expose raw internal GCS output refs');
assert.ok(bridge.includes("sourceSystem: 'urai-studio'"), 'Studio bridge jobs must retain source-system authority');
assert.ok(bridge.includes("'execution.leaseToken': FieldValue.delete()"), 'Studio bridge cancellation must revoke the active lease');
assert.ok(functionsIndex.includes('studioLifeMovieBridge'), 'Life Movies bridge must be exported from Firebase Functions');
assert.ok(createJob.includes("jobType === 'studio.render.video'"), 'studio.render.video must have a dedicated validator');
for (const token of [
  'spatialRequired: z.literal(false)',
  'publicReleaseAuthorized: z.literal(false)',
  'providerGenerationAuthorized: z.literal(false)',
  'LifeMovieAudioCueSchema',
  "role: z.enum(['narration', 'dialogue', 'music', 'ambience', 'foley', 'effects'])",
  'audioCues: z.array(LifeMovieAudioCueSchema)',
]) {
  assert.ok(sharedContract.includes(token), `Life Movies render admission must preserve hard-off boolean: ${token}`);
}
assert.ok(sharedContract.includes('gainDb: z.number().finite().min(-60).max(12)'), 'Audio gain must be bounded');
assert.ok(sharedContract.includes('Audio cue must fit inside the rendered timeline.'), 'Audio cues must remain inside the render timeline');
assert.ok(worker.includes("const usedSourceIds = new Set(["), 'Audio cue sources must use the same governed download path');
assert.ok(worker.includes("...input.audioCues.map((cue) => cue.sourceId)"), 'Audio cue source downloads must be provenance/tenant governed');

assert.ok(deploy.includes('narrator-worker|asset-worker|studio-worker|private-source-worker|captured-reality-worker'), 'canonical deploy script must recognize completed studio-worker');
assert.ok(approved.includes("new Set(['narrator-worker', 'asset-worker', 'studio-worker', 'private-source-worker', 'captured-reality-worker'])"), 'approved wrapper must admit studio-worker only through explicit approved worker selection');
assert.ok(approved.includes('narrator-worker|asset-worker|studio-worker'), 'exact-source build wrapper must admit studio-worker');

console.log('Life Movies Studio render-worker source contract verified');

assert.ok(sharedContract.includes("sceneTruthReceiptRef: z.string().trim().regex(/^str_"), 'Jobs admission must fail closed on SceneTruth receipt syntax');
assert.ok(worker.includes("invalid_scene_truth_receipt_ref"), 'Studio worker must reject missing or malformed SceneTruth receipts');
assert.ok(bridge.includes("sceneTruthReceiptRef: payload.sceneTruthReceiptRef"), 'Jobs bridge audit metadata must retain the SceneTruth receipt');
assert.ok(bridge.includes("sceneTruthReceiptRef: typeof typed.sceneTruthReceiptRef"), 'Jobs safe status projection must retain only the opaque SceneTruth receipt');

assert.ok(sharedContract.includes("sceneTruthDigest: z.string().trim().regex(/^[a-f0-9]{64}$/)"), 'Jobs admission must require exact SceneTruth digest syntax');
assert.ok(worker.includes("invalid_scene_truth_digest"), 'Studio worker must reject missing or malformed SceneTruth digests');
assert.ok(worker.includes("sceneTruthDigest: input.sceneTruthDigest"), 'Render manifest must retain SceneTruth digest provenance');
assert.ok(bridge.includes("verifySceneTruthReceipt(payload.projectId, payload.sceneTruthDigest, input.userId, payload.sceneTruthReceiptRef)"), 'Dedicated bridge must cryptographically verify SceneTruth receipt against project, digest, and owner identity');
assert.ok(bridge.includes("defineSecret('URAI_SCENE_TRUTH_RECEIPT_HMAC')"), 'Dedicated bridge must bind SceneTruth HMAC secret');

assert.ok(
  createJob.includes("studio.render.video must be created through the dedicated authenticated Studio Life Movie bridge"),
  'Generic Jobs createJob must fail closed instead of bypassing SceneTruth HMAC verification',
);
assert.ok(
  bridge.includes("SCENE_TRUTH_RECEIPT_BINDING_COLLECTION"),
  'Dedicated bridge must bind each SceneTruth receipt on first use',
);
assert.ok(
  bridge.includes("scene_truth_receipt_replay_conflict"),
  'Dedicated bridge must reject cross-request SceneTruth receipt replay',
);
assert.ok(
  bridge.includes("requestFingerprint") && bridge.includes("sceneTruthDigest"),
  'SceneTruth replay binding must include exact request fingerprint and digest',
);

assert.ok(worker.includes("schemaVersion !== 'urai-life-movie-assembly-v1'"), 'Long-form assembly worker must require its own schema')
assert.ok(worker.includes("'studio.assemble.video'"), 'Long-form assembly must use a separate job type')
assert.ok(worker.includes('assembly_segment_checksum_mismatch'), 'Assembly must verify every child checksum before finalization')
assert.ok(worker.includes("renderEngine: 'ffmpeg-concat'"), 'Assembly receipt must identify FFmpeg concat')
assert.ok(worker.includes("mode: 'life-movie-ffmpeg-assembly'"), 'Assembly output must remain distinguishable from bounded child render output')
assert.ok(worker.includes('LIFE_MOVIE_ASSEMBLY_BUDGET'), 'Assembly must have explicit resource budgets')
assert.ok(worker.includes('assembly_video_byte_budget_exceeded'), 'Assembly must fail closed on media byte budget')
assert.ok(worker.includes('shiftSrt'), 'Assembly must merge captions with segment time offsets')
assert.ok(worker.includes('gapArgs(gapPath'), 'Assembly must preserve declared inter-segment gaps')
assert.ok(worker.includes('assembly_cleanup_incomplete'), 'Assembly must clean partial uploaded outputs on failure')
assert.ok(createJob.includes("studio.assemble.video must be created through the dedicated authenticated Studio Life Movie long-form bridge"), 'Generic Jobs admission must not bypass assembly authority')
