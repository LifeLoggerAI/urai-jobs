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
ok("runtime app routes Career Mirror V1", app.includes("/career-mirror") && app.includes("CareerMirrorPage"));
ok("runtime app routes Career Marketplace V2", app.includes("/career-marketplace") && app.includes("CareerMarketplacePage"));
ok("runtime app routes Career Automation V3", app.includes("/career-automation") && app.includes("CareerAutomationPage"));
ok("runtime app routes Career Decision V4", app.includes("/career-decision") && app.includes("CareerDecisionPage"));
ok("runtime app routes Career Passport V5", app.includes("/career-passport") && app.includes("CareerPassportPage"));
ok("runtime app routes Career Version Console", app.includes("/career-versions") && app.includes("CareerVersionConsolePage"));
ok("runtime app does not route public candidate pages", !app.includes("/candidate"));
ok("runtime app does not route employer pages", !app.includes("/employers"));
ok("runtime app does not route pricing pages", !app.includes("/pricing"));

const careerMirrorModel = read("web/src/lib/careerMirror.ts");
const careerMirrorStore = read("web/src/lib/careerMirrorStore.ts");
const careerMirrorPage = read("web/src/pages/CareerMirrorPage.tsx");
ok("Career Mirror model exists", careerMirrorModel.includes("WorkPreferenceProfile") && careerMirrorModel.includes("CareerOpportunity"));
ok("Career Mirror persistence store exists", careerMirrorStore.includes("CareerMirrorState"));
ok("Career Mirror persistence uses local storage", careerMirrorStore.includes("localStorage"));
ok("Career Mirror persistence supports load", careerMirrorStore.includes("loadCareerMirrorState"));
ok("Career Mirror persistence supports save", careerMirrorStore.includes("saveCareerMirrorState"));
ok("Career Mirror persistence supports reset", careerMirrorStore.includes("resetCareerMirrorState"));
ok("Career Mirror page exists", careerMirrorPage.includes("CareerMirrorPage"));
ok("Career Mirror page loads persisted state", careerMirrorPage.includes("loadCareerMirrorState"));
ok("Career Mirror page saves persisted state", careerMirrorPage.includes("saveCareerMirrorState"));
ok("Career Mirror page resets persisted state", careerMirrorPage.includes("resetCareerMirrorState"));
ok("Career Mirror page edits profile", careerMirrorPage.includes("updateProfile"));
ok("Career Mirror page calls createJob", careerMirrorPage.includes("createJob"));
ok("Career Mirror can create profile summary job", careerMirrorPage.includes("career.profile.summarize"));
ok("Career Mirror can create fit score job", careerMirrorPage.includes("career.fit.score"));
ok("Career Mirror keeps save control", careerMirrorPage.includes("Save"));
ok("Career Mirror keeps hide control", careerMirrorPage.includes("Hide"));
ok("Career Mirror has no auto apply wording", !careerMirrorPage.toLowerCase().includes("auto-apply"));

const careerMarketplaceModel = read("web/src/lib/careerMarketplace.ts");
const careerMarketplacePage = read("web/src/pages/CareerMarketplacePage.tsx");
ok("Career Marketplace V2 model exists", careerMarketplaceModel.includes("CandidateProfile") && careerMarketplaceModel.includes("EmployerProfile"));
ok("Career Marketplace V2 model includes opportunities", careerMarketplaceModel.includes("MarketplaceOpportunity"));
ok("Career Marketplace V2 model includes documents", careerMarketplaceModel.includes("CareerDocument"));
ok("Career Marketplace V2 model includes review packet", careerMarketplaceModel.includes("ReviewPacket"));
ok("Career Marketplace V2 page exists", careerMarketplacePage.includes("CareerMarketplacePage"));
ok("Career Marketplace V2 calls createJob", careerMarketplacePage.includes("createJob"));
ok("Career Marketplace V2 can parse documents", careerMarketplacePage.includes("career.document.parse"));
ok("Career Marketplace V2 can tailor documents", careerMarketplacePage.includes("career.document.tailor"));
ok("Career Marketplace V2 can generate packets", careerMarketplacePage.includes("career.packet.generate"));
ok("Career Marketplace V2 links Career Mirror", careerMarketplacePage.includes("/career-mirror"));
ok("Career Marketplace V2 links Version Console", careerMarketplacePage.includes("/career-versions"));

const careerAutomationModel = read("web/src/lib/careerAutomation.ts");
const careerAutomationPage = read("web/src/pages/CareerAutomationPage.tsx");
ok("Career Automation V3 model exists", careerAutomationModel.includes("CareerAutomationRule") && careerAutomationModel.includes("CareerExecutionLedgerEntry"));
ok("Career Automation V3 model includes global pause", careerAutomationModel.includes("globalPause"));
ok("Career Automation V3 model includes review required", careerAutomationModel.includes("reviewRequired"));
ok("Career Automation V3 page exists", careerAutomationPage.includes("CareerAutomationPage"));
ok("Career Automation V3 calls createJob", careerAutomationPage.includes("createJob"));
ok("Career Automation V3 can create follow-up plan", careerAutomationPage.includes("career.followup.plan"));
ok("Career Automation V3 has global pause control", careerAutomationPage.includes("toggleGlobalPause"));
ok("Career Automation V3 has per-rule pause control", careerAutomationPage.includes("toggleRule"));
ok("Career Automation V3 appends ledger", careerAutomationPage.includes("appendLedger"));
ok("Career Automation V3 links Marketplace", careerAutomationPage.includes("/career-marketplace"));
ok("Career Automation V3 links Version Console", careerAutomationPage.includes("/career-versions"));

const careerPassportModel = read("web/src/lib/careerPassport.ts");
const careerPassportPage = read("web/src/pages/CareerPassportPage.tsx");
ok("Career Passport V5 model exists", careerPassportModel.includes("CareerPassportState") && careerPassportModel.includes("PassportProfilePacket"));
ok("Career Passport V5 model includes path graph", careerPassportModel.includes("EconomicPathNode"));
ok("Career Passport V5 model includes skill gaps", careerPassportModel.includes("SkillGap"));
ok("Career Passport V5 model builds export payload", careerPassportModel.includes("buildPassportExportPayload"));
ok("Career Passport V5 page exists", careerPassportPage.includes("CareerPassportPage"));
ok("Career Passport V5 calls createJob", careerPassportPage.includes("createJob"));
ok("Career Passport V5 can export passport", careerPassportPage.includes("career.passport.export"));
ok("Career Passport V5 links Decision", careerPassportPage.includes("/career-decision"));
ok("Career Passport V5 links Version Console", careerPassportPage.includes("/career-versions"));

const createJobPage = read("web/src/pages/CreateJobPage.tsx");
careerJobTypes.forEach((type) => ok(`CreateJobPage includes preset for ${type}`, createJobPage.includes(type)));
ok("CreateJobPage includes career profile smoke payload", createJobPage.includes("careerProfile"));
ok("CreateJobPage includes career opportunity smoke payload", createJobPage.includes("careerOpportunity"));

const careerPlan = read("web/src/lib/careerLaunchPlan.ts");
const careerVersionConsole = read("web/src/pages/CareerVersionConsolePage.tsx");
ok("Career version plan model exists", careerPlan.includes("careerLaunchPlan"));
["V1", "V2", "V3", "V4", "V5"].forEach((version) => ok(`Career version plan includes ${version}`, careerPlan.includes(version)));
ok("Career Version Console page exists", careerVersionConsole.includes("CareerVersionConsolePage"));
ok("Career Version Console renders runtime jobs", careerVersionConsole.includes("runtimeJobs"));
ok("Career Version Console links Career Mirror", careerVersionConsole.includes("/career-mirror"));
ok("Career Version Console links Create page", careerVersionConsole.includes("/create"));

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
