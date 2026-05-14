import fs from "fs";

let failed = 0;

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
const ok = (name, condition) => {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
};
const has = (source, value) => source.includes(`'${value}'`) || source.includes(`\"${value}\"`) || source.includes(`\`${value}\``);

const jobStatuses = ["CREATED", "QUEUED", "RUNNING", "SUCCESS", "FAILED", "RETRY", "DEAD", "CANCELLED"];
const queueStatuses = ["READY", "LEASED", "DONE", "DEAD"];
const compatibilityStatuses = ["PENDING", "LEASED", "RUNNING", "SUCCESS", "FAILED", "DEAD", "CANCELLED"];

const coreTypes = read("functions/src/core/types.ts");
jobStatuses.forEach((status) => ok(`core JobStatus includes ${status}`, has(coreTypes, status)));
queueStatuses.forEach((status) => ok(`core QueueStatus includes ${status}`, has(coreTypes, status)));

const sharedTypes = read("packages/shared-types/src/index.ts");
compatibilityStatuses.forEach((status) => ok(`shared compatibility types include ${status}`, has(sharedTypes, status)));

const activationPlan = read("docs/ACTIVATION_READINESS_PLAN.md");
ok("activation readiness plan exists", activationPlan.length > 0);
jobStatuses.forEach((status) => ok(`activation plan lists job status ${status}`, activationPlan.includes(`\`${status}\``)));
queueStatuses.forEach((status) => ok(`activation plan lists queue status ${status}`, activationPlan.includes(`\`${status}\``)));
compatibilityStatuses.forEach((status) => ok(`activation plan lists compatibility status ${status}`, activationPlan.includes(`\`${status}\``)));
ok("activation plan names activation verify script", activationPlan.includes("pnpm run activation:verify"));

const releaseEvidence = read("docs/RELEASE_EVIDENCE_TEMPLATE.md");
ok("release evidence template exists", releaseEvidence.length > 0);
ok("release evidence template records commit SHA", releaseEvidence.includes("Commit SHA"));
ok("release evidence template records smoke job IDs", releaseEvidence.includes("Smoke job ID"));
ok("release evidence template records rollback path", releaseEvidence.includes("Rollback command/path"));
jobStatuses.forEach((status) => ok(`release evidence template lists job status ${status}`, releaseEvidence.includes(`\`${status}\``)));
queueStatuses.forEach((status) => ok(`release evidence template lists queue status ${status}`, releaseEvidence.includes(`\`${status}\``)));
compatibilityStatuses.forEach((status) => ok(`release evidence template lists compatibility status ${status}`, releaseEvidence.includes(`\`${status}\``)));

const postDeploy = read("docs/POST_DEPLOY_CHECKLIST.md");
ok("post-deploy checklist expects SUCCESS job lifecycle", postDeploy.includes("RUNNING -> SUCCESS"));
ok("post-deploy checklist expects DONE queue lifecycle", postDeploy.includes("READY -> LEASED -> DONE"));
ok("post-deploy checklist removes completed lifecycle", !postDeploy.includes("COMPLETED"));
ok("post-deploy checklist expects queue DONE", postDeploy.includes("queue status `DONE`"));

const readme = read("README.md");
ok("README defines runtime boundary", readme.includes("internal production job-execution fabric"));
ok("README blocks marketplace positioning", readme.includes("not the public jobs marketplace"));

const boundary = read("docs/MARKETPLACE_BOUNDARY.md");
ok("marketplace boundary doc exists", boundary.length > 0);
ok("marketplace boundary identifies runtime repo", boundary.includes("URAI Jobs Runtime"));
ok("marketplace boundary requires future API contracts", boundary.includes("API contracts"));

const app = read("web/src/App.tsx");
ok("runtime app does not route public candidate pages", !app.includes("/candidate"));
ok("runtime app does not route employer pages", !app.includes("/employers"));
ok("runtime app does not route pricing pages", !app.includes("/pricing"));

const deployWorkflow = read(".github/workflows/urai-jobs-production-deploy.yml");
ok("production deploy workflow exists", deployWorkflow.length > 0);
ok("production deploy requires launch unlock input", deployWorkflow.includes("confirm_launch_unlock"));
ok("production deploy requires exact LAUNCH-UNLOCK token", deployWorkflow.includes("LAUNCH-UNLOCK"));
ok("production deploy runs activation readiness guard", deployWorkflow.includes("pnpm activation:verify"));
ok("production deploy runs runtime verification", deployWorkflow.includes("pnpm urai-jobs:verify"));
ok("production deploy runs runtime smoke", deployWorkflow.includes("pnpm urai-jobs:smoke"));
ok("production deploy keeps callable smoke available", deployWorkflow.includes("pnpm prod:smoke"));

if (failed) {
  throw new Error(`ACTIVATION_READINESS_VERIFY ${failed} checks failed`);
}

console.log("[PASS] ACTIVATION_READINESS_VERIFY");
