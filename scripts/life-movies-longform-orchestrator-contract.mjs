import assert from 'node:assert/strict'
import fs from 'node:fs'

const bridge = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts', import.meta.url), 'utf8')
const contract = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformContract.ts', import.meta.url), 'utf8')
const index = fs.readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8')
const shared = fs.readFileSync(new URL('../packages/shared-types/src/index.ts', import.meta.url), 'utf8')
const env = fs.readFileSync(new URL('../ops/worker.env.example', import.meta.url), 'utf8')

for (const marker of [
  "defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN')",
  "defineSecret('URAI_SCENE_TRUTH_RECEIPT_HMAC')",
  "URAI_LIFE_MOVIE_LONGFORM_ENABLED === 'true'",
  "const PLAN_COLLECTION = 'studioLifeMovieLongformPlans'",
  "const BINDING_COLLECTION = 'studioLifeMovieLongformBindings'",
  "const jobType = 'studio.render.longform'",
  "assertSceneTruthReceiptValue(",
  "consent: z.object({",
  "purpose: z.literal('life-movie.render')",
  "consentBlockRef(input.userId, input.consent.purpose)",
  "life_movie_longform_consent_revoked",
  "planLifeMovieLongformSegments(payload)",
  "authorityType: 'longform'",
  "scene_truth_receipt_replay_conflict",
  "type: 'studio.render.video'",
  "jobType: 'studio.render.video'",
  "rootJobId: planId",
  "parentJobId: planId",
  "correlationId: planId",
  "transaction.create(jobDoc(jobId)",
  "transaction.create(jobQueueEntryDoc(jobId)",
  "transaction.getAll(...childRefs)",
  "action: z.enum(['status', 'cancel', 'playback', 'resume', 'delete-output'])",
  "readPlanPlayback",
  "longform_plan_not_ready_for_playback",
  "longform_output_boundary_mismatch",
  "allowedLifeMovieOutputBuckets",
  "longform_output_bucket_authority_unavailable",
  "allowedBuckets.has(videoLocation.bucket)",
  "allowedBuckets.has(subtitleLocation.bucket)",
  "Date.now() + 5 * 60 * 1000",
  "responseDisposition: 'inline'",
  "schemaVersion: 'urai-life-movie-private-playlist-v1'",
  "gapBeforeMs",
  "playlistDigest",
  "'execution.leaseToken': FieldValue.delete()",
  "status: 'CANCELLED'",
  "consent: input.consent",
  "publicReleaseAuthorized: false",
  "consentRevoked: revoked",
  "await assertPlanConsentActive(plan)",
  "async function resumePlan(",
  "['FAILED', 'DEAD', 'CANCELLED']",
  "'execution.attemptCount': 0",
  "async function deletePlanOutputs(",
  "retainedSourceMedia: true",
  "output: FieldValue.delete()",
  "if (parsed.data.action === 'resume')",
  "if (parsed.data.action === 'delete-output')",
]) assert.ok(bridge.includes(marker), `long-form orchestrator missing ${marker}`)

assert.ok(contract.includes('assertLifeMovieLongformTenantPaths'), 'long-form contract must bind source/output paths to tenant authority')
assert.ok(index.includes('studioLifeMovieLongformBridge'), 'long-form bridge must be exported')
assert.ok(shared.includes('rootJobId?: string'), 'shared Job must represent long-form root authority')
assert.ok(shared.includes('parentJobId?: string'), 'shared Job must represent long-form parent authority')
assert.ok(env.includes('URAI_LIFE_MOVIE_LONGFORM_ENABLED=false'), 'long-form runtime must remain hard-off by default')
assert.doesNotMatch(bridge, /timeoutSeconds:\s*(?:[2-9]\d{2,}|1[3-9]\d)/, 'long-form orchestrator must not hide rendering behind a multi-minute function timeout')
assert.doesNotMatch(bridge, /providerGenerationAuthorized:\s*true/)
assert.doesNotMatch(bridge, /publicReleaseAuthorized:\s*true/)
assert.ok(bridge.indexOf('assertSceneTruthReceiptValue(') < bridge.indexOf('planLifeMovieLongformSegments(payload)'), 'SceneTruth authority must be verified before child planning')
assert.equal((bridge.match(/assertSceneTruthReceiptValue\(/g) ?? []).length, 1, 'SceneTruth receipt must be verified once at parent creation, not replayed per child')

console.log('Life Movie durable long-form orchestrator contract passed')

assert.ok(bridge.includes("status: 'CANCELLED'"), 'parent cancellation must retain explicit cancelled queue semantics')
assert.doesNotMatch(bridge, /status: 'DONE'[\s\S]{0,120}longform/, 'long-form cancellation must not collapse cancellation into generic DONE state')

assert.doesNotMatch(bridge, /segments\.push\([\s\S]*?ref:/, 'private playback response must not expose raw GCS refs')
assert.ok(bridge.indexOf('assertPlanOwner') < bridge.indexOf('readPlanPlayback'), 'owner/tenant boundary helper must exist before playback implementation')
