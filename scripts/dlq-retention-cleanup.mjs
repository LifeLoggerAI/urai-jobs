#!/usr/bin/env node

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const retentionDays = Number(process.env.DLQ_RETENTION_DAYS || 30);
const apply = String(process.env.DLQ_CLEANUP_APPLY || '').toLowerCase() === 'true';

if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
  console.error('[FAIL] DLQ_RETENTION_DAYS must be between 1 and 3650');
  process.exit(1);
}

if (apply) {
  console.error('[FAIL] Destructive DLQ cleanup is governance-hard-off until retention/deletion policy and restore evidence are certified.');
  process.exit(2);
}

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const cutoff = Timestamp.fromMillis(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

console.log(JSON.stringify({
  severity: 'INFO',
  event: 'dlq.retention.scan.started',
  mode: 'dry-run',
  retentionDays,
  cutoff: cutoff.toDate().toISOString(),
  timestamp: new Date().toISOString(),
}));

const snapshot = await db.collection('jobs').where('status', '==', 'DEAD').get();
const candidates = [];

for (const doc of snapshot.docs) {
  const data = doc.data() || {};
  const completedAt = data.completedAt?.toMillis?.()
    ?? data.timestamps?.updatedAt?.toMillis?.()
    ?? data.updatedAt?.toMillis?.()
    ?? null;
  if (completedAt !== null && completedAt < cutoff.toMillis()) {
    candidates.push({
      jobId: doc.id,
      ownerUid: data.ownerUid || null,
      tenantId: data.tenantId || null,
      completedAt: new Date(completedAt).toISOString(),
    });
  }
}

console.log(JSON.stringify({
  severity: 'INFO',
  event: 'dlq.retention.scan.completed',
  mode: 'dry-run',
  retentionDays,
  totalDeadJobs: snapshot.size,
  expiredCandidateCount: candidates.length,
  candidates,
  destructiveCleanupAuthorized: false,
  timestamp: new Date().toISOString(),
}));

console.log('[PASS] DLQ retention scan completed without mutation');
