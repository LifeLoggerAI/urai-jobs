// Fail-closed, pure dual-project authorization regression suite.
// This suite tests the real compiled TypeScript implementation, not a copied mock.
// Run after the Functions build: npm run chalk:bridge:test
import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeChalkCrossProject} from '../functions/lib/functions/jobs/chalkCrossProjectAuthority.js';

const NOW = 1800000000000;
const valid = () => ({
  jobs: {
    uid: 'jobs_founder_123',
    operator: true,
    profile: {permissions: ['engineering:operate'], tenantId: 'tenant_one', orgId: 'org_one'},
  },
  spatial: {
    uid: 'spatial_founder_123',
    audience: 'demo-urai-auth-journey',
    issuer: 'https://securetoken.google.com/demo-urai-auth-journey',
    tokenOperator: true,
    liveOperator: true,
    disabled: false,
    tenantId: 'tenant_one',
    orgId: 'org_one',
  },
  binding: {
    jobsUid: 'jobs_founder_123',
    spatialUid: 'spatial_founder_123',
    status: 'approved',
    purpose: 'chalk-engineering',
    revoked: false,
    scopes: ['engineering:read', 'engineering:intake'],
    expiresAtMs: NOW + 600000,
    tenantId: 'tenant_one',
    orgId: 'org_one',
    revision: 4,
  },
  action: 'engineering:read',
  nowMs: NOW,
});

test('approved dual identity authorizes only the exact read lease', () => {
  const lease = authorizeChalkCrossProject(valid());
  assert.deepEqual(lease, {
    jobsUid: 'jobs_founder_123',
    spatialUid: 'spatial_founder_123',
    action: 'engineering:read',
    bindingRevision: 4,
    expiresAtMs: NOW + 600000,
    tenantId: 'tenant_one',
    orgId: 'org_one',
  });
  assert.equal(Object.isFrozen(lease), true);
});

test('separately approved intake action retains both identities', () => {
  const x = valid();
  x.action = 'engineering:intake';
  assert.equal(authorizeChalkCrossProject(x).action, 'engineering:intake');
});

test('unscoped tenants require agreement across all three authorities', () => {
  const x = valid();
  x.jobs.profile.tenantId = null;
  x.jobs.profile.orgId = null;
  x.spatial.tenantId = null;
  x.spatial.orgId = null;
  x.binding.tenantId = null;
  x.binding.orgId = null;
  const lease = authorizeChalkCrossProject(x);
  assert.equal(lease.tenantId, null);
  assert.equal(lease.orgId, null);
});

test('exact fifteen-minute expiry boundary is permitted, not extended', () => {
  const x = valid();
  x.binding.expiresAtMs = NOW + 15 * 60 * 1000;
  assert.equal(authorizeChalkCrossProject(x).expiresAtMs, x.binding.expiresAtMs);
});

const rejected = [
  ['unsupported action', x => {x.action = 'engineering:deploy'}, 'ACTION'],
  ['non-integer clock', x => {x.nowMs = NOW + 0.5}, 'ACTION'],
  ['negative clock', x => {x.nowMs = -1}, 'ACTION'],
  ['missing Jobs actor', x => {x.jobs = null}, 'JOBS_ACTOR'],
  ['malformed Jobs UID', x => {x.jobs.uid = 'bad'}, 'JOBS_ACTOR'],
  ['Jobs operator disabled', x => {x.jobs.operator = false}, 'JOBS_ACTOR'],
  ['Jobs permission missing', x => {x.jobs.profile.permissions = []}, 'JOBS_ACTOR'],
  ['Jobs permissions not an array', x => {x.jobs.profile.permissions = 'engineering:operate'}, 'JOBS_ACTOR'],
  ['missing Spatial actor', x => {x.spatial = null}, 'SPATIAL_ACTOR'],
  ['malformed Spatial UID', x => {x.spatial.uid = 'bad'}, 'SPATIAL_ACTOR'],
  ['Spatial account disabled', x => {x.spatial.disabled = true}, 'SPATIAL_ACTOR'],
  ['untrusted token operator claim', x => {x.spatial.tokenOperator = false}, 'SPATIAL_ACTOR'],
  ['untrusted live operator claim', x => {x.spatial.liveOperator = false}, 'SPATIAL_ACTOR'],
  ['wrong Spatial audience', x => {x.spatial.audience = 'demo-urai-jobs'}, 'SPATIAL_ACTOR'],
  ['wrong Spatial issuer', x => {x.spatial.issuer = 'https://securetoken.google.com/demo-urai-jobs'}, 'SPATIAL_ACTOR'],
  ['missing owner binding', x => {x.binding = null}, 'BINDING'],
  ['different Jobs binding UID', x => {x.binding.jobsUid = 'jobs_other_12345'}, 'BINDING'],
  ['different Spatial binding UID', x => {x.binding.spatialUid = 'spatial_other_12345'}, 'BINDING'],
  ['binding not approved', x => {x.binding.status = 'pending'}, 'BINDING'],
  ['binding wrong purpose', x => {x.binding.purpose = 'general-assistant'}, 'BINDING'],
  ['binding revoked', x => {x.binding.revoked = true}, 'BINDING'],
  ['binding revision missing', x => {delete x.binding.revision}, 'BINDING'],
  ['binding revision zero', x => {x.binding.revision = 0}, 'BINDING'],
  ['binding expired', x => {x.binding.expiresAtMs = NOW}, 'BINDING'],
  ['binding exceeds fifteen minutes', x => {x.binding.expiresAtMs = NOW + 900001}, 'BINDING'],
  ['binding scopes empty', x => {x.binding.scopes = []}, 'BINDING'],
  ['binding scopes duplicated', x => {x.binding.scopes = ['engineering:read','engineering:read']}, 'BINDING'],
  ['binding scopes include unapproved operation', x => {x.binding.scopes = ['engineering:read','engineering:deploy']}, 'BINDING'],
  ['binding does not grant requested action', x => {x.binding.scopes = ['engineering:intake']}, 'BINDING'],
  ['Jobs tenant identifier malformed', x => {x.jobs.profile.tenantId = '../escape'}, 'TENANT'],
  ['Jobs organization identifier malformed', x => {x.jobs.profile.orgId = '?bad'}, 'TENANT'],
  ['Spatial tenant mismatch', x => {x.spatial.tenantId = 'tenant_other'}, 'TENANT'],
  ['Spatial organization mismatch', x => {x.spatial.orgId = 'org_other'}, 'TENANT'],
  ['binding tenant mismatch', x => {x.binding.tenantId = 'tenant_other'}, 'TENANT'],
  ['binding organization mismatch', x => {x.binding.orgId = 'org_other'}, 'TENANT'],
  ['missing Spatial tenant against scoped Jobs', x => {x.spatial.tenantId = null}, 'TENANT'],
];
for (const [name, mutate, code] of rejected) {
  test('fail closed: ' + name, () => {
    const input = valid();
    mutate(input);
    assert.throws(
      () => authorizeChalkCrossProject(input),
      new RegExp('CHALK_CROSS_PROJECT_' + code),
    );
  });
}
