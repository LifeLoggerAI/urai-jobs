/**
 * R506 original-source selection regression for consent-revoked Life Movies.
 * Node-only, no emulator, network, cloud credentials, or worker activation.
 * The private selector is read from the original production TS file and its
 * function body is executed; this is a fast source-backed unit check, not a
 * complete Firebase/Storage end-to-end deletion certification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../functions/src/privacy/lifeMovieDerivativeRevocation.ts', import.meta.url), 'utf8');
const selector = source.match(/function isAffectedJob\(job: Record<string, unknown>, event: LifeMovieRevocationEvent\): boolean \{([\s\S]*?)\n\}/);
assert.ok(selector, 'original Life Movie revocation selector must be present');
// No imports or application state are mocked: isAffectedJob is a pure private
// function. If its private signature changes, this test must be reviewed too.
const isAffectedJob = new Function('job', 'event', selector[1]);
const event = Object.freeze({
  eventId: 'synthetic-revocation',
  ownerUid: 'owner-A',
  purpose: 'life-movie.render',
  revokedAt: '2026-11-04T00:00:00.000Z',
});
function job(overrides = {}) {
  return { ownerUid: 'owner-A', sourceSystem: 'urai-studio', ...overrides };
}
const cases = [
  ['render selected from jobType', job({ jobType: 'studio.render.video' }), true],
  ['render selected from type', job({ type: 'studio.render.video' }), true],
  ['assemble selected from jobType', job({ jobType: 'studio.assemble.video' }), true],
  ['assemble selected from type', job({ type: 'studio.assemble.video' }), true],
  ['legacy jobType does not mask recognized render type', job({ jobType: 'legacy-other', type: 'studio.render.video' }), true],
  ['legacy jobType does not mask recognized assemble type', job({ jobType: 'legacy-other', type: 'studio.assemble.video' }), true],
  ['legacy type does not mask recognized assemble jobType', job({ jobType: 'studio.assemble.video', type: 'legacy-other' }), true],
  ['unrelated job never invalidated', job({ jobType: 'legacy-other', type: 'unrelated.job' }), false],
  ['foreign owner is excluded', job({ ownerUid: 'owner-B', type: 'studio.render.video' }), false],
  ['foreign source is excluded', job({ sourceSystem: 'other-worker', type: 'studio.render.video' }), false],
  ['non-string job type cannot impersonate render alias', job({ jobType: { toString: () => 'studio.render.video' } }), false],
  ['missing job type is excluded', job(), false],
];
for (const [name, candidate, expected] of cases) {
  test(name, () => assert.equal(isAffectedJob(candidate, event), expected));
}
