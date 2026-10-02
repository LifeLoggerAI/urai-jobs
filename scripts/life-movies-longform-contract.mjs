import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformContract.ts', import.meta.url), 'utf8')
const shortContract = fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8')

for (const marker of [
  "schemaVersion: z.literal('urai-life-movie-longform-v1')",
  'maxDurationMs: 45 * 60 * 1000',
  'maxSegmentDurationMs: 15_000',
  'maxSegments: 180',
  'planLifeMovieLongformSegments',
  "StudioLifeMovieRenderPayloadSchema.parse",
  "publicReleaseAuthorized: false",
  "providerGenerationAuthorized: false",
  "spatialRequired: false",
  "sourceStartMs: cue.sourceStartMs + (overlapStart - cue.startMs)",
  "life_movie_longform_segment_audio_budget_exceeded",
  "life_movie_longform_segment_source_budget_exceeded",
]) assert.ok(source.includes(marker), `long-form contract missing ${marker}`)

assert.match(source, /childDigest\(value\.renderPlanDigest, index, range\.startMs, range\.endMs\)/)
assert.match(source, /outputPrefix: .*\/segments\//)
assert.doesNotMatch(source, /maxDurationMs:\s*30_000/)
assert.ok(shortContract.includes('maxDurationMs: 30_000'), 'short synchronous contract must remain unchanged')
assert.ok(shortContract.includes('maxPixelFrames: 1920 * 1080 * 30 * 15'), 'short 1080p30 pixel-frame budget must remain unchanged')

console.log('Life Movie long-form segmentation contract passed')
