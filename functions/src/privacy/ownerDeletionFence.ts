import { getFirestore } from 'firebase-admin/firestore';
export function ownerDeletionFenceRefs(uid: string) {
 const db=getFirestore();
 return [db.collection('accountDeletionFences').doc(uid),db.collection('privacyDeletionTombstones').doc(uid)];
}
export function ownerDeletionFenced(snapshots: readonly { exists: boolean }[]): boolean {
 return snapshots.some(s=>s.exists);
}
