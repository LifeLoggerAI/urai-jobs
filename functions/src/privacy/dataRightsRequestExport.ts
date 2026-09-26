import { createHash } from 'node:crypto';
import { FieldPath, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { httpsError } from '../core/errors.js';

const PAGE_SIZE = 100;
const MAX_RECORDS = 10000;
const STATES = new Set(['PENDING', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED']);

function timestamp(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') {
    throw httpsError('failed-precondition', 'Data-rights receipt timestamp requires reconciliation.');
  }
  const date = value.toDate();
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw httpsError('failed-precondition', 'Data-rights receipt timestamp requires reconciliation.');
  }
  return date.toISOString();
}

async function* pages(query: Query): AsyncGenerator<QueryDocumentSnapshot> {
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    const page = await (cursor ? query.startAfter(cursor) : query).limit(PAGE_SIZE).get();
    for (const document of page.docs) yield document;
    if (page.size < PAGE_SIZE) return;
    cursor = page.docs[page.docs.length - 1];
  }
}

/**
 * Dormant request-control-plane contributor preparation, not a public function.
 * Does not execute an export request, deliver an artifact, or claim full Jobs coverage.
 * Scope follows Privacy's registered Jobs request and audit collections only.
 */
export async function prepareDataRightsRequestExport(db: Firestore, ownerUid: string) {
  if (!ownerUid || ownerUid.includes('/')) throw httpsError('invalid-argument', 'A canonical owner UID is required.');
  const requests = [];
  let recordCount = 0;
  let auditCount = 0;
  function countRecord() {
    if (++recordCount > MAX_RECORDS) throw httpsError('resource-exhausted', 'Request-control-plane export exceeds the bounded preparation limit.');
  }
  const query = db.collection('dataRightsRequests').where('ownerUid', '==', ownerUid).orderBy(FieldPath.documentId());
  for await (const document of pages(query)) {
    countRecord();
    const record = document.data();
    if (record.ownerUid !== ownerUid) throw httpsError('permission-denied', 'Data-rights contributor owner mismatch.');
    if (!['EXPORT', 'DELETE'].includes(record.requestType) || !STATES.has(record.status)) {
      throw httpsError('failed-precondition', 'Data-rights request schema requires reconciliation.');
    }
    const audit = [];
    for await (const eventDocument of pages(document.ref.collection('audit').orderBy(FieldPath.documentId()))) {
      countRecord();
      auditCount++;
      const event = eventDocument.data();
      if (event.event !== 'DATA_RIGHTS_REQUEST_SUBMITTED' || !STATES.has(event.status)) {
        throw httpsError('failed-precondition', 'Unregistered data-rights audit event requires reconciliation.');
      }
      audit.push({ eventId: eventDocument.id, event: event.event, status: event.status, createdAt: timestamp(event.createdAt) });
    }
    requests.push({
      requestId: document.id,
      requestType: record.requestType,
      requestedFormat: record.requestedFormat === 'json' || record.requestedFormat === 'csv' ? record.requestedFormat : null,
      status: record.status,
      createdAt: timestamp(record.createdAt),
      updatedAt: timestamp(record.updatedAt),
      audit,
    });
  }
  const payload = { schemaVersion: 'urai-jobs-request-record-export-v1', requests };
  return {
    scope: 'urai-jobs-request-control-plane',
    crossSystemComplete: false,
    exportDeliveryActive: false,
    requestCount: requests.length,
    auditCount,
    recordCount,
    sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    payload,
  };
}
