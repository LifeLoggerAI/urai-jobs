// Pure, fail-closed dual-identity and purpose-bound authorization contract.
// A browser-supplied UID, provider answer, or Spatial ID token alone is never Jobs authority.
export type ChalkBridgeAction = 'engineering:read' | 'engineering:intake';
type Principal = {uid: string; audience: string; issuer: string; tokenOperator: boolean;
  liveOperator: boolean; disabled: boolean; tenantId: string | null; orgId: string | null};
type JobsActor = {uid: string; operator: boolean; profile: {permissions?: unknown;
  tenantId?: unknown; orgId?: unknown}};
type Binding = {jobsUid?: unknown; spatialUid?: unknown; status?: unknown; purpose?: unknown;
  revoked?: unknown; scopes?: unknown; expiresAtMs?: unknown;
  tenantId?: unknown; orgId?: unknown; revision?: unknown};
const uid = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(v);
const scopeSet = new Set<ChalkBridgeAction>(['engineering:read','engineering:intake']);
const identity = (v: unknown) => typeof v === 'string' && v.length >= 1 && v.length <= 128 &&
  /^[A-Za-z0-9_.:-]+$/.test(v);
const normalizeScope = (v: unknown) => v === undefined || v === null ? null : v;
function denied(code: string): never { throw new Error('CHALK_CROSS_PROJECT_' + code); }

export function authorizeChalkCrossProject(input: {jobs: JobsActor; spatial: Principal;
  binding: Binding | null; action: ChalkBridgeAction; nowMs: number}) {
  const {jobs,spatial,binding,action,nowMs} = input;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !scopeSet.has(action)) denied('ACTION');
  if (!jobs || !uid(jobs.uid) || jobs.operator !== true ||
      !Array.isArray(jobs.profile?.permissions) ||
      !jobs.profile.permissions.includes('engineering:operate')) denied('JOBS_ACTOR');
  if (!spatial || !uid(spatial.uid) || spatial.disabled !== false ||
      spatial.audience !== 'demo-urai-auth-journey' ||
      spatial.issuer !== 'https://securetoken.google.com/demo-urai-auth-journey' ||
      spatial.tokenOperator !== true || spatial.liveOperator !== true) denied('SPATIAL_ACTOR');
  if (!binding || binding.jobsUid !== jobs.uid || binding.spatialUid !== spatial.uid ||
      binding.status !== 'approved' || binding.purpose !== 'chalk-engineering' ||
      binding.revoked !== false || !Number.isSafeInteger(binding.revision) || Number(binding.revision) < 1 ||
      !Number.isSafeInteger(binding.expiresAtMs) || Number(binding.expiresAtMs) <= nowMs ||
      Number(binding.expiresAtMs) > nowMs + 15 * 60 * 1000 ||
      !Array.isArray(binding.scopes) || binding.scopes.length < 1 ||
      new Set(binding.scopes).size !== binding.scopes.length ||
      !binding.scopes.every(s => scopeSet.has(s as ChalkBridgeAction)) ||
      !binding.scopes.includes(action)) denied('BINDING');
  const tenant = normalizeScope(jobs.profile.tenantId);
  const org = normalizeScope(jobs.profile.orgId);
  if ((tenant !== null && !identity(tenant)) || (org !== null && !identity(org)) ||
      spatial.tenantId !== tenant || spatial.orgId !== org ||
      normalizeScope(binding.tenantId) !== tenant || normalizeScope(binding.orgId) !== org) denied('TENANT');
  return Object.freeze({jobsUid: jobs.uid, spatialUid: spatial.uid, action,
    bindingRevision: Number(binding.revision), expiresAtMs: Number(binding.expiresAtMs),
    tenantId: tenant as string | null, orgId: org as string | null});
}
