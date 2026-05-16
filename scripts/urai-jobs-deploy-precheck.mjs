import fs from "node:fs";

let failed = false;

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

function check(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function exists(path) {
  return fs.existsSync(path);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

check(exists("firebase.json"), "firebase.json exists");
check(exists(".firebaserc"), ".firebaserc exists");
check(exists("firestore.rules"), "firestore.rules exists");
check(exists("firestore.indexes.json"), "firestore.indexes.json exists");
check(exists("storage.rules"), "storage.rules exists");
check(exists("functions/src/index.ts"), "functions/src/index.ts exists");
check(exists("web/dist/index.html"), "web/dist/index.html exists");
check(exists("scripts/urai-jobs-e2e.mjs"), "scripts/urai-jobs-e2e.mjs exists");
check(exists("scripts/urai-jobs-verify.mjs"), "scripts/urai-jobs-verify.mjs exists");
check(exists("scripts/urai-jobs-smoke.mjs"), "scripts/urai-jobs-smoke.mjs exists");
check(exists("docs/URAI_JOBS_DEPLOYMENT_READINESS.md"), "docs/URAI_JOBS_DEPLOYMENT_READINESS.md exists");

const firebaseJson = readJson("firebase.json");

check(Boolean(firebaseJson.hosting), "firebase hosting configured");
check(Boolean(firebaseJson.functions), "firebase functions configured");
check(firebaseJson.firestore?.rules === "firestore.rules", "firebase firestore rules configured");
check(firebaseJson.firestore?.indexes === "firestore.indexes.json", "firebase firestore indexes configured");
check(firebaseJson.storage?.rules === "storage.rules", "firebase storage rules configured");
check(Boolean(firebaseJson.emulators), "firebase emulators configured");
check(Boolean(firebaseJson.emulators?.storage), "firebase storage emulator configured");

const storageRules = fs.readFileSync("storage.rules", "utf8");

check(
  !storageRules.includes("allow read, write: if request.auth != null"),
  "storage.rules does not allow broad authenticated read/write"
);

check(
  storageRules.includes("match /{allPaths=**}") &&
    storageRules.includes("allow read, write: if false"),
  "storage.rules has default deny"
);

const packageJson = readJson("package.json");
const scripts = packageJson.scripts || {};

check(Boolean(scripts.build), "package script build exists");
check(Boolean(scripts.typecheck), "package script typecheck exists");
check(Boolean(scripts["urai-jobs:verify"]), "package script urai-jobs:verify exists");
check(Boolean(scripts["urai-jobs:smoke"]), "package script urai-jobs:smoke exists");
check(Boolean(scripts["urai-jobs:e2e"]), "package script urai-jobs:e2e exists");
check(Boolean(scripts["urai-jobs:deploy-precheck"]), "package script urai-jobs:deploy-precheck exists");

check(!failed, "URAI_JOBS_DEPLOY_PRECHECK");

if (failed) {
  process.exit(1);
}
