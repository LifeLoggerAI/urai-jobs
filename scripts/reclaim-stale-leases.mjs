import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const LEASE_MS = Number(process.env.URAI_LEASE_MS || 60000);

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') {
    return (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1e6);
  }
  return 0;
}

const snap = await db.collection('jobQueue')
  .where('status', '==', 'RUNNING')
  .limit(100)
  .get();

let count = 0;
for (const doc of snap.docs) {
  const data = doc.data() || {};
  const leasedAtMs = toMillis(data.leasedAt);
  if (!leasedAtMs) continue;

  const ageMs = Date.now() - leasedAtMs;
  if (ageMs < LEASE_MS) continue;

  await db.collection('jobQueue').doc(doc.id).update({
    status: 'PENDING',
    availableAt: admin.firestore.FieldValue.serverTimestamp(),
    leaseToken: admin.firestore.FieldValue.delete(),
    workerName: admin.firestore.FieldValue.delete(),
    leasedAt: admin.firestore.FieldValue.delete()
  });

  await db.collection('jobs').doc(doc.id).set({
    status: 'PENDING',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  count += 1;
  console.log(`[PASS] reclaimed ${doc.id}`);
}

console.log(`[DONE] reclaimed=${count}`);
