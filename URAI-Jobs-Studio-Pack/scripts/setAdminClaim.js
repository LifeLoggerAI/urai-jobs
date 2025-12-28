// Run with: node scripts/setAdminClaim.js
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const uid = 'REPLACE_WITH_ADMIN_UID';
const main = async () => {
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log('ok');
};
main();
