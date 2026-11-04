import { randomUUID } from 'node:crypto';
import { deriveStudioLifeMovieRenderScope, type StudioLifeMovieRenderPayload } from '../jobs/studioLifeMovieContract.js';
import type { LifeMovieSourceRightsEvidence } from './lifeMovieAdmissionPreflight.js';
import type { LifeMovieRenderScope } from './lifeMovieConsentDecision.js';

/** A selection reference LOCATES an independently provisioned server-owned record.
 * It never establishes ownership or permission by itself. This verifier is a
 * nonproduction integration component and cannot open the Jobs render gate. */
type Source = StudioLifeMovieRenderPayload['sources'][number];
type Request = Readonly<{
  ownerUid: string;
  tenantId: string;
  selection: Pick<StudioLifeMovieRenderPayload, 'projectId' | 'renderPlanDigest' | 'sources'>;
  renderScope: LifeMovieRenderScope;
}>;
export type RightsBackend = Readonly<{
  /** Server-only collection, never a client-writable Studio asset document. */
  readRightsRecord: (id: string) => Promise<Record<string, unknown> | null>;
  /** Must obtain deletion/revocation status from an authenticated authority. */
  assertCurrentOwner: (ownerUid: string, tenantId: string) => Promise<void>;
  currentObject: (bucket: string, objectPath: string) => Promise<Record<string, unknown>>;
  selectedGeneration: (bucket: string, objectPath: string, generation: string) => Promise<Record<string, unknown>>;
  /** Durable server-side audit. Failure must deny admission. */
  recordDecision: (event: Readonly<{ id: string; ownerUid: string; tenantId: string;
    projectId: string; renderPlanDigest: string; sourceSetDigest: string;
    renderScope: LifeMovieRenderScope; checkedAt: string; sourceCount: number }>) => Promise<void>;
  allowedBuckets: readonly string[];
  nowMs?: () => number;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[0-9a-f]{64}$/;
const GENERATION = /^[1-9][0-9]{0,19}$/;
const DENIED = 'life_movie_source_rights_unverified';
const MAX_SOURCES = 128;
const MAX_ISSUANCE_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const hasOwn = (record: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key);

// Snapshot all authority-bearing inputs before the first asynchronous read.
// Never authorize a movie based on source/generation fields subsequently
// mutated by an in-process caller or getter/proxy-backed claims. Plain JSON
// may arrive from a different JS realm, so compare own data descriptors rather
// than equating the prototype to this module's Object.prototype.
const SELECTION_FIELDS = ['projectId', 'renderPlanDigest', 'sources'] as const;
const SOURCE_FIELDS = [
  'id', 'bucket', 'objectPath', 'generation', 'mimeType', 'provenance',
  'sourceRefs', 'consentRef', 'ownerOrRightsRef',
] as const;
const SCOPE_FIELDS = ['projectId', 'renderPlanDigest', 'sourceSetDigest'] as const;
const REQUEST_FIELDS = ['ownerUid', 'tenantId', 'selection', 'renderScope'] as const;
function plainOwnRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(DENIED);
  const proto = Object.getPrototypeOf(value);
  const currentKeys = Reflect.ownKeys(Object.prototype);
  const plain = proto === null || proto === Object.prototype ||
    (typeof proto === 'object' && proto !== null &&
      Object.getPrototypeOf(proto) === null &&
      Reflect.ownKeys(proto).length === currentKeys.length &&
      currentKeys.every(key => Object.prototype.hasOwnProperty.call(proto, key)));
  if (!plain) throw new Error(DENIED);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length ||
      keys.some(key => typeof key !== 'string' || !fields.includes(key))) throw new Error(DENIED);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const pinned: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(DENIED);
    }
    pinned[field] = descriptor.value;
  }
  return pinned;
}
function ownDataArray(value: unknown, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max ||
      Reflect.ownKeys(value).length !== value.length + 1) throw new Error(DENIED);
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new Error(DENIED);
    result.push(descriptor.value);
  }
  return result;
}
function snapshotRightsRequest(raw: Request): Request {
  const r = plainOwnRecord(raw, REQUEST_FIELDS);
  const selection = plainOwnRecord(r.selection, SELECTION_FIELDS);
  const scope = plainOwnRecord(r.renderScope, SCOPE_FIELDS);
  const sourceInputs = ownDataArray(selection.sources, MAX_SOURCES);
  const sources = sourceInputs.map((input) => {
    const src = plainOwnRecord(input, SOURCE_FIELDS);
    const refs = ownDataArray(src.sourceRefs, 32);
    if (refs.some(x => typeof x !== 'string' || !x || x.length > 512)) throw new Error(DENIED);
    const copy: Record<string, unknown> = Object.create(null);
    for (const field of SOURCE_FIELDS) {
      if (field === 'sourceRefs') copy.sourceRefs = Object.freeze([...refs]);
      else if (typeof src[field] !== 'string') throw new Error(DENIED);
      else copy[field] = src[field];
    }
    return Object.freeze(copy);
  });
  const selectionSnapshot = Object.freeze({
    projectId: selection.projectId, renderPlanDigest: selection.renderPlanDigest,
    sources: Object.freeze(sources),
  });
  const scopeSnapshot = Object.freeze({
    projectId: scope.projectId, renderPlanDigest: scope.renderPlanDigest,
    sourceSetDigest: scope.sourceSetDigest,
  });
  return Object.freeze({
    ownerUid: r.ownerUid, tenantId: r.tenantId,
    selection: selectionSnapshot, renderScope: scopeSnapshot,
  }) as unknown as Request;
}

function validSource(source: Source): boolean {
  return !!source && typeof source === 'object' && !Array.isArray(source) &&
    typeof source.id === 'string' && ID.test(source.id) &&
    typeof source.ownerOrRightsRef === 'string' && ID.test(source.ownerOrRightsRef) &&
    typeof source.consentRef === 'string' && ID.test(source.consentRef) &&
    typeof source.bucket === 'string' && /^[a-z0-9][a-z0-9._-]{1,253}[a-z0-9]$/.test(source.bucket) &&
    typeof source.objectPath === 'string' && source.objectPath.length > 0 && source.objectPath.length <= 1024 &&
    !source.objectPath.startsWith('/') && !source.objectPath.includes('..') &&
    !source.objectPath.includes('\\') && !source.objectPath.split('/').some((s) => !s || s === '.') &&
    typeof source.generation === 'string' && GENERATION.test(source.generation) &&
    Number.isSafeInteger(Number(source.generation)) &&
    typeof source.mimeType === 'string' && source.mimeType.length > 0 && source.mimeType.length < 128 &&
    typeof source.provenance === 'string' && source.provenance.length > 0 &&
    Array.isArray(source.sourceRefs) && source.sourceRefs.length > 0 && source.sourceRefs.length <= 32 &&
    source.sourceRefs.every((ref) => typeof ref === 'string' && ref.length > 0 && ref.length <= 512);
}

function stringGeneration(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(DENIED);
  const result = String(value);
  if (!GENERATION.test(result) || !Number.isSafeInteger(Number(result))) throw new Error(DENIED);
  return result;
}

function assertRightsRecord(
  data: Record<string, unknown> | null, request: Request, source: Source, now: number,
): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(DENIED);
  const expiry = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
  const reviewed = typeof data.reviewedAt === 'string' ? Date.parse(data.reviewedAt) : NaN;
  if (data.schemaVersion !== 'urai-life-movie-source-rights-v1' ||
      data.issuer !== 'trusted-server-source-rights-v1' ||
      data.status !== 'approved' || data.purpose !== 'life-movie.render' ||
      data.ownerUid !== request.ownerUid || data.tenantId !== request.tenantId ||
      data.projectId !== request.selection.projectId || data.sourceId !== source.id ||
      data.bucket !== source.bucket || data.objectPath !== source.objectPath ||
      data.generation !== source.generation || data.mimeType !== source.mimeType ||
      data.consentRef !== source.consentRef || data.ownerOrRightsRef !== source.ownerOrRightsRef ||
      data.provenance !== source.provenance || !Array.isArray(data.sourceRefs) ||
      JSON.stringify(data.sourceRefs) !== JSON.stringify(source.sourceRefs) || data.revokedAt != null || data.deletedAt != null ||
      data.thirdPartyClearance !== 'verified' ||
      !hasOwn(data, 'evidenceHash') || typeof data.evidenceHash !== 'string' || !HASH.test(data.evidenceHash) ||
      !Number.isFinite(expiry) || expiry <= now ||
      !Number.isFinite(reviewed) || reviewed > now || now - reviewed > MAX_ISSUANCE_AGE_MS) {
    throw new Error(DENIED);
  }
}

function assertObject(
  metadata: Record<string, unknown>, source: Source,
): void {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      stringGeneration(metadata.generation) !== source.generation ||
      metadata.contentType !== source.mimeType ||
      metadata.timeDeleted != null || metadata.temporaryHold === true ||
      !/^[1-9][0-9]*$/.test(String(metadata.size ?? ''))) {
    throw new Error(DENIED);
  }
}

/**
 * Independently verify every selected source against a reviewed server-owned
 * record AND live plus pinned Storage metadata. Require a fresh owner-state
 * check before and after I/O, and write a durable audit before returning.
 * This result is point-in-time evidence, never a capability for processing.
 */
export function createLifeMovieSourceRightsVerifier(backend: RightsBackend) {
  if (!backend || typeof backend.readRightsRecord !== 'function' ||
      typeof backend.assertCurrentOwner !== 'function' ||
      typeof backend.currentObject !== 'function' ||
      typeof backend.selectedGeneration !== 'function' ||
      typeof backend.recordDecision !== 'function' ||
      !Array.isArray(backend.allowedBuckets) || backend.allowedBuckets.length === 0) {
    throw new Error(DENIED);
  }
  const bucketAllowlist = new Set(backend.allowedBuckets);
  const clock = backend.nowMs ?? Date.now;
  return async (raw: Request): Promise<LifeMovieSourceRightsEvidence> => {
    try {
      const request = snapshotRightsRequest(raw);
      const sources = request.selection.sources;
      const now = clock();
      if (!Number.isSafeInteger(now) || now <= 0 ||
          typeof request.ownerUid !== 'string' || !ID.test(request.ownerUid) ||
          typeof request.tenantId !== 'string' || !ID.test(request.tenantId) ||
          typeof request.selection.projectId !== 'string' || !ID.test(request.selection.projectId) ||
          !HASH.test(request.selection.renderPlanDigest) ||
          !HASH.test(request.renderScope?.sourceSetDigest) ||
          // Recompute the canonical selection hash; never trust a request-supplied digest.
          deriveStudioLifeMovieRenderScope(request.selection).sourceSetDigest !== request.renderScope.sourceSetDigest ||
          request.renderScope.projectId !== request.selection.projectId ||
          request.renderScope.renderPlanDigest !== request.selection.renderPlanDigest ||
          !Array.isArray(sources) || sources.length === 0 || sources.length > MAX_SOURCES ||
          sources.some((source) => !validSource(source) || !bucketAllowlist.has(source.bucket)) ||
          new Set(sources.map((source) => source.id)).size !== sources.length ||
          new Set(sources.map((source) => source.ownerOrRightsRef)).size !== sources.length) {
        throw new Error(DENIED);
      }
      await backend.assertCurrentOwner(request.ownerUid, request.tenantId);
      for (const source of sources) {
        const record = await backend.readRightsRecord(source.ownerOrRightsRef);
        assertRightsRecord(record, request, source, clock());
        const [live, selected] = await Promise.all([
          backend.currentObject(source.bucket, source.objectPath),
          backend.selectedGeneration(source.bucket, source.objectPath, source.generation),
        ]);
        assertObject(live, source);
        assertObject(selected, source);
      }
      await backend.assertCurrentOwner(request.ownerUid, request.tenantId);
      // Rights may be revoked or replaced while immutable Storage metadata is
      // checked. Re-read the server-owned records before recording an allow.
      // This narrows the race; the result is still point-in-time evidence,
      // never a processing grant or a substitute for lifecycle rechecks.
      for (const source of sources) {
        const currentRights = await backend.readRightsRecord(source.ownerOrRightsRef);
        assertRightsRecord(currentRights, request, source, clock());
      }
      const checkedAt = clock();
      if (!Number.isSafeInteger(checkedAt) || checkedAt < now || checkedAt - now > 30_000) throw new Error(DENIED);
      const id = randomUUID();
      await backend.recordDecision({
        id, ownerUid: request.ownerUid, tenantId: request.tenantId,
        projectId: request.selection.projectId,
        renderPlanDigest: request.renderScope.renderPlanDigest,
        sourceSetDigest: request.renderScope.sourceSetDigest,
        // Server-derived, snapshot-stable full scope. An audit alone is NEVER
        // a permission or proof of source-rights issuance.
        renderScope: request.renderScope,
        checkedAt: new Date(checkedAt).toISOString(), sourceCount: sources.length,
      });
      return Object.freeze({ ownerUid: request.ownerUid, tenantId: request.tenantId,
        renderScope: request.renderScope, verifiedAt: new Date(checkedAt).toISOString(), rightsEventId: id });
    } catch {
      throw new Error(DENIED);
    }
  };
}
