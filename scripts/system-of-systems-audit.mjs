import fs from "fs";
import { spawnSync } from "child_process";

const failures = [];
const warnings = [];

function exists(path) {
  const ok = fs.existsSync(path);
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${path} exists`);
  if (!ok) failures.push(`Missing required file: ${path}`);
  return ok;
}

function read(path) {
  if (!exists(path)) return "";
  return fs.readFileSync(path, "utf8");
}

function requireIncludes(path, text, needle, label = needle) {
  const ok = text.includes(needle);
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${path} includes ${label}`);
  if (!ok) failures.push(`${path} missing ${label}`);
}

function warnIncludes(path, text, needle, label = needle) {
  const ok = text.includes(needle);
  console.log(`${ok ? "[PASS]" : "[WARN]"} ${path} includes ${label}`);
  if (!ok) warnings.push(`${path} should include ${label}`);
}

function run(name, command, args, required = true) {
  const result = spawnSync(command, args, { stdio: "pipe", encoding: "utf8" });
  const ok = result.status === 0;
  console.log(`${ok ? "[PASS]" : required ? "[FAIL]" : "[WARN]"} ${name}`);
  if (!ok) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (output) console.log(output.split("\n").slice(-12).join("\n"));
    (required ? failures : warnings).push(`${name} failed`);
  }
}

const packageJson = read("package.json");
const firebaseJson = read("firebase.json");
const firebaserc = read(".firebaserc");
const firestoreRules = read("firestore.rules");
const storageRules = read("storage.rules");
const prodEnvExample = read("ops/production.env.example");
const readme = read("README.md");
const deployReadiness = read("docs/URAI_JOBS_DEPLOYMENT_READINESS.md");

for (const path of [
  "functions/src/index.ts",
  "packages/shared-types/package.json",
  "web/package.json",
  "workers/package.json",
  "scripts/prod-env-precheck.mjs",
  "scripts/managed-worker-precheck.mjs",
  "scripts/verify-custom-domains.mjs",
  "scripts/prod-smoke.mjs",
  "scripts/verify-worker-health.mjs",
  "scripts/urai-jobs-deploy-precheck.mjs",
  "scripts/activation-readiness-verify.mjs",
  "docs/ACTIVATION_READINESS_PLAN.md",
  "docs/MARKETPLACE_BOUNDARY.md",
  "docs/POST_DEPLOY_CHECKLIST.md",
  "docs/RELEASE_EVIDENCE_TEMPLATE.md"
]) {
  exists(path);
}

for (const script of [
  "urai-jobs:verify",
  "activation:verify",
  "urai-jobs:smoke",
  "urai-jobs:e2e",
  "build",
  "typecheck",
  "test",
  "prod:precheck",
  "prod:smoke",
  "prod:verify-workers",
  "worker:precheck",
  "domains:verify",
  "urai-jobs:deploy-precheck",
  "audit:systems"
]) {
  requireIncludes("package.json", packageJson, `\"${script}\"`, `script ${script}`);
}

for (const marker of ["hosting", "functions", "firestore", "storage", "emulators"]) {
  requireIncludes("firebase.json", firebaseJson, marker);
}

for (const marker of ["dev", "staging", "prod"]) {
  warnIncludes(".firebaserc", firebaserc, marker, `project alias ${marker}`);
}

for (const marker of ["request.auth", "allow", "jobs", "queue"]) {
  warnIncludes("firestore.rules", firestoreRules, marker);
}

for (const marker of ["allow read, write: if false", "request.auth", "artifacts"]) {
  warnIncludes("storage.rules", storageRules, marker);
}

for (const envKey of [
  "URAI_ENV=prod",
  "FIREBASE_PROJECT_ID=",
  "GCLOUD_PROJECT=",
  "GOOGLE_CLOUD_PROJECT=",
  "GCP_REGION=us-central1",
  "API_ALLOWED_ORIGINS=",
  "https://uraijobs.com",
  "https://www.uraijobs.com",
  "https://urai-jobs-563121397472.web.app",
  "https://urai-jobs.web.app",
  "WEBHOOK_SIGNING_SECRET=",
  "GCS_BUCKET_NAME=",
  "NARRATOR_WORKER_URL=",
  "ASSET_WORKER_URL=",
  "SPATIAL_WORKER_URL=",
  "STUDIO_WORKER_URL="
]) {
  requireIncludes("ops/production.env.example", prodEnvExample, envKey, `env key/origin ${envKey.split("=")[0]}`);
}

for (const marker of ["internal production job-execution fabric", "Do not use this repo as the public candidate/employer marketplace", "Runtime boundaries"]) {
  requireIncludes("README.md", readme, marker);
}

for (const marker of ["URAI_JOBS_DEPLOY_PRECHECK", "Production", "Firebase", "Cloud Run"]) {
  warnIncludes("docs/URAI_JOBS_DEPLOYMENT_READINESS.md", deployReadiness, marker);
}

run("runtime invariant verification", "npm", ["run", "urai-jobs:verify"]);
run("runtime smoke verification", "npm", ["run", "urai-jobs:smoke"]);
run("managed worker artifact precheck", "npm", ["run", "worker:precheck"]);
run("firebase/runtime deploy precheck", "npm", ["run", "urai-jobs:deploy-precheck"]);
run("production env precheck", "npm", ["run", "prod:precheck"], false);
run("custom domain verification", "npm", ["run", "domains:verify"], false);

if (warnings.length) {
  console.log("\n[WARN] Non-blocking readiness gaps:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length) {
  console.error("\n[FAIL] System-of-systems audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n[PASS] URAI Jobs Runtime system-of-systems repo audit passed.");
console.log("Production remains pending until production env, custom domains, deployed worker URLs, live smoke, and evidence are real.");
