import fs from "node:fs";

let failed = 0;
function ok(label, condition) {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
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
}
ok("landing links privacy", landing.includes("/privacy"));
ok("landing links terms", landing.includes("/terms"));
ok("landing links trust", landing.includes("/trust"));
ok("privacy page exists", legalPages.includes("PrivacyPage"));
ok("terms page exists", legalPages.includes("TermsPage"));
ok("trust page exists", legalPages.includes("TrustSafetyPage"));

const careerJobTypes = [
  "career.profile.sync",
  "career.opportunity.refresh",
  "career.recommendation.generate",
  "career.application.prepare",
  "career.interview.prepare",
  "career.followup.plan",
  "career.marketplace.purchase",
  "career.marketplace.fulfill",
  "career.mirror.refresh",
  "career.passport.export",
];

const createJob = read("functions/src/jobs/createJob.ts");
careerJobTypes.forEach((type) => ok(`createJob allows ${type}`, createJob.includes(type.split(".")[0]) || createJob.includes("/^career\\./")));

const worker = read("workers/career-worker/src/index.ts");
ok("career worker exists", worker.includes("career-worker"));
ok("career worker requires authz", worker.includes("/authz"));
ok("career worker accepts execute-job", worker.includes("/execute-job"));
ok("career worker validates bearer auth", worker.includes("Authorization"));

const careerDecisionModel = read("web/src/lib/careerDecision.ts");
const careerDecisionPage = read("web/src/pages/CareerDecisionPage.tsx");
ok("Career Decision V1 model exists", careerDecisionModel.includes("CareerDecisionState") && careerDecisionModel.includes("CareerRecommendation"));
ok("Career Decision V1 page exists", careerDecisionPage.includes("CareerDecisionPage"));
ok("Career Decision V1 calls createJob", careerDecisionPage.includes("createJob"));
ok("Career Decision V1 can refresh profile", careerDecisionPage.includes("career.profile.sync"));
ok("Career Decision V1 can refresh opportunities", careerDecisionPage.includes("career.opportunity.refresh"));
ok("Career Decision V1 can generate recommendation", careerDecisionPage.includes("career.recommendation.generate"));
ok("Career Decision V1 links Marketplace", careerDecisionPage.includes("/career-marketplace"));
ok("Career Decision V1 links Mirror", careerDecisionPage.includes("/career-mirror"));

const careerMarketplaceModel = read("web/src/lib/careerMarketplace.ts");
const careerMarketplacePage = read("web/src/pages/CareerMarketplacePage.tsx");
ok("Career Marketplace V2 model exists", careerMarketplaceModel.includes("CareerMarketplaceListing") && careerMarketplaceModel.includes("CareerMarketplacePurchase"));
ok("Career Marketplace V2 page exists", careerMarketplacePage.includes("CareerMarketplacePage"));
ok("Career Marketplace V2 calls createJob", careerMarketplacePage.includes("createJob"));
ok("Career Marketplace V2 can purchase", careerMarketplacePage.includes("career.marketplace.purchase"));
ok("Career Marketplace V2 can fulfill", careerMarketplacePage.includes("career.marketplace.fulfill"));
ok("Career Marketplace V2 links Automation", careerMarketplacePage.includes("/career-automation"));
ok("Career Marketplace V2 links Passport", careerMarketplacePage.includes("/career-passport"));

const careerMirrorModel = read("web/src/lib/careerMirror.ts");
const careerMirrorPage = read("web/src/pages/CareerMirrorPage.tsx");
ok("Career Mirror V4 model exists", careerMirrorModel.includes("CareerMirrorState") && careerMirrorModel.includes("CareerMirrorIntervention"));
ok("Career Mirror V4 page exists", careerMirrorPage.includes("CareerMirrorPage"));
ok("Career Mirror V4 calls createJob", careerMirrorPage.includes("createJob"));
ok("Career Mirror V4 can refresh mirror", careerMirrorPage.includes("career.mirror.refresh"));
ok("Career Mirror V4 links Decision", careerMirrorPage.includes("/career-decision"));
ok("Career Mirror V4 links Passport", careerMirrorPage.includes("/career-passport"));

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
ok("production deploy requires launch confirmation input", deployWorkflow.includes("confirm_launch_unlock"));
ok(
  "production deploy requires target-specific staging and production confirmations",
  deployWorkflow.includes("DEPLOY-URAI-JOBS-STAGING") && deployWorkflow.includes("DEPLOY-URAI-JOBS-PRODUCTION"),
);
ok("production deploy runs activation readiness guard", deployWorkflow.includes("pnpm activation:verify"));
ok("production deploy runs runtime verification", deployWorkflow.includes("pnpm urai-jobs:verify"));
ok("production deploy runs runtime smoke", deployWorkflow.includes("pnpm urai-jobs:smoke"));
ok("production deploy destroys cloud credentials before public verification", deployWorkflow.includes("Destroy cloud credentials before evidence handoff"));
ok("production deploy binds public verification to mutation receipts", deployWorkflow.includes("Bind public verification to mutation receipts"));
ok("production deploy verifies callable worker health publicly", deployWorkflow.includes("node scripts/verify-worker-health.mjs"));
ok("production deploy verifies Firebase and optional custom domains publicly", deployWorkflow.includes("node scripts/verify-custom-domains.mjs"));
ok("production deploy records zero paid-provider smoke authorization", deployWorkflow.includes("paidProviderSmokeAuthorized: false") && deployWorkflow.includes("paidProviderCalls: 0"));

if (failed) {
  throw new Error(`ACTIVATION_READINESS_VERIFY ${failed} checks failed`);
}

console.log("[PASS] ACTIVATION_READINESS_VERIFY");
