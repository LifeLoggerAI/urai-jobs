import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mayApplyNewConsentRevocation as allow } from '../functions/src/privacy/consentRevocationOrder.ts';

const incoming = Object.freeze({eventId:'b'.repeat(64), ownerUid:'owner-1', purpose:'life-movie.render', revokedAt:'2026-11-03T05:00:00.000Z'});
const oldBlock = Object.freeze({eventId:'a'.repeat(64), ownerUid:'owner-1', purpose:'life-movie.render', active:true, revokedAt:'2026-11-03T04:00:00.000Z'});
test('fresh revocation can establish first block', () => assert.equal(allow(false, null, incoming), true));
test('strictly newer valid revocation supersedes prior block', () => assert.equal(allow(true, oldBlock, incoming), true));
test('prior event cannot overwrite newer block', () => assert.equal(allow(true, {...oldBlock, revokedAt:'2026-11-03T06:00:00.000Z'},incoming), false));
test('same timestamp different event cannot supersede', () => assert.equal(allow(true, {...oldBlock, revokedAt:incoming.revokedAt},incoming), false));
test('same event with missing receipt requires reconciliation', () => assert.equal(allow(true, {...oldBlock, eventId:incoming.eventId},incoming), false));
test('previous block bound to another owner is never superseded', () => assert.equal(allow(true, {...oldBlock, ownerUid:'another'},incoming), false));
test('previous block bound to another purpose is never superseded', () => assert.equal(allow(true, {...oldBlock, purpose:'memory.storage'},incoming), false));
test('cleared grant boundary cannot be overwritten by old-style revocation', () => assert.equal(allow(true, {...oldBlock, active:false},incoming), false));
test('missing boolean block authority fails closed', () => assert.equal(allow(true, {...oldBlock, active:'true'},incoming), false));
test('malformed previous block fails closed', () => assert.equal(allow(true, {}, incoming), false));
test('malformed previous timestamps fail closed', () => {
  for(const value of ['not-date','2026-15-03T04:00:00.000Z','2026-11-03T04:00:00+00:00',42,null])
    assert.equal(allow(true,{...oldBlock,revokedAt:value},incoming),false);
});
test('missing incoming identity cannot bypass timestamp comparison', () => {
  for(const field of ['eventId','ownerUid','purpose','revokedAt']) assert.equal(allow(true,oldBlock,{...incoming,[field]:''}),false);
});
test('invalid exists marker fails closed', () => assert.equal(allow('false', oldBlock,incoming),false));
test('strictly newer fractions compare correctly', () => {
  const first={...oldBlock, revokedAt:'2026-11-03T05:00:00.001Z'};
  assert.equal(allow(true,first,{...incoming,revokedAt:'2026-11-03T05:00:00.002Z'}),true);
  assert.equal(allow(true,first,{...incoming,revokedAt:'2026-11-03T05:00:00.000Z'}),false);
});
test('calendar-normalized invalid previous timestamp is not accepted as ordering evidence', () => {
  const malformed={...oldBlock, revokedAt:'2026-02-31T04:00:00.000Z'};
  assert.equal(allow(true,malformed,incoming),false);
});
