import * as admin from 'firebase-admin';
const db = admin.firestore();

export async function markSuppressed(email: string, reason: string){
  const id = email.toLowerCase();
  const ref = db.collection('marketing_recipients').doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({ email: id, suppressed: true, suppressedReason: reason, suppressedAt: now }, { merge: true });
}

export async function clearSuppressed(email: string){
  const id = email.toLowerCase();
  const ref = db.collection('marketing_recipients').doc(id);
  await ref.set({ suppressed: false, suppressedReason: admin.firestore.FieldValue.delete(), suppressedAt: admin.firestore.FieldValue.delete() }, { merge: true });
}

export async function filterSuppressed(emails: string[]): Promise<{ allowed: string[]; blocked: string[] }>{
  if (!emails.length) return { allowed: [], blocked: [] };
  const ids = emails.map(e=>e.toLowerCase());
  const snaps = await Promise.all(ids.map(id=> db.collection('marketing_recipients').doc(id).get()));
  const blocked = new Set<string>();
  snaps.forEach(s=>{ const d=s.data(); if (d?.suppressed) blocked.add((d.email||s.id).toLowerCase()); });
  const allowed = ids.filter(e=> !blocked.has(e));
  return { allowed, blocked: Array.from(blocked) };
}
