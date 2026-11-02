import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLifeMoviePrivateDeliveryRequest as parse } from '../../functions/src/jobs/lifeMoviePrivateDeliveryContract.ts';

const now = Date.parse('2026-11-01T15:37:00.000Z');
const common = {
  action: 'deliver', tenantId: 'tenant-1', userId: 'owner-1',
  kind: 'mp4', authorityHash: 'a'.repeat(64), expiresAt: now + 60_000,
  generation: '1793378565000001', disposition: 'inline',
};
const short = { ...common, jobId: 'syntheticjob001' };
const long = { ...common, planId: 'lmp_' + 'x'.repeat(20), artifact: 'final' };

for (const [mode, input] of [['short', short], ['longform', long]]) {
  test(mode + ' recognizes precisely scoped delivery descriptor without granting authority', () => {
    const descriptor = parse(input, mode, now);
    assert.ok(Object.isFrozen(descriptor));
    assert.deepEqual(descriptor, input);
  });
  for (const [label, mutate] of [
    ['missing hash', x => { delete x.authorityHash; }],
    ['fake authority hash', x => { x.authorityHash = 'fake_authority'; }],
    ['expired descriptor', x => { x.expiresAt = now; }],
    ['future descriptor', x => { x.expiresAt = now + 300_001; }],
    ['string deadline', x => { x.expiresAt = String(now + 1000); }],
    ['noninteger deadline', x => { x.expiresAt += 0.5; }],
    ['unsafe generation', x => { x.generation = '9007199254740992'; }],
    ['zero generation', x => { x.generation = '0'; }],
    ['wrong MIME/kind', x => { x.kind = 'application/pdf'; }],
    ['wrong disposition', x => { x.disposition = 'public'; }],
    ['extra URL field', x => { x.url = 'https://untrusted.invalid'; }],
    ['cross-tenant identifier path', x => { x.tenantId = '../tenant'; }],
    ['mixed job and plan identity', x => { x[mode === 'short' ? 'planId' : 'jobId'] = 'syntheticotherjob'; }],
    ['hidden field', x => { Object.defineProperty(x, 'hidden', { value: true, enumerable: false }); }],
    ['symbol field', x => { x[Symbol('owner')] = 'administrator'; }],
  ]) {
    test(mode + ' rejects ' + label, () => {
      const value = mutateInput(input, mutate);
      assert.throws(() => parse(value, mode, now), /life_movie_private_delivery_request_invalid/);
    });
  }
}
function mutateInput(input, mutate) { const o = { ...input }; mutate(o); return o; }

test('short-form refuses missing or invalid job identifier', () => {
  assert.throws(() => parse({ ...short, jobId: 'x' }, 'short', now));
});
test('long-form refuses segment >= 180 and malformed index', () => {
  assert.throws(() => parse({ ...long, artifact: 'segment:180' }, 'longform', now));
  assert.throws(() => parse({ ...long, artifact: 'segment:01' }, 'longform', now));
});
test('long-form allows one bounded segment descriptor', () => {
  assert.equal(parse({ ...long, artifact: 'segment:179', kind: 'srt', disposition: 'attachment' }, 'longform', now).artifact, 'segment:179');
});
test('custom prototype cannot assert hidden authorization', () => {
  assert.throws(() => parse(Object.assign(Object.create({ approved: true }), short), 'short', now));
});
for (const [mode, file] of [
  ['short', '../../functions/src/jobs/studioLifeMovieBridge.ts'],
  ['longform', '../../functions/src/jobs/studioLifeMovieLongformBridge.ts'],
]) {
  test(mode + ' bridge authenticates, validates, and unconditionally blocks delivery', (t) => {
    const sourceUrl = new URL(file, import.meta.url);
    if (!existsSync(sourceUrl)) { t.skip('requires complete exact-head Jobs checkout'); return; }
    const source = readFileSync(sourceUrl, 'utf8');
    const auth = source.indexOf("if (!authorized(req.get('authorization') || ''))");
    const size = source.indexOf('if (jsonBytes(req.body) > MAX_BODY_BYTES)');
    const delivery = source.indexOf("if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && req.body.action === 'deliver')");
    const create = source.indexOf('const parsed = RequestSchema.safeParse(req.body);');
    assert.ok(auth > -1 && size > auth && delivery > size && create > delivery);
    const section = source.slice(delivery, create);
    assert.match(section, /parseLifeMoviePrivateDeliveryRequest\(req.body, '(?:short|longform)'\)/);
    assert.match(section, /res\.status\(503\)/);
    assert.doesNotMatch(section, /getStorage|getSignedUrl|\.download\(|res\.send\(|\.pipe\(/);
    assert.match(source, /lifeMovieConsentAuthorityAvailable/);
    // Both legacy URL-issuing actions must stay unreachable independently of
    // a future change to lifeMovieConsentAuthorityAvailable().
    const parsedRequest = source.indexOf('const parsed = RequestSchema.safeParse(req.body);');
    const legacyDenial = source.indexOf("if (parsed.data.action === 'playback' || parsed.data.action === 'download')");
    const legacyBody = source.slice(legacyDenial, source.indexOf('  if ([', legacyDenial));
    assert.ok(legacyDenial > parsedRequest, 'legacy gate must follow strict request parsing');
    assert.match(legacyBody, /life_movie_authenticated_delivery_required/);
    assert.match(legacyBody, /res\.status\(503\)/);
    assert.doesNotMatch(legacyBody, /getSignedUrl|signedMovieAccess|readPlanPlayback|res\.send/);
  });
}

// R374: reject computed/accessor-backed claims before invoking untrusted code.
// Studio's corresponding private-delivery parser already rejects accessors.
for (const [mode, base] of [['short', short], ['longform', long]]) {
  const mandatory = [...Object.keys(base)];
  for (const key of mandatory) {
    test(mode + ' rejects accessor-backed ' + key + ' without running a getter', () => {
      const value = { ...base };
      const original = value[key];
      let getterReads = 0;
      Object.defineProperty(value, key, {
        enumerable: true,
        configurable: true,
        get() { getterReads++; return original; },
      });
      assert.throws(() => parse(value, mode, now), /life_movie_private_delivery_request_invalid/);
      assert.equal(getterReads, 0, 'validation must inspect descriptors rather than invoke accessors');
    });
  }
  test(mode + ' rejects setter-only required claims', () => {
    const value = { ...base };
    Object.defineProperty(value, 'tenantId', { enumerable: true, set(_v) {} });
    assert.throws(() => parse(value, mode, now), /life_movie_private_delivery_request_invalid/);
  });
  test(mode + ' detaches validated output from subsequent descriptor changes', () => {
    const value = { ...base };
    const validated = parse(value, mode, now);
    value.tenantId = 'other-tenant';
    value.generation = '1793378565000002';
    assert.equal(validated.tenantId, base.tenantId);
    assert.equal(validated.generation, base.generation);
    assert.ok(Object.isFrozen(validated));
  });
}
