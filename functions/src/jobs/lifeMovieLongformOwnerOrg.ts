/**
 * A Life Movie plan's organization is a server-owned identity, not an input
 * claim. Capture it in the admission transaction and compare it against every
 * private child, assembly job, and current owner before subsequent use.
 *
 * These are supplemental org checks: callers MUST also use the existing
 * active owner/tenant/deletion and consent authority checks.
 */
const DENIED = 'life_movie_owner_org_authority_unavailable';
const ORG_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function orgFromRecord(value: unknown, persisted: boolean): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(DENIED);
  const record = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(DENIED);
  const descriptor = Object.getOwnPropertyDescriptor(record, 'orgId');
  if (!descriptor) {
    if ('orgId' in record) throw new Error(DENIED);
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new Error(DENIED);
  const raw = descriptor.value;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new Error(DENIED);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!ORG_ID.test(trimmed) || (persisted && trimmed !== raw)) throw new Error(DENIED);
  return trimmed;
}

/** Only the current, server-read owner document may provide a new plan org. */
export function serverLifeMovieOwnerOrgId(serverOwner: unknown): string | null {
  return orgFromRecord(serverOwner, false);
}

/** Missing legacy org is compatible ONLY if the actual owner is also unscoped. */
export function assertLifeMoviePlanCurrentOrg(plan: unknown, serverOwner: unknown): void {
  const declared = orgFromRecord(plan, true);
  const current = orgFromRecord(serverOwner, false);
  if (declared !== current) throw new Error(DENIED);
}

/** Stop cross-org child or assembled media even when owner and tenant match. */
export function assertLifeMovieJobPlanOrg(plan: unknown, job: unknown): void {
  if (orgFromRecord(plan, true) !== orgFromRecord(job, true)) {
    throw new Error('life_movie_job_org_binding_mismatch');
  }
}
