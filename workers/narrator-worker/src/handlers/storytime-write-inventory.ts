import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';
import { STORYTIME_NARRATOR_WRITES } from './storytime-write-ledger.js';

/** Read-only, bounded inventory. Reports only; NEVER deletes or acknowledges
 * owner deletion. Legacy uploads lacking journal records remain unresolved. */
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const AUDIO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp3|ogg)$/i;
const GEN = /^[1-9][0-9]{0,19}$/;
const MAX = 100;

export type StorytimeInventoryScope = { ownerUid: string; sessionId: string; narratorScriptId: string };
export type StorytimeInventoryCoverage = { ledgerComplete?: boolean; objectComplete?: boolean };
export type StorytimeInventoryEntry = {
  objectPath: string;
  generation: string | null;
  reservationId: string | null;
  state: string;
  reason: string;
};

function validateScope(scope: StorytimeInventoryScope): string {
  if (!scope || ![scope.ownerUid,scope.sessionId,scope.narratorScriptId].every(v=>typeof v==='string'&&SAFE.test(v))) {
    throw new Error('storytime_inventory_scope_invalid');
  }
  return 'storytime/' + scope.ownerUid + '/' + scope.sessionId + '/' + scope.narratorScriptId + '/';
}
type LedgerRow = {
  id: string;
  ownerUid?: unknown;
  sessionId?: unknown;
  narratorScriptId?: unknown;
  bucket?: unknown;
  objectPath?: unknown;
  state?: unknown;
  artifactGeneration?: unknown;
  uploadId?: unknown;
};

/** Pure classification. Never infer deletability from a path alone. */
export function classifyStorytimeInventory(
  scope: StorytimeInventoryScope, bucket: string, objects: {name: string; generation?: unknown; uploadId?: unknown}[], reservations: LedgerRow[],
  coverage: StorytimeInventoryCoverage = {},
): StorytimeInventoryEntry[] {
  const prefix = validateScope(scope);
  if (!bucket) throw new Error('storytime_inventory_bucket_missing');
  const records = new Map<string, LedgerRow[]>();
  for (const row of reservations) {
    if (row.ownerUid !== scope.ownerUid || row.sessionId !== scope.sessionId
      || row.narratorScriptId !== scope.narratorScriptId || row.bucket !== bucket
      || typeof row.objectPath !== 'string' || !row.objectPath.startsWith(prefix)
      || !AUDIO.test(row.objectPath.slice(prefix.length)) || !SAFE.test(row.id)) {
      throw new Error('storytime_inventory_ledger_unverified');
    }
    const arr = records.get(row.objectPath) ?? [];
    arr.push(row);
    records.set(row.objectPath, arr);
  }
  const entries: StorytimeInventoryEntry[] = [];
  const observed = new Set<string>();
  for (const object of objects) {
    // Reading an owner-scoped legacy object is not permission to delete it.
    // Preserve the evidence instead of aborting the entire inventory just
    // because its original name predates the UUID-based writer contract.
    if (typeof object.name !== 'string' || !object.name.startsWith(prefix)
      || observed.has(object.name)) throw new Error('storytime_inventory_object_boundary_unverified');
    observed.add(object.name);
    const canonicalName = AUDIO.test(object.name.slice(prefix.length));
    const matching = records.get(object.name) ?? [];
    const generation = typeof object.generation === 'string' && GEN.test(object.generation)
      && Number.isSafeInteger(Number(object.generation)) ? object.generation : null;
    const matched = matching.length === 1 ? matching[0] : null;
    const exact = matched && generation && matched.artifactGeneration === generation
      && typeof object.uploadId === 'string' && matched.uploadId === object.uploadId;
    const reason = !canonicalName ? 'legacy_or_unrecognized_object_name'
      : matching.length === 0 ? (coverage.ledgerComplete !== true ? 'ledger_scan_incomplete' : 'legacy_or_orphan_without_reservation')
      : matching.length !== 1 ? 'ambiguous_multiple_reservations'
      : !exact ? 'generation_or_upload_id_unverified'
      : matched.state !== 'STORED_PENDING_JOB' ? 'unresolved_write_state'
      : 'stored_requires_current_job_and_rights_validation';
    entries.push({
      objectPath: object.name, generation,
      reservationId: matched?.id ?? null,
      state: reason === 'stored_requires_current_job_and_rights_validation' ? 'REVIEW_REFERENCED' : 'UNRESOLVED',
      reason,
    });
  }
  for (const [objectPath, rows] of records) {
    if (!observed.has(objectPath)) {
      for (const row of rows) {
        entries.push({
          objectPath, generation: typeof row.artifactGeneration === 'string' ? row.artifactGeneration : null,
          reservationId: row.id, state: 'UNRESOLVED',
          reason: coverage.objectComplete !== true ? 'object_scan_incomplete' : 'journal_without_current_object',
        });
      }
    }
  }
  return entries.sort((a,b) => a.objectPath.localeCompare(b.objectPath));
}

/** Requires an explicit narrow scope; reads real GCS/Firestore via the caller's
 * already-authorized identity. Stop at the first page boundary: pagination
 * without a full scan must NEVER masquerade as completeness. */
export async function inspectStorytimeNarratorInventory(scope: StorytimeInventoryScope) {
  const prefix = validateScope(scope);
  const bucket = String(process.env.GCS_BUCKET_NAME || '').trim();
  if (!bucket) throw new Error('storytime_inventory_bucket_missing');
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const snapshot = await db.collection(STORYTIME_NARRATOR_WRITES)
    .where('ownerUid','==',scope.ownerUid).limit(MAX + 1).get();
  const relevant = snapshot.docs.filter(d=>{
    const r=d.data();
    return r.sessionId===scope.sessionId && r.narratorScriptId===scope.narratorScriptId;
  }).map(d=>({...d.data(),id:d.id}));
  // A broad owner query may truncate before the requested session appears.
  const ledgerTruncated = snapshot.docs.length > MAX;
  const [files, nextQuery, apiResponse] = await new Storage().bucket(bucket).getFiles({prefix,maxResults:MAX + 1,autoPaginate:false});
  // Storage may paginate before the requested maximum. A continuation token
  // means an object is unobserved even if fewer than MAX items were returned.
  const objectTruncated = files.length > MAX || Boolean(nextQuery) || Boolean(apiResponse?.nextPageToken);
  const objects = files.slice(0,MAX).map(file=>({
    name:file.name,
    generation:file.metadata?.generation,
    uploadId:file.metadata?.metadata?.uraiUploadId,
  }));
  const entries = classifyStorytimeInventory(scope,bucket,objects,relevant,{
    ledgerComplete: !ledgerTruncated, objectComplete: !objectTruncated,
  });
  return {
    scope, scannedObjects: objects.length, scannedReservations: relevant.length,
    complete: false as const,
    truncated: ledgerTruncated || objectTruncated,
    deletionAcknowledged: false as const,
    reason: ledgerTruncated || objectTruncated
      ? 'bounded_scan_incomplete'
      : 'read_only_inventory_not_deletion_receipt',
    entries,
  };
}
