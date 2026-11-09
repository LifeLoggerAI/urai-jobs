import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildJobsLifeMovieEnvelope } from './fixtures/studio-r931-producer.ts';
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
