import fs from "node:fs";

const requiredFiles = [
  "Dockerfile.worker",
  "scripts/deploy-managed-worker.sh",
  "scripts/deploy-workers.sh",
  "docs/MANAGED_WORKER_RUNBOOK.md",
  "docs/POST_DEPLOY_CHECKLIST.md",
  "ops/worker.env.example",
  "ops/cloud-run-worker.yaml"
];

const requiredSnippets = new Map([
  ["Dockerfile.worker", ["FROM node:22-slim", "CMD [\"pnpm\", \"run\", \"worker:run\"]"]],
  ["scripts/deploy-managed-worker.sh", [
    "[BLOCKED] The generic managed worker emits synthetic success",
    "Use scripts/deploy-workers.sh",
    "exit 1"
  ]],
  ["scripts/deploy-workers.sh", [
    "gcloud builds submit",
    "gcloud run deploy",
    "WORKER_RUNTIME_SERVICE_ACCOUNT",
    "GITHUB_SHA",
    "DEPLOY_ROLLBACK_SHA",
    "Refusing to create paid cloud infrastructure"
  ]],
  ["ops/cloud-run-worker.yaml", ["kind: Service", "urai-jobs-worker", "containerConcurrency: 1", "run.googleapis.com/cpu-throttling"]],
  ["ops/worker.env.example", ["URAI_ENV=prod", "WORKER_SERVICE_ACCOUNT_EMAIL", "NARRATOR_WORKER_URL"]],
  ["docs/MANAGED_WORKER_RUNBOOK.md", ["PENDING -> RUNNING -> COMPLETED", "Cloud Run", "Rollback"]]
]);

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`Missing required managed-worker file: ${file}`);
}

for (const [file, snippets] of requiredSnippets.entries()) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (!text.includes(snippet)) failures.push(`Missing '${snippet}' in ${file}`);
  }
}

if (failures.length) {
  console.error("[FAIL] Managed worker precheck failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[PASS] Generic synthetic worker deployment is blocked.");
console.log("[PASS] Canonical Narrator and Asset worker deployment artifacts are present and fail closed on authority, rollback, infrastructure, and immutable-source requirements.");
