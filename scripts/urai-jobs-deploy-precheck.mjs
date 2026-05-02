import fs from "fs";

let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function exists(path) {
  return fs.existsSync(path);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

check("firebase.json exists", exists("firebase.json"));
check(".firebaserc exists", exists(".firebaserc"));
check("firestore.rules exists", exists("firestore.rules"));
check("firestore.indexes.json exists", exists("firestore.indexes.json"));
check("functions/src/index.ts exists", exists("functions/src/index.ts"));
check("web/dist/index.html exists", exists("web/dist/index.html"));
check("scripts/urai-jobs-e2e.mjs exists", exists("scripts/urai-jobs-e2e.mjs"));
check("scripts/urai-jobs-verify.mjs exists", exists("scripts/urai-jobs-verify.mjs"));
check("scripts/urai-jobs-smoke.mjs exists", exists("scripts/urai-jobs-smoke.mjs"));
check("docs/URAI_JOBS_DEPLOYMENT_READINESS.md exists", exists("docs/URAI_JOBS_DEPLOYMENT_READINESS.md"));

if (exists("firebase.json")) {
  const firebase = readJson("firebase.json");

  const hasHosting =
    Boolean(firebase.hosting) &&
    (
      Boolean(firebase.hosting.public) ||
      Boolean(firebase.hosting.site) ||
      Boolean(firebase.hosting.target) ||
      Array.isArray(firebase.hosting)
    );

  const hasFunctions =
    Boolean(firebase.functions) &&
    (
      Boolean(firebase.functions.source) ||
      Array.isArray(firebase.functions)
    );

  const firestoreConfigs = Array.isArray(firebase.firestore)
    ? firebase.firestore
    : firebase.firestore
      ? [firebase.firestore]
      : [];

  const hasFirestoreRules =
    firestoreConfigs.some((cfg) => Boolean(cfg?.rules)) ||
    exists("firestore.rules");

  const hasFirestoreIndexes =
    firestoreConfigs.some((cfg) => Boolean(cfg?.indexes)) ||
    exists("firestore.indexes.json");

  check("firebase hosting configured", hasHosting);
  check("firebase functions configured", hasFunctions);
  check("firebase firestore rules configured", hasFirestoreRules);
  check("firebase firestore indexes configured", hasFirestoreIndexes);
  check("firebase emulators configured", Boolean(firebase.emulators));
}

if (exists("package.json")) {
  const pkg = readJson("package.json");
  const scripts = pkg.scripts || {};
  for (const name of ["build", "typecheck", "urai-jobs:verify", "urai-jobs:smoke", "urai-jobs:e2e", "urai-jobs:deploy-precheck"]) {
    check(`package script ${name} exists`, Boolean(scripts[name]));
  }
}

if (failed > 0) {
  console.error(`[FAIL] URAI_JOBS_DEPLOY_PRECHECK ${failed} checks failed`);
  process.exit(1);
}

console.log("[PASS] URAI_JOBS_DEPLOY_PRECHECK");
