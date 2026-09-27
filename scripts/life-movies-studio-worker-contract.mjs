import './life-movies-dimensions-smoke.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const dockerfile = fs.readFileSync(new URL('../workers/studio-worker/Dockerfile', import.meta.url), 'utf8');
const createJob = fs.readFileSync(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const sharedContract = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8');
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
assert.ok(sharedContract.includes('assertLifeMovieTenantPaths'), 'Life Movies contract must bind source/output paths to tenant authority');
assert.ok(bridge.includes("defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN')"), 'Studio bridge must use a dedicated Secret Manager identity');
assert.ok(bridge.includes("action: z.literal('create')"), 'Studio bridge must expose bounded create semantics');
assert.ok(bridge.includes("action: z.enum(['status', 'cancel', 'playback', 'download', 'delete-output'])"), 'Studio bridge must expose bounded status/cancel/playback/download/delete semantics');
assert.ok(bridge.includes('playbackForBoundJob'), 'Studio bridge must issue owner-bound playback only after boundary validation');
assert.ok(bridge.includes("String(job.status) !== 'SUCCESS'"), 'Playback must require a successful render');
assert.ok(bridge.includes('Date.now() + 5 * 60 * 1000'), 'Playback access must be short-lived');
assert.ok(bridge.includes("responseDisposition: 'inline'"), 'Playback should be inline rather than public release');
assert.ok(bridge.includes('life_movie_subtitles_too_large'), 'Subtitle playback response must be byte bounded');
assert.ok(bridge.includes('sanitizedOutput(job.output)'), 'Status projection must sanitize worker output');
assert.ok(bridge.includes("signedMovieAccess(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId, 'attachment')"), 'Download must use owner-bound short-lived access');
assert.ok(bridge.includes('deleteBoundMovieOutput'), 'Generated-output deletion must use an owner-bound path');
assert.ok(bridge.includes('output_delete_boundary_mismatch'), 'Deletion must fail closed outside the Life Movies tenant prefix');
assert.ok(bridge.includes('retainedSourceMedia: true'), 'Deleting generated output must not silently delete source memories');
assert.ok(bridge.includes('output: FieldValue.delete()'), 'Deletion must scrub generated-output references from the job');
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

assert.ok(deploy.includes('narrator-worker|asset-worker|studio-worker'), 'canonical deploy script must recognize completed studio-worker');
assert.ok(approved.includes("new Set(['narrator-worker', 'asset-worker', 'studio-worker'])"), 'approved wrapper must admit studio-worker only through explicit approved worker selection');
assert.ok(approved.includes('narrator-worker|asset-worker|studio-worker'), 'exact-source build wrapper must admit studio-worker');

console.log('Life Movies Studio render-worker source contract verified');
