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
const careerJobTypes = [
  "career.profile.summarize",
  "career.fit.score",
  "career.document.parse",
  "career.document.tailor",
  "career.packet.generate",
  "career.followup.plan",
  "career.interview.prep",
  "career.offer.compare",
  "career.spatial.portal.generate",
  "career.passport.export"
];

const coreTypes = read("functions/src/core/types.ts");
jobStatuses.forEach((status) => ok(`core JobStatus includes ${status}`, has(coreTypes, status)));
queueStatuses.forEach((status) => ok(`core QueueStatus includes ${status}`, has(coreTypes, status)));
ok("core JobOrigin includes JOBS", has(coreTypes, "JOBS"));
ok("core TargetSystem includes JOBS", has(coreTypes, "JOBS"));
careerJobTypes.forEach((type) => ok(`core JobType includes ${type}`, has(coreTypes, type)));

const jobRegistry = read("functions/src/core/jobRegistry.ts");
ok("job registry includes career queue", jobRegistry.includes("careerQueue"));
ok("job registry includes career worker", jobRegistry.includes("career-worker"));
ok("job registry routes career jobs to JOBS target", jobRegistry.includes("targetSystem: 'JOBS'") || jobRegistry.includes('targetSystem: "JOBS"'));
careerJobTypes.forEach((type) => ok(`job registry includes ${type}`, has(jobRegistry, type)));

const executeJob = read("functions/src/jobs/executeJob.ts");
ok("dispatcher routes career jobs by prefix", executeJob.includes("jobType.startsWith('career.')") || executeJob.includes('jobType.startsWith("career.")'));
ok("dispatcher uses CAREER_WORKER_URL", executeJob.includes("CAREER_WORKER_URL"));
ok("dispatcher exposes career fallback artifact", executeJob.includes("careerUrl"));
ok("dispatcher keeps career worker route", executeJob.includes("/execute-job"));

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

const publicBoundary = read("docs/URAI_JOBS_PUBLIC_PRODUCT_BOUNDARY.md");
ok("public product boundary doc exists", publicBoundary.length > 0);
ok("public product boundary references Career Mirror", publicBoundary.includes("Career Mirror"));
ok("public product boundary names JOBS target", publicBoundary.includes("JOBS"));

const pdr = read("docs/product-decisions/PDR-001-autonomous-urai-jobs-v1-v5.md");
ok("autonomous product decision exists", pdr.length > 0);
ok("autonomous product decision keeps separated implementation track", pdr.includes("separated implementation track"));
ok("autonomous product decision defines V1 through V5", pdr.includes("V1") && pdr.includes("V5"));

const careerWorkerPkg = read("workers/career-worker/package.json");
const careerWorkerTsconfig = read("workers/career-worker/tsconfig.json");
const careerWorkerIndex = read("workers/career-worker/src/index.ts");
const careerWorkerHandlers = read("workers/career-worker/src/handlers/index.ts");
const careerWorkerDockerfile = read("workers/career-worker/Dockerfile");
const careerWorkerDeploy = read("scripts/deploy-career-worker.sh");
const careerWorkerReadiness = read("docs/CAREER_WORKER_READINESS.md");

ok("career worker package exists", careerWorkerPkg.length > 0);
ok("career worker tsconfig exists", careerWorkerTsconfig.length > 0);
ok("career worker server exists", careerWorkerIndex.includes("career-worker"));
ok("career worker exposes health route", careerWorkerIndex.includes("/healthz"));
ok("career worker exposes execute route", careerWorkerIndex.includes("/execute-job"));
ok("career worker handlers exist", careerWorkerHandlers.length > 0);
careerJobTypes.forEach((type) => ok(`career worker handles ${type}`, careerWorkerHandlers.includes(type)));
ok("career worker Dockerfile exists", careerWorkerDockerfile.includes("dist/index.js"));
ok("career worker deploy script exists", careerWorkerDeploy.includes("career-worker"));
ok("career worker readiness doc exists", careerWorkerReadiness.includes("Career Worker Readiness"));
ok("career worker readiness tracks CAREER_WORKER_URL", careerWorkerReadiness.includes("CAREER_WORKER_URL"));

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
