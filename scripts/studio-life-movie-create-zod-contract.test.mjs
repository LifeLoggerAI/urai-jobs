import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  StudioLifeMovieCreateRequestSchema,
  assertStudioLifeMovieRenderPlanDigest,
  deriveStudioLifeMovieRenderScope,
  assertLifeMovieTenantPaths,
} from '../functions/src/jobs/studioLifeMovieContract.ts';
import {
  lifeMovieConsentAuthorityAvailable,
  deferLifeMovieJob,
} from '../functions/src/privacy/lifeMovieConsentGate.ts';

const fixture = JSON.parse(readFileSync(new URL('./studio-life-movie-create-fixture.json', import.meta.url), 'utf8'));
const request = fixture.request;
const clone = value => structuredClone(value);

test('fixture is pinned to Studio #201 and contains no execution authority', () => {
  assert.equal(fixture.producer_head, 'a6187abfd12ffc8f534ddf66246da91ed032e1dc');
  assert.equal(fixture.producer_source_blob, '701be51e861e0a5ff47d88ceaba1e3812433d659');
  assert.equal(fixture.builder_dispatchAuthorized, false);
  assert.equal(fixture.builder_providerGenerationAuthorized, false);
  assert.equal(fixture.builder_publicReleaseAuthorized, false);
});

test('actual Jobs Zod create schema accepts the serialized Studio #201 fixture', () => {
  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(request);
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
  assert.equal(parsed.data.action, 'create');
  assert.equal(parsed.data.tenantId, 'tenant1');
  assert.equal(parsed.data.payload.sources[0].generation, '17');
  assert.equal(parsed.data.payload.timeline[0].sourceStartMs, 100);
  assert.equal(parsed.data.payload.audioCues[0].sourceStartMs, 0);
  assert.equal(parsed.data.payload.audioCues[0].gainDb, 0);
  assert.equal(parsed.data.payload.publicReleaseAuthorized, false);
  assert.equal(parsed.data.payload.providerGenerationAuthorized, false);
});

test('Jobs recomputes the exact Studio render-plan digest and tenant scope', () => {
  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(request);
  assert.equal(parsed.success, true);
  assert.doesNotThrow(() => assertStudioLifeMovieRenderPlanDigest(parsed.data.payload));
  assert.equal(parsed.data.idempotencyKey, 'life-movie:project1:' + parsed.data.payload.renderPlanDigest.slice(0, 32));
  assert.doesNotThrow(() => assertLifeMovieTenantPaths(parsed.data.payload, parsed.data.tenantId));
  const scope = deriveStudioLifeMovieRenderScope(parsed.data.payload);
  assert.equal(scope.projectId, 'project1');
  assert.equal(scope.renderPlanDigest, parsed.data.payload.renderPlanDigest);
  assert.match(scope.sourceSetDigest, /^[a-f0-9]{64}$/);
});

test('synthetic schema-valid receipt does not open Jobs consent or worker execution', () => {
  assert.equal(request.consent.decisionReceiptId, 'a'.repeat(64));
  assert.equal(lifeMovieConsentAuthorityAvailable(), false);
  assert.equal(deferLifeMovieJob({ jobType: 'studio.render.video' }), true);
  assert.equal(fixture.builder_dispatchAuthorized, false);
});

test('missing consent is rejected by actual Jobs Zod schema', () => {
  const value = clone(request);
  delete value.consent;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(value).success, false);
});

test('malformed receipt id is rejected by actual Jobs Zod schema', () => {
  const value = clone(request);
  value.consent.decisionReceiptId = 'a'.repeat(63);
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(value).success, false);
});

test('wrong consent purpose and policy are rejected', () => {
  const wrongPurpose = clone(request);
  wrongPurpose.consent.purpose = 'ai.personalization';
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(wrongPurpose).success, false);
  const wrongPolicy = clone(request);
  wrongPolicy.consent.policyVersion = '1.0.0';
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(wrongPolicy).success, false);
});

test('strict Jobs schema rejects surplus source keys and positive execution flags', () => {
  const extra = clone(request);
  extra.payload.sources[0].surplus = true;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(extra).success, false);
  const enabled = clone(request);
  enabled.payload.providerGenerationAuthorized = true;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(enabled).success, false);
});

test('generation changes invalidate the existing render digest', () => {
  const value = clone(request);
  value.payload.sources[0].generation = '18';
  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(value);
  assert.equal(parsed.success, true);
  assert.throws(
    () => assertStudioLifeMovieRenderPlanDigest(parsed.data.payload),
    /life_movie_render_plan_digest_mismatch/,
  );
});

test('cross-tenant source and output paths are rejected by Jobs tenant assertion', () => {
  const value = clone(request);
  value.payload.sources[0].objectPath = 'tenants/foreign/raw/source01.mp4';
  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(value);
  assert.equal(parsed.success, true);
  assert.throws(
    () => assertLifeMovieTenantPaths(parsed.data.payload, parsed.data.tenantId),
    /life_movie_source_outside_tenant/,
  );
  const output = clone(request);
  output.payload.outputPrefix = 'tenants/tenant1/life-movies/other-project/';
  const parsedOutput = StudioLifeMovieCreateRequestSchema.safeParse(output);
  assert.equal(parsedOutput.success, true);
  assert.throws(
    () => assertLifeMovieTenantPaths(parsedOutput.data.payload, parsedOutput.data.tenantId),
    /life_movie_output_outside_tenant_project/,
  );
});

test('Jobs rejects excessive video offset and nonzero still-image offset', () => {
  const offset = clone(request);
  offset.payload.timeline[0].sourceStartMs = 45 * 60 * 1000 + 1;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(offset).success, false);
  const still = clone(request);
  still.payload.sources[0].mimeType = 'image/jpeg';
  still.payload.timeline[0].sourceStartMs = 1;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(still).success, false);
});

test('Jobs rejects overlapping clips and media beyond render budget', () => {
  const overlap = clone(request);
  overlap.payload.sources.push({
    ...overlap.payload.sources[0],
    id: 'source02',
    objectPath: 'tenants/tenant1/raw/source02.mp4',
  });
  overlap.payload.timeline.push({ sourceId: 'source02', startMs: 500, endMs: 1500 });
  overlap.payload.renderPlanDigest = '0'.repeat(64);
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(overlap).success, false);
  const long = clone(request);
  long.payload.timeline[0].endMs = 31_000;
  long.payload.audioCues[0].endMs = 31_000;
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(long).success, false);
});
