import fs from "node:fs";

let failed = 0;
function ok(label, condition) {
  if (condition) console.log(`[PASS] ${label}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
ok("workspace verification command exists", typeof scripts["check:workspace"] === "string");
ok("runtime verification command exists", typeof scripts["urai-jobs:verify"] === "string");
ok("runtime smoke command exists", typeof scripts["urai-jobs:smoke"] === "string");
ok("deploy precheck command exists", typeof scripts["urai-jobs:deploy-precheck"] === "string");
ok("activation verification command exists", typeof scripts["activation:verify"] === "string");

const launchLock = JSON.parse(read("verification/launch-lock.json"));
ok("launch lock remains fail closed", launchLock.status === "locked_until_verified");

const signoffs = read("verification/signoffs.md");
ok("signoffs contain no pending status", !signoffs.includes("Status: PENDING"));
ok("signoffs contain approved status", signoffs.includes("Status: APPROVED"));

const app = read("web/src/App.tsx");
const landing = read("web/src/pages/LandingPage.tsx");
const legalPages = read("web/src/pages/LegalPages.tsx");
for (const route of ["/privacy", "/terms", "/trust"]) {
  ok(`App exposes ${route}`, app.includes(route));
  ok(`landing links ${route}`, landing.includes(`href=\"${route}\"`));
}
ok("privacy page exists", legalPages.includes("PrivacyPage"));
ok("terms page exists", legalPages.includes("TermsPage"));
ok("trust page exists", legalPages.includes("TrustSafetyPage"));

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
  "career.passport.export",
];

const createJobSource = read("functions/src/jobs/createJob.ts");
ok(
  "createJob accepts the career namespace",
  createJobSource.includes("startsWith('career.')") || createJobSource.includes('startsWith("career.")') || createJobSource.includes("/^career\\./"),
);

const worker = read("workers/career-worker/src/index.ts");
ok("career worker exists", worker.includes("career-worker"));
ok("career worker exposes protected authz", worker.includes("app.get('/authz', requireWorkerAuth"));
ok("career worker accepts execute-job", worker.includes("app.post('/execute-job', requireWorkerAuth"));
ok("career worker validates Authorization bearer token", worker.includes("req.get('Authorization')") && worker.includes("Bearer ${expectedToken}"));
ok("career worker uses timing-safe token comparison", worker.includes("crypto.timingSafeEqual"));
ok("career worker fails closed outside local emulation", worker.includes("worker auth is not configured") && worker.includes("CAREER_WORKER_NOT_IMPLEMENTED"));

const careerMirrorModel = read("web/src/lib/careerMirror.ts");
const careerMirrorPage = read("web/src/pages/CareerMirrorPage.tsx");
ok("Career Mirror V1 model exists", careerMirrorModel.includes("WorkPreferenceProfile") && careerMirrorModel.includes("CareerOpportunity"));
ok("Career Mirror V1 explains fit", careerMirrorModel.includes("explainFit"));
ok("Career Mirror V1 page exists", careerMirrorPage.includes("CareerMirrorPage"));
ok("Career Mirror V1 calls createJob", careerMirrorPage.includes("createJob"));
ok("Career Mirror V1 summarizes profile", careerMirrorPage.includes("career.profile.summarize"));
ok("Career Mirror V1 scores fit", careerMirrorPage.includes("career.fit.score"));
ok("Career Mirror V1 preserves advisory boundary", careerMirrorPage.includes("External actions stay out of scope"));

const careerMarketplaceModel = read("web/src/lib/careerMarketplace.ts");
const careerMarketplacePage = read("web/src/pages/CareerMarketplacePage.tsx");
ok("Career Marketplace V2 model exists", careerMarketplaceModel.includes("CandidateProfile") && careerMarketplaceModel.includes("EmployerProfile") && careerMarketplaceModel.includes("ReviewPacket"));
ok("Career Marketplace V2 page exists", careerMarketplacePage.includes("CareerMarketplacePage"));
ok("Career Marketplace V2 calls createJob", careerMarketplacePage.includes("createJob"));
ok("Career Marketplace V2 parses documents", careerMarketplacePage.includes("career.document.parse"));
ok("Career Marketplace V2 tailors documents", careerMarketplacePage.includes("career.document.tailor"));
ok("Career Marketplace V2 generates review packets", careerMarketplacePage.includes("career.packet.generate"));
ok("Career Marketplace V2 links Career Mirror", careerMarketplacePage.includes("/career-mirror"));
ok("Career Marketplace V2 links Version Console", careerMarketplacePage.includes("/career-versions"));

const careerAutomationModel = read("web/src/lib/careerAutomation.ts");
const careerAutomationPage = read("web/src/pages/CareerAutomationPage.tsx");
ok("Career Automation V3 model exists", careerAutomationModel.includes("CareerAutomationRule") && careerAutomationModel.includes("CareerExecutionLedgerEntry"));
ok("Career Automation V3 model includes global pause", careerAutomationModel.includes("globalPause"));
ok("Career Automation V3 model includes review required", careerAutomationModel.includes("reviewRequired"));
ok("Career Automation V3 page exists", careerAutomationPage.includes("CareerAutomationPage"));
ok("Career Automation V3 calls createJob", careerAutomationPage.includes("createJob"));
ok("Career Automation V3 creates follow-up plans", careerAutomationPage.includes("career.followup.plan"));
ok("Career Automation V3 has global pause control", careerAutomationPage.includes("toggleGlobalPause"));
ok("Career Automation V3 has per-rule pause control", careerAutomationPage.includes("toggleRule"));
ok("Career Automation V3 appends ledger", careerAutomationPage.includes("appendLedger"));
ok("Career Automation V3 links Marketplace", careerAutomationPage.includes("/career-marketplace"));
ok("Career Automation V3 links Version Console", careerAutomationPage.includes("/career-versions"));

const careerDecisionModel = read("web/src/lib/careerDecision.ts");
const careerDecisionPage = read("web/src/pages/CareerDecisionPage.tsx");
ok("Career Decision V4 model exists", careerDecisionModel.includes("InterviewPrepRoom") && careerDecisionModel.includes("CareerOffer") && careerDecisionModel.includes("SpatialCareerPortal"));
ok("Career Decision V4 compares offers", careerDecisionModel.includes("compareOffers"));
ok("Career Decision V4 page exists", careerDecisionPage.includes("CareerDecisionPage"));
ok("Career Decision V4 calls createJob", careerDecisionPage.includes("createJob"));
ok("Career Decision V4 prepares interviews", careerDecisionPage.includes("career.interview.prep"));
ok("Career Decision V4 compares offers through runtime", careerDecisionPage.includes("career.offer.compare"));
ok("Career Decision V4 generates spatial portals", careerDecisionPage.includes("career.spatial.portal.generate"));
ok("Career Decision V4 links Automation", careerDecisionPage.includes("/career-automation"));
ok("Career Decision V4 links Version Console", careerDecisionPage.includes("/career-versions"));

const careerPassportModel = read("web/src/lib/careerPassport.ts");
const careerPassportPage = read("web/src/pages/CareerPassportPage.tsx");
ok("Career Passport V5 model exists", careerPassportModel.includes("CareerPassportState") && careerPassportModel.includes("PassportProfilePacket"));
ok("Career Passport V5 model includes path graph", careerPassportModel.includes("EconomicPathNode"));
ok("Career Passport V5 model includes skill gaps", careerPassportModel.includes("SkillGap"));
ok("Career Passport V5 builds export payload", careerPassportModel.includes("buildPassportExportPayload"));
ok("Career Passport V5 page exists", careerPassportPage.includes("CareerPassportPage"));
ok("Career Passport V5 calls createJob", careerPassportPage.includes("createJob"));
ok("Career Passport V5 exports passport", careerPassportPage.includes("career.passport.export"));
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
ok("production deploy requires launch confirmation input", deployWorkflow.includes("confirm_launch_unlock"));
ok("production deploy requires target-specific confirmations", deployWorkflow.includes("DEPLOY-URAI-JOBS-STAGING") && deployWorkflow.includes("DEPLOY-URAI-JOBS-PRODUCTION"));
ok("production deploy runs activation readiness guard", deployWorkflow.includes("pnpm activation:verify"));
ok("production deploy runs runtime verification", deployWorkflow.includes("pnpm urai-jobs:verify"));
ok("production deploy runs runtime smoke", deployWorkflow.includes("pnpm urai-jobs:smoke"));
ok("production deploy destroys cloud credentials before public verification", deployWorkflow.includes("Destroy cloud credentials before evidence handoff"));
ok("production deploy binds public verification to mutation receipts", deployWorkflow.includes("Bind public verification to mutation receipts"));
ok("production deploy verifies callable worker health publicly", deployWorkflow.includes("node scripts/verify-worker-health.mjs"));
ok("production deploy verifies Firebase and optional custom domains publicly", deployWorkflow.includes("node scripts/verify-custom-domains.mjs"));
ok("production deploy records zero paid-provider smoke authorization", deployWorkflow.includes("paidProviderSmokeAuthorized: false") && deployWorkflow.includes("paidProviderCalls: 0"));

if (failed) throw new Error(`ACTIVATION_READINESS_VERIFY ${failed} checks failed`);
console.log("[PASS] ACTIVATION_READINESS_VERIFY");
