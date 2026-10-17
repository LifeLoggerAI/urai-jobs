import assert from 'node:assert/strict';
import { watch } from './captured-reality-gpu-deadline-watchdog.mjs';
const config = { schemaVersion: 'urai-synthetic-provider-deadline-v1', provider: 'runpod', syntheticDiagnostic: true,
  familySourceIncluded: false, providerCredentialScope: 'RUNPOD_READ_WRITE', providerCredentialPerPodScoped: false,
  localTerminationPolicy: { allowedPodId: 'fixturepod01', allowedActions: ['READ_POD', 'TERMINATE_POD'], allowCreate: false },
  providerPodId: 'fixturepod01', expectedName: 'cr_synthetic_gpu_smoke_fixture',
  expectedImage: `fixture.invalid/gpu@sha256:${'a'.repeat(64)}`, requestDigest: 'b'.repeat(64),
  sourceManifestSha256: 'c'.repeat(64), maxTerminationAttempts: 1,
  observedAt: '2026-10-08T00:00:00.000Z', terminateAt: '2026-10-08T00:00:03.000Z' };
const pod = { id: config.providerPodId, name: config.expectedName, imageName: config.expectedImage, cloudType: 'SECURE', gpuCount: 1 };
async function run({ foreign = false, ambiguous = false, unavailable = false } = {}) {
  let clock = Date.parse(config.observedAt), calls = [], gone = false;
  const request = async (method, route) => {
    calls.push({ method, route, at: clock });
    if (method === 'DELETE') { if (!unavailable) gone = true; if (ambiguous) throw new Error('fixture ambiguous transport'); return { status: 202 }; }
    return gone ? { status: 404 } : { status: 200, body: { ...pod, ...(foreign ? { name: 'foreign_fixture' } : {}) } };
  };
  const operation = watch(config, { request, now: () => clock, sleep: async ms => { clock += ms; } });
  return { operation, calls };
}
const success = await run();
assert.equal((await success.operation).resourceGoneVerified, true);
assert.equal(success.calls.filter(c => c.method === 'DELETE').length, 1);
assert.ok(success.calls.find(c => c.method === 'DELETE').at >= Date.parse(config.terminateAt));
const foreign = await run({ foreign: true });
await assert.rejects(foreign.operation, /IDENTITY/);
assert.equal(foreign.calls.filter(c => c.method === 'DELETE').length, 0);
const ambiguous = await run({ ambiguous: true });
assert.equal((await ambiguous.operation).resourceGoneVerified, true);
assert.equal(ambiguous.calls.filter(c => c.method === 'DELETE').length, 1);
const unavailable = await run({ ambiguous: true, unavailable: true });
await assert.rejects(unavailable.operation, /NOT_VERIFIED/);
assert.equal(unavailable.calls.filter(c => c.method === 'DELETE').length, 1);
await assert.rejects(watch({ ...config, terminateAt: '2026-10-08T01:00:00Z' }, { request: async () => { throw new Error('must not run'); } }), /BINDING/);
for (const change of [{ localTerminationPolicy: { ...config.localTerminationPolicy, allowedPodId: 'otherpod01' } },
  { localTerminationPolicy: { ...config.localTerminationPolicy, allowCreate: true } },
  { localTerminationPolicy: { ...config.localTerminationPolicy, allowedActions: ['CREATE_POD'] } },
  { providerCredentialPerPodScoped: true }]) {
  await assert.rejects(watch({ ...config, ...change }, { request: async () => { throw new Error('must not run'); } }), /BINDING/);
}
process.stdout.write('[PASS] nine synthetic deadline/identity/transport/scope controls; no provider requests, spend or real cap verification\n');
