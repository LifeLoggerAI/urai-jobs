import crypto from "node:crypto";
import fs from "node:fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "urai-jobs";
const email = process.env.ADMIN_EMAIL || "adam@urailabs.com";

if (getApps().length === 0) initializeApp({ projectId });

const auth = getAuth();
const db = getFirestore();

let user;
let created = false;
let temporaryPassword = "";

try {
  user = await auth.getUserByEmail(email);
} catch {
  temporaryPassword = `URAI-${crypto.randomBytes(9).toString("base64url")}-Jobs!`;
  user = await auth.createUser({
    email,
    password: temporaryPassword,
    emailVerified: true,
    displayName: "URAI Jobs Admin"
  });
  created = true;
}

await auth.setCustomUserClaims(user.uid, {
  role: "admin",
  roles: ["admin", "operator"],
  uraiJobsAdmin: true
});

await db.collection("users").doc(user.uid).set(
  {
    uid: user.uid,
    email,
    role: "admin",
    roles: ["admin", "operator"],
    uraiJobsAdmin: true,
    updatedAt: FieldValue.serverTimestamp()
  },
  { merge: true }
);

const proof = {
  projectId,
  email,
  uid: user.uid,
  created,
  customClaims: {
    role: "admin",
    roles: ["admin", "operator"],
    uraiJobsAdmin: true
  },
  temporaryPassword: created ? temporaryPassword : null
};

fs.mkdirSync("_audit/live_admin_seed", { recursive: true });
fs.writeFileSync("_audit/live_admin_seed/latest-admin-seed.json", JSON.stringify(proof, null, 2));

console.log("[PASS] URAI_JOBS_ADMIN_SEEDED");
console.log(JSON.stringify(proof, null, 2));
