import fs from "fs";

let failed = 0;

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function check(name, condition) {
  if (condition) console.log(`[PASS] ${name}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}

function includesStatus(source, status) {
  return source.includes(`'${status}'`) || source.includes(`\"${status}\"`) || source.includes(`\`${status}\``);
}

const jobStatuses = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "RETRY",
  "DEAD",
  "CANCELLED"
];

const queueStatuses = ["READY", "LEASED", "DONE", "DEAD"];

const sharedCompatibilityStatuses = [
  "PENDING",
  "LEASED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "DEAD",
  "CANCELLED"
];

const coreTypes = read("functions/src/core/types.ts");
for (const status of jobStatuses) {
  check(`core JobStatus includes ${status}`, includesStatus(coreTypes, status));
}
for (const status of queueStatuses) {
  check(`core QueueStatus includes ${status}`, includesStatus(coreTypes, status));
}

const sharedTypes = read("packages/shared-types/src/index.ts");
for (const status of sharedCompatibilityStatuses) {
  check(`shared compatibility types include ${status}`, includesStatus(sharedTypes, status));
}

const activationPlan = read("docs/ACTIVATION_READINESS_PLAN.md");
check("activation readiness plan exists", activationPlan.length > 0);
for (const status of jobStatuses) {
  check(`activation plan lists job status ${status}`, activationPlan.includes(`\`${status}\``));
}
for (const status of queueStatuses) {
  check(`activation plan lists queue status ${status}`, activationPlan.includes(`\`${status}\``));
}
for (const status of sharedCompatibilityStatuses) {
  check(`activation plan lists compatibility status ${status}`, activationPlan.includes(`\`${status}\``));
}
check("activation plan names activation verify script", activationPlan.includes("pnpm run activation:verify"));

const releaseEvidence = read("docs/RELEASE_EVIDENCE_TEMPLATE.md");
check("release evidence template exists", releaseEvidence.length > 0);
check("release evidence template records commit SHA", releaseEvidence.includes("Commit SHA"));
check("release evidence template records smoke job IDs", releaseEvidence.includes("Smoke job ID"));
check("release evidence template records rollback path", releaseEvidence.includes("Rollback command/path"));
for (const status of jobStatuses) {
  check(`release evidence template lists job status ${status}`, releaseEvidence.includes(`\`${status}\``));
}
for (const status of queueStatuses) {
  check(`release evidence template lists queue status ${status}`, releaseEvidence.includes(`\`${status}\``));
}
for (const status of sharedCompatibilityStatuses) {
  check(`release evidence template lists compatibility status ${status}`, releaseEvidence.includes(`\`${status}\``));
}

const postDeploy = read("docs/POST_DEPLOY_CHECKLIST.md");
check("post-deploy checklist expects SUCCESS job lifecycle", postDeploy.includes("RUNNING -> SUCCESS"));
check("post-deploy checklist expects DONE queue lifecycle", postDeploy.includes("READY -> LEASED -> DONE"));
check("post-deploy checklist does not expect COMPLETED status", !postDeploy.includes("status `COMPLETED`") && !postDeploy.includes("COMPLETED"));
check("post-deploy checklist expects queue DONE", postDeploy.includes("queue status `DONE`"));

const readme = read("README.md");
check("README defines runtime boundary", readme.includes("internal production job-execution fabric"));
check("README blocks accidental marketplace positioning", readme.includes("not the public jobs marketplace"));

const marketplaceBoundary = read("docs/MARKETPLACE_BOUNDARY.md");
check("marketplace boundary doc exists", marketplaceBoundary.length > 0);
check("marketplace boundary identifies runtime repo", marketplaceBoundary.includes("URAI Jobs Runtime"));
check("marketplace boundary blocks public marketplace launch", marketplaceBoundary.includes("It is not currently the public hiring marketplace"));
check("marketplace boundary requires future API contracts", marketplaceBoundary.includes("API contracts"));

const app = read("web/src/App.tsx");
check("runtime app does not route public candidate pages", !app.includes("/candidate"));
check("runtime app does not route employer pages", !app.includes("/employers"));
check("runtime app does not route pricing pages", !app.includes("/pricing"));

const productionDeployWorkflow = read(".github/workflows/urai-jobs-production-deploy.yml");
check("production deploy workflow exists", productionDeployWorkflow.length > 0);
check("production deploy requires launch unlock input", productionDeployWorkflow.includes("confirm_launch_unlock"));
check("production deploy requires exact LAUNCH-UNLOCK token", productionDeployWorkflow.includes("LAUNCH-UNLOCK"));
check("production deploy runs activation readiness guard", productionDeployWorkflow.includes("pnpm activation:verify"));
check("production deploy runs runtime verification", productionDeployWorkflow.includes("pnpm urai-jobs:verify"));
check("production deploy runs runtime smoke", productionDeployWorkflow.includes("pnpm urai-jobs:smoke"));
check("production deploy keeps callable smoke available", productionDeployWorkflow.includes("pnpm prod:smoke"));

if (failed > 0) {
  console.error(`[FAIL] ACTIVATION_READINESS_VERIFY ${failed} checks failed`);
  process.exit(1);
}

console.log("[PASS] ACTIVATION_READINESS_VERIFY");
