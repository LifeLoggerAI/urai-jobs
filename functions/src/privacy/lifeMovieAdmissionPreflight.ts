import { randomUUID } from 'node:crypto';
import { deriveStudioLifeMovieRenderScope, type StudioLifeMovieRenderPayload } from '../jobs/studioLifeMovieContract.js';
import type { ExpectedLifeMovieDecision, LifeMovieRenderScope } from './lifeMovieConsentDecision.js';

type Selection = Pick<StudioLifeMovieRenderPayload, 'projectId' | 'renderPlanDigest' | 'sources'>;

type ConsentReference = Readonly<{
  purpose: string;
  policyVersion: string;
  decisionReceiptId: string;
}>;

export type LifeMovieAdmissionRequest = Readonly<{
  ownerUid: string;
  tenantId: string;
  consent: ConsentReference;
  selection: Selection;
}>;

export type LifeMovieSourceRightsEvidence = Readonly<{
  ownerUid: string;
  tenantId: string;
  renderScope: LifeMovieRenderScope;
  verifiedAt: string;
  rightsEventId: string;
}>;

export type LifeMovieAdmissionDependencies = Readonly<{
  /** Must inspect server-owned source records and exact immutable Storage generations. */
  verifySourceRights: (request: Readonly<{
    ownerUid: string;
    tenantId: string;
    selection: Selection;
    renderScope: LifeMovieRenderScope;
  }>) => Promise<LifeMovieSourceRightsEvidence>;
  /** The authenticated Jobs-to-Privacy transport; not a Studio supplied result. */
  getCurrentPrivacyDecision: (expected: ExpectedLifeMovieDecision) => Promise<Readonly<{
    decisionEventId: string;
    evaluatedAt: string;
  }>>;
  nowMs?: () => number;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_RIGHTS_AGE_MS = 30_000;
// Long-form plans allow up to 128 distinct immutable sources. The short-form
// bridge independently Zod-limits its source list to 12 before this preflight.
const MAX_ADMISSION_SOURCES = 128;
const UNAVAILABLE = 'life_movie_admission_authority_unavailable';
const RIGHTS_DENIED = 'life_movie_source_rights_unverified';

/** Make a data-only, immutable copy of the exact media authorization input.
 * Never keep references to a caller-owned selection across await boundaries.
 * Upstream Zod parsing remains mandatory; this is an independent race fence.
 */
function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(UNAVAILABLE);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new Error(UNAVAILABLE);
  return descriptor.value;
}

const SOURCE_FIELDS = [
  'id', 'bucket', 'objectPath', 'generation', 'mimeType', 'provenance',
  'sourceRefs', 'consentRef', 'ownerOrRightsRef',
] as const;

function exactOwnKeys(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const actual = Reflect.ownKeys(value);
    return actual.length === keys.length && actual.every(key =>
      typeof key === 'string' && keys.includes(key));
  } catch {
    return false;
  }
}

function checkedOwnArray(value: unknown, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max ||
      Reflect.ownKeys(value).length !== value.length + 1) throw new Error(UNAVAILABLE);
  return Object.freeze(Array.from({ length: value.length }, (_, i) => {
    const entry = Object.getOwnPropertyDescriptor(value, String(i));
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, 'value')) throw new Error(UNAVAILABLE);
    return entry.value;
  }));
}

function snapshotAdmissionRequest(raw: LifeMovieAdmissionRequest): LifeMovieAdmissionRequest {
  if (!exactOwnKeys(raw, ['ownerUid', 'tenantId', 'consent', 'selection'])) throw new Error(UNAVAILABLE);
  const consent = ownData(raw, 'consent');
  if (!exactOwnKeys(consent, ['purpose', 'policyVersion', 'decisionReceiptId'])) throw new Error(UNAVAILABLE);
  const originalSelection = ownData(raw, 'selection');
  if (!exactOwnKeys(originalSelection, ['projectId', 'renderPlanDigest', 'sources'])) throw new Error(UNAVAILABLE);
  const originalSources = checkedOwnArray(ownData(originalSelection, 'sources'), MAX_ADMISSION_SOURCES);
  const sources = originalSources.map((item) => {
    if (!exactOwnKeys(item, SOURCE_FIELDS)) throw new Error(UNAVAILABLE);
    const source: Record<string, unknown> = {};
    for (const key of SOURCE_FIELDS) {
      const value = ownData(item, key);
      if (value === undefined) throw new Error(UNAVAILABLE);
      if (key === 'sourceRefs') {
        const refs = checkedOwnArray(value, 32);
        if (refs.some(ref => typeof ref !== 'string' || ref.length < 1 || ref.length > 512)) throw new Error(UNAVAILABLE);
        source.sourceRefs = refs;
      } else {
        if (typeof value !== 'string') throw new Error(UNAVAILABLE);
        source[key] = value;
      }
    }
    return Object.freeze(source);
  });
  const selection: Selection = Object.freeze({
    projectId: ownData(originalSelection, 'projectId') as string,
    renderPlanDigest: ownData(originalSelection, 'renderPlanDigest') as string,
    sources: Object.freeze(sources) as Selection['sources'],
  });
  return Object.freeze({
    ownerUid: ownData(raw, 'ownerUid') as string,
    tenantId: ownData(raw, 'tenantId') as string,
    consent: Object.freeze({
      purpose: ownData(consent, 'purpose') as string,
      policyVersion: ownData(consent, 'policyVersion') as string,
      decisionReceiptId: ownData(consent, 'decisionReceiptId') as string,
    }),
    selection,
  });
}

const matchesScope = (a: LifeMovieRenderScope, b: LifeMovieRenderScope): boolean =>
  !!a && typeof a === 'object' && !Array.isArray(a) &&
  Reflect.ownKeys(a).length === 3 &&
  Object.prototype.hasOwnProperty.call(a, 'projectId') &&
  Object.prototype.hasOwnProperty.call(a, 'renderPlanDigest') &&
  Object.prototype.hasOwnProperty.call(a, 'sourceSetDigest') &&
  a.projectId === b.projectId && a.renderPlanDigest === b.renderPlanDigest &&
  a.sourceSetDigest === b.sourceSetDigest;

/**
 * Preparatory, point-in-time source and consent preflight. This does NOT grant
 * render permission or toggle the independently hard-closed Jobs/worker gate.
 *
 * The source-rights provider is deliberately mandatory: a matching digest,
 * a plausible ownerOrRightsRef, or lack of revocation cannot replace a
 * server-verified owner/tenant/source-generation rights lookup. Until an
 * approved provider exists, callers must fail closed rather than pass stubs.
 */
export function createLifeMovieAdmissionPreflight(deps: LifeMovieAdmissionDependencies) {
  if (!deps || typeof deps.verifySourceRights !== 'function' ||
      typeof deps.getCurrentPrivacyDecision !== 'function') {
    throw new Error(UNAVAILABLE);
  }
  const clock = deps.nowMs ?? Date.now;
  return async (rawInput: LifeMovieAdmissionRequest) => {
    let input: LifeMovieAdmissionRequest;
    try {
      input = snapshotAdmissionRequest(rawInput);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!input || typeof input.ownerUid !== 'string' || !ID.test(input.ownerUid) ||
        typeof input.tenantId !== 'string' || !ID.test(input.tenantId) ||
        input.consent?.purpose !== 'life-movie.render' ||
        input.consent?.policyVersion !== '1.1.0' ||
        !HASH.test(input.consent.decisionReceiptId) ||
        !input.selection || typeof input.selection.projectId !== 'string' || !ID.test(input.selection.projectId) ||
        !HASH.test(input.selection.renderPlanDigest) ||
        !Array.isArray(input.selection.sources) || !input.selection.sources.length) {
      throw new Error(UNAVAILABLE);
    }

    // This shared Jobs derivation binds source IDs, bucket/path, immutable GCS
    // generations, provenance, consent refs and source-rights refs. The caller
    // cannot supply its own sourceSetDigest in the authorization expectation.
    let scope: LifeMovieRenderScope;
    try {
      // Derive from the same immutable, data-only source set that is passed to
      // both independent rights checks. NEVER re-read caller-owned data here.
      scope = deriveStudioLifeMovieRenderScope(input.selection);
      if (!HASH.test(scope.sourceSetDigest) || scope.projectId !== input.selection.projectId ||
          scope.renderPlanDigest !== input.selection.renderPlanDigest) throw new Error(UNAVAILABLE);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    Object.freeze(scope);
    const now = clock();
    if (!Number.isSafeInteger(now) || now <= 0) throw new Error(UNAVAILABLE);

    let rights: LifeMovieSourceRightsEvidence;
    try {
      rights = await deps.verifySourceRights({
        ownerUid: input.ownerUid,
        tenantId: input.tenantId,
        selection: input.selection,
        renderScope: scope,
      });
    } catch {
      throw new Error(RIGHTS_DENIED);
    }
    const validRights = (evidence: LifeMovieSourceRightsEvidence, checkedAt: number): number => {
      const verifiedAt = evidence && typeof evidence.verifiedAt === 'string'
        ? Date.parse(evidence.verifiedAt) : NaN;
      if (!evidence || evidence.ownerUid !== input.ownerUid || evidence.tenantId !== input.tenantId ||
          !matchesScope(evidence.renderScope, scope) ||
          typeof evidence.rightsEventId !== 'string' || !ID.test(evidence.rightsEventId) ||
          !Number.isFinite(verifiedAt) || verifiedAt > checkedAt ||
          checkedAt - verifiedAt > MAX_RIGHTS_AGE_MS) {
        throw new Error(RIGHTS_DENIED);
      }
      return verifiedAt;
    };
    // The source verifier does asynchronous Firestore/Storage checks. Its
    // server-issued timestamp is expected to be later than the clock sampled
    // before those reads. Check against a fresh post-verification timestamp.
    const rightsCheckedAt = clock();
    if (!Number.isSafeInteger(rightsCheckedAt) || rightsCheckedAt < now ||
        rightsCheckedAt - now > MAX_RIGHTS_AGE_MS) throw new Error(RIGHTS_DENIED);
    const rightsMs = validRights(rights, rightsCheckedAt);

    const expected: ExpectedLifeMovieDecision = Object.freeze({
      subjectUid: input.ownerUid,
      tenantId: input.tenantId,
      correlationId: randomUUID(),
      decisionReceiptId: input.consent.decisionReceiptId,
      renderScope: scope,
    });
    let decision: { decisionEventId: string; evaluatedAt: string };
    try {
      decision = await deps.getCurrentPrivacyDecision(expected);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    const decisionMs = decision && typeof decision.evaluatedAt === 'string' ? Date.parse(decision.evaluatedAt) : NaN;
    const finishedAt = clock();
    if (!decision || typeof decision.decisionEventId !== 'string' || !ID.test(decision.decisionEventId) ||
        !Number.isSafeInteger(finishedAt) || !Number.isFinite(decisionMs) ||
        decisionMs > finishedAt || finishedAt - decisionMs > MAX_RIGHTS_AGE_MS ||
        finishedAt - rightsMs > MAX_RIGHTS_AGE_MS) {
      throw new Error(UNAVAILABLE);
    }

    // Rights can be revoked while Privacy evaluates the scoped grant. Repeat
    // the server-owned source and immutable-generation check after the remote
    // decision, never reuse the earlier rights event as a lasting capability.
    // This is intentionally a point-in-time second audit; every media lifecycle
    // stage still needs independent, fresh authorization before activation.
    let finalRights: LifeMovieSourceRightsEvidence;
    try {
      finalRights = await deps.verifySourceRights({
        ownerUid: input.ownerUid,
        tenantId: input.tenantId,
        selection: input.selection,
        renderScope: scope,
      });
    } catch {
      throw new Error(RIGHTS_DENIED);
    }
    const finalTime = clock();
    if (!Number.isSafeInteger(finalTime) || finalTime < finishedAt ||
        finalTime - rightsMs > MAX_RIGHTS_AGE_MS) throw new Error(RIGHTS_DENIED);
    const finalRightsMs = validRights(finalRights, finalTime);
    if (finalRightsMs < rightsMs) throw new Error(RIGHTS_DENIED);

    // Audit identifiers only; this return value MUST NEVER be treated as a
    // reusable capability or proof of independent source/issuer approval.
    return Object.freeze({ rightsEventId: finalRights.rightsEventId,
      decisionEventId: decision.decisionEventId, evaluatedAt: decision.evaluatedAt,
      renderScope: scope });
  };
}
