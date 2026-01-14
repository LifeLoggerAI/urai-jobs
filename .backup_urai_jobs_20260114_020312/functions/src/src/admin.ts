import admin from "firebase-admin";

let _inited = false;

export function initAdmin() {
  if (_inited) return;
  admin.initializeApp();
  _inited = true;
}

export function db() {
  initAdmin();
  return admin.firestore();
}

export function tsFromMs(ms: number) {
  initAdmin();
  return admin.firestore.Timestamp.fromMillis(ms);
}

export function serverTimestamp() {
  initAdmin();
  return admin.firestore.FieldValue.serverTimestamp();
}

export { admin };
