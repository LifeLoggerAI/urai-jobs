// External control-process preparation. This is NOT a provider-enforced cap.
// Run only on a durable authenticated controller, never inside the target Pod.
// RUNPOD_API_KEY is a newly prepared diagnostic binding, not an existing engine secret.
// Native READ_WRITE authority is broader than this local fixed-Pod policy.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const SHA = /^[a-f0-9]{64}$/;
function validate(c) {
  if (c?.schemaVersion !== 'urai-synthetic-provider-deadline-v1' || c.provider !== 'runpod'
      || c.syntheticDiagnostic !== true || c.familySourceIncluded !== false
      || c.providerCredentialScope !== 'RUNPOD_READ_WRITE' || c.providerCredentialPerPodScoped !== false
      || c.localTerminationPolicy?.allowedPodId !== c.providerPodId
      || JSON.stringify(c.localTerminationPolicy?.allowedActions) !== JSON.stringify(['READ_POD', 'TERMINATE_POD'])
      || c.localTerminationPolicy?.allowCreate !== false
      || !/^[a-z0-9]{6,50}$/.test(c.providerPodId || '') || !/^cr_synthetic_gpu_smoke_[A-Za-z0-9_]+$/.test(c.expectedName || '')
      || !/^.+@sha256:[a-f0-9]{64}$/.test(c.expectedImage || '') || !SHA.test(c.requestDigest || '')
      || !SHA.test(c.sourceManifestSha256 || '') || c.maxTerminationAttempts !== 1
      || !Number.isFinite(Date.parse(c.observedAt)) || !Number.isFinite(Date.parse(c.terminateAt))
      || Date.parse(c.terminateAt) <= Date.parse(c.observedAt)
      || Date.parse(c.terminateAt) - Date.parse(c.observedAt) > 720000) throw new Error('DEADLINE_BINDING_INVALID');
  return c;
}
export async function watch(c, { request, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  validate(c);
  let attempts = 0;
  const route = `/pods/${c.providerPodId}`;
  const identity = pod => {
    if (pod?.id !== c.providerPodId || pod.name !== c.expectedName || pod.imageName !== c.expectedImage
        || pod.cloudType !== 'SECURE' || pod.gpuCount !== 1) throw new Error('POD_IDENTITY_OR_SECURE_CLOUD_MISMATCH');
  };
  const initial = await request('GET', route);
  if (initial.status !== 200) throw new Error('CURRENT_POD_READBACK_UNAVAILABLE');
  identity(initial.body);
  while (now() < Date.parse(c.terminateAt)) await sleep(Math.min(1000, Date.parse(c.terminateAt) - now()));
  const fresh = await request('GET', route);
  if (fresh.status === 404) return { providerPodId: c.providerPodId, resourceGoneVerified: true, terminationAttempts: 0,
    providerEnforcedDeadline: false, syntheticDiagnostic: true, costReadbackRequired: true };
  if (fresh.status !== 200) throw new Error('TERMINATION_IDENTITY_READBACK_UNAVAILABLE');
  identity(fresh.body);
  attempts++;
  let transportAmbiguous = false;
  try { const result = await request('DELETE', route); if (![200, 202, 204, 404].includes(result.status)) transportAmbiguous = true; }
  catch { transportAmbiguous = true; }
  // Never treat uncertain transport as an absent Pod; never issue a second DELETE.
  for (let i = 0; i < 4; i++) {
    const state = await request('GET', route).catch(() => ({ status: 0 }));
    if (state.status === 404) return { providerPodId: c.providerPodId, resourceGoneVerified: true,
      terminationAttempts: attempts, transportAmbiguous, providerEnforcedDeadline: false,
      syntheticDiagnostic: true, sourceManifestSha256: c.sourceManifestSha256, requestDigest: c.requestDigest,
      providerCostUsd: null, costReadbackRequired: true };
    if (state.status === 200) identity(state.body);
    if (i < 3) await sleep(1000);
  }
  throw new Error('PROVIDER_TERMINATION_NOT_VERIFIED_EXACT_HANDOFF_REQUIRED');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = JSON.parse(await fs.readFile(process.env.URAI_DEADLINE_CONFIG_PATH || '', 'utf8'));
  validate(c);
  if (c.credentialBindingVerified !== true || c.externalWatcherBindingVerified !== true)
    throw new Error('EXTERNAL_SECURE_BINDING_NOT_VERIFIED');
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error('SECURE_PROVIDER_TOKEN_BINDING_REQUIRED');
  const request = async (method, route) => {
    const response = await fetch(`https://rest.runpod.io/v1${route}`, { method,
      headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    return { status: response.status, body: response.status === 200 && method === 'GET' ? await response.json() : null };
  };
  const receipt = await watch(c, { request });
  await fs.writeFile(process.env.URAI_DEADLINE_RECEIPT_PATH || '', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify({ resourceGoneVerified: receipt.resourceGoneVerified, costReadbackRequired: true }) + '\n');
}
