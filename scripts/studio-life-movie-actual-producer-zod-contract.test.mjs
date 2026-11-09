import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildJobsLifeMovieEnvelope } from './fixtures/studio-r931-producer.ts';
import { buildJobsLifeMovieEnvelope as buildCurrentStudioEnvelope } from './fixtures/studio-20261109-scene-truth-producer.ts';
import {
  StudioLifeMovieCreateRequestSchema,
  assertStudioLifeMovieRenderPlanDigest,
  assertLifeMovieTenantPaths,
} from '../functions/src/jobs/studioLifeMovieContract.ts';
import {
  lifeMovieConsentAuthorityAvailable,
  deferLifeMovieJob,
} from '../functions/src/privacy/lifeMovieConsentGate.ts';

const builderInput = JSON.parse(readFileSync(new URL('./fixtures/studio-r931-builder-input.json', import.meta.url), 'utf8'));
const routeSource = readFileSync(new URL('./fixtures/studio-r931-dispatch-route.source.txt', import.meta.url), 'utf8');
const currentSourcePins = JSON.parse(readFileSync(new URL('./fixtures/studio-20261109-scene-truth-source-pins.json', import.meta.url), 'utf8'));

test('pinned Studio producer fixture provenance is exact and consent remains absent', () => {
  assert.equal(buildJobsLifeMovieEnvelope.name, 'buildJobsLifeMovieEnvelope');
  assert.match(routeSource, /callStudioJobsBridge\(\{/);
  assert.match(routeSource, /action:'create'/);
  assert.match(routeSource, /tenantId:auth\.tenantId/);
  assert.match(routeSource, /userId:auth\.uid/);
  assert.match(routeSource, /idempotencyKey:envelope\.idempotencyKey/);
  assert.match(routeSource, /payload:envelope\.payload/);
  const call = routeSource.match(/callStudioJobsBridge\(\{([\s\S]*?)\}\);/);
  assert.ok(call, 'actual pinned dispatch route call must be found');
  assert.doesNotMatch(call[1], /\bconsent\s*:/);
});

test('actual Studio builder output and actual dispatch mapping are missing required canonical consent', () => {
  const envelope = buildJobsLifeMovieEnvelope(builderInput);
  assert.equal(envelope.dispatchAuthorized, false);
  assert.equal(envelope.providerGenerationAuthorized, false);
  assert.equal(envelope.publicReleaseAuthorized, false);
  assert.doesNotMatch(JSON.stringify(envelope), /"consent"\s*:/);
  
  const request = {
    action: 'create',
    tenantId: builderInput.tenantId,
    userId: 'synthetic-owner',
    idempotencyKey: envelope.idempotencyKey,
    payload: envelope.payload,
  };

  assert.equal(request.action, 'create');
  assert.equal(request.tenantId, builderInput.tenantId);
  assert.equal(request.idempotencyKey, envelope.idempotencyKey);
  assert.deepEqual(Object.keys(request).sort(), ['action','idempotencyKey','payload','tenantId','userId'].sort());

  assert.doesNotThrow(() => assertStudioLifeMovieRenderPlanDigest(envelope.payload));
  assert.doesNotThrow(() => assertLifeMovieTenantPaths(envelope.payload, builderInput.tenantId));

  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(request);
  assert.equal(parsed.success, false, 'strict Jobs create schema must reject current Studio dispatch body');
  assert.deepEqual(
    parsed.error.issues.map(issue => issue.path.join('.')),
    ['consent'],
    'the only rejection should be the missing canonical consent object',
  );
});

test('missing consent must not be filled by a dummy client receipt or a purpose substitution', () => {
  const envelope = buildJobsLifeMovieEnvelope(builderInput);
  const body = {
    action: 'create',
    tenantId: builderInput.tenantId,
    userId: 'synthetic-owner',
    idempotencyKey: envelope.idempotencyKey,
    payload: envelope.payload,
  };
  assert.equal(lifeMovieConsentAuthorityAvailable(), false);
  assert.equal(deferLifeMovieJob({ jobType: 'studio.render.video' }), true);

  const forged = structuredClone(body);
  forged.consent = {
    purpose: 'life-movie.render',
    policyVersion: '1.1.0',
    decisionReceiptId: 'a'.repeat(64),
  };
  const forgedParsed = StudioLifeMovieCreateRequestSchema.safeParse(forged);
  assert.equal(forgedParsed.success, true, 'shape-only dummy receipt passes Zod shape, not authorization');
  assert.equal(lifeMovieConsentAuthorityAvailable(), false);
  assert.equal(deferLifeMovieJob({ jobType: 'studio.render.video' }), true);

  const substituted = structuredClone(forged);
  substituted.consent.purpose = 'ai.personalization';
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(substituted).success, false);
});

// Keep the R931 fixture as historical evidence and exercise Studio #202 separately.
// A matching payload or a schema-valid receipt never grants execution authority.
test('current Studio fixture and Jobs boundary match immutable source pins', () => {
  assert.equal(currentSourcePins.studio_commit, '501ac5c325f906cdeb32b0638dd15f5622ea1304');
  assert.equal(currentSourcePins.jobs_base, 'e8ba07fc26f154169f2e065d9aa65e77014635d2');
  assert.equal(currentSourcePins.files.length, 6);
  for (const pin of currentSourcePins.files) {
    const bytes = readFileSync(new URL(`../${pin.local}`, import.meta.url));
    assert.equal(bytes.length, pin.bytes, `${pin.local}: byte length`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, `${pin.local}: SHA-256`);
    assert.equal(
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      pin.git_blob,
      `${pin.local}: Git blob`,
    );
  }
});

for (const [field, error] of [
  ['sceneTruthReceiptRef', 'life_movie_invalid_scene_truth_receipt'],
  ['sceneTruthDigest', 'life_movie_invalid_scene_truth_digest'],
]) {
  test(`current Studio ${field} rejects JSON array coercion before Jobs admission`, () => {
    const input = structuredClone(builderInput);
    input[field] = JSON.parse(JSON.stringify([input[field]]));
    assert.throws(() => buildCurrentStudioEnvelope(input), new RegExp(error));
  });

  test(`current Studio ${field} rejects objects without invoking toString`, () => {
    const input = structuredClone(builderInput);
    const value = input[field];
    let calls = 0;
    input[field] = { toString() { calls += 1; return value; } };
    assert.throws(() => buildCurrentStudioEnvelope(input), new RegExp(error));
    assert.equal(calls, 0);
  });
}

test('current Studio preserves the valid historical payload and still lacks canonical consent', () => {
  const current = buildCurrentStudioEnvelope(structuredClone(builderInput));
  const historical = buildJobsLifeMovieEnvelope(structuredClone(builderInput));
  assert.deepEqual(current, historical, 'valid producer output must remain byte-equivalent');
  assert.doesNotThrow(() => assertStudioLifeMovieRenderPlanDigest(current.payload));
  assert.doesNotThrow(() => assertLifeMovieTenantPaths(current.payload, builderInput.tenantId));
  const body = {
    action: 'create', tenantId: builderInput.tenantId, userId: 'synthetic-owner',
    idempotencyKey: current.idempotencyKey, payload: current.payload,
  };
  const parsed = StudioLifeMovieCreateRequestSchema.safeParse(body);
  assert.equal(parsed.success, false);
  assert.deepEqual(parsed.error.issues.map(issue => issue.path.join('.')), ['consent']);
  assert.equal(current.dispatchAuthorized, false);
  assert.equal(current.providerGenerationAuthorized, false);
  assert.equal(current.publicReleaseAuthorized, false);
});

test('current Studio with a shape-only dummy receipt cannot open consent authority', () => {
  const current = buildCurrentStudioEnvelope(structuredClone(builderInput));
  const body = {
    action: 'create', tenantId: builderInput.tenantId, userId: 'synthetic-owner',
    idempotencyKey: current.idempotencyKey, payload: current.payload,
    consent: { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'a'.repeat(64) },
  };
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(body).success, true);
  assert.equal(lifeMovieConsentAuthorityAvailable(), false);
  assert.equal(deferLifeMovieJob({ jobType: 'studio.render.video' }), true);
  body.consent.purpose = 'ai.personalization';
  assert.equal(StudioLifeMovieCreateRequestSchema.safeParse(body).success, false);
});

