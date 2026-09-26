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

const app = read("web/src/App.tsx");
const landing = read("web/src/pages/LandingPage.tsx");
const routeManifest = read("web/src/lib/careerRoutes.ts");
const versionPlan = read("web/src/lib/careerLaunchPlan.ts");
const versionConsole = read("web/src/pages/CareerVersionConsolePage.tsx");
const completionMatrix = read("docs/URAI_JOBS_V1_V5_COMPLETION_MATRIX.md");
const decisionModel = read("web/src/lib/careerDecision.ts");
const decisionPage = read("web/src/pages/CareerDecisionPage.tsx");
const passportModel = read("web/src/lib/careerPassport.ts");
const passportPage = read("web/src/pages/CareerPassportPage.tsx");

const requiredRoutes = [
  ["HOME", "/"],
  ["V1", "/career-mirror"],
  ["V2", "/career-marketplace"],
  ["V3", "/career-automation"],
  ["V4", "/career-decision"],
  ["V5", "/career-passport"],
  ["CONSOLE", "/career-versions"]
];

requiredRoutes.forEach(([version, path]) => {
  ok(`route manifest retains historical ${version} ${path}`, routeManifest.includes(`version: "${version}"`) && routeManifest.includes(`path: "${path}"`));
});

ok("app retains V1 Career Mirror compatibility route", app.includes("/career-mirror"));
ok("app retains V2 Marketplace compatibility route", app.includes("/career-marketplace"));
ok("app retains V3 Automation compatibility route", app.includes("/career-automation"));
ok("app retains V4 Decision compatibility route", app.includes("/career-decision"));
ok("app retains V5 Passport compatibility route", app.includes("/career-passport"));
ok("app retains Version Console compatibility route", app.includes("/career-versions"));

ok("canonical landing does not advertise V1 career surface", !landing.includes("/career-mirror"));
ok("canonical landing does not advertise V2 career surface", !landing.includes("/career-marketplace"));
ok("canonical landing does not advertise V3 career surface", !landing.includes("/career-automation"));
ok("canonical landing does not advertise V4 career surface", !landing.includes("/career-decision"));
ok("canonical landing does not advertise V5 career surface", !landing.includes("/career-passport"));
ok("canonical landing keeps internal version console out of the public entry", !landing.includes("/career-versions"));
ok("canonical landing states internal execution role", landing.includes("Internal execution fabric") && landing.includes("not a public careers marketplace"));
ok("legacy career routes fail into superseded product state", app.includes("Superseded surface") && app.includes("not part of the canonical URAI Jobs runtime"));

ok("historical version model retains V1", versionPlan.includes("/career-mirror"));
ok("historical version model retains V2", versionPlan.includes("/career-marketplace"));
ok("historical version model retains V3", versionPlan.includes("/career-automation"));
ok("historical version model retains V4", versionPlan.includes("/career-decision"));
ok("historical version model retains V5", versionPlan.includes("/career-passport"));
ok("version console retains historical surface links", versionConsole.includes("stage.href"));

ok("completion matrix exists", completionMatrix.includes("URAI Jobs V1-V5 Completion Matrix"));
ok("completion matrix documents runtime foundation", completionMatrix.includes("Shared runtime foundation"));
ok("completion matrix documents V1", completionMatrix.includes("V1 - Career Mirror"));
ok("completion matrix documents V2", completionMatrix.includes("V2 - Marketplace"));
ok("completion matrix documents V3", completionMatrix.includes("V3 - Bounded automation"));
ok("completion matrix documents V4", completionMatrix.includes("V4 - Decision layer"));
ok("completion matrix documents V5", completionMatrix.includes("V5 - Passport"));
ok("completion matrix lists production evidence gap", completionMatrix.includes("Production evidence still required"));

ok("V4 model defines interview prep", decisionModel.includes("InterviewPrepRoom"));
ok("V4 model defines offers", decisionModel.includes("CareerOffer"));
ok("V4 model defines spatial portal", decisionModel.includes("SpatialCareerPortal"));
ok("V4 model compares offers", decisionModel.includes("compareOffers"));
ok("V4 page exists", decisionPage.includes("CareerDecisionPage"));
ok("V4 page creates interview prep job", decisionPage.includes("career.interview.prep"));
ok("V4 page creates offer compare job", decisionPage.includes("career.offer.compare"));
ok("V4 page creates spatial portal job", decisionPage.includes("career.spatial.portal.generate"));
ok("V4 page links V3", decisionPage.includes("/career-automation"));
ok("V4 page links versions", decisionPage.includes("/career-versions"));

ok("V5 model defines Passport state", passportModel.includes("CareerPassportState"));
ok("V5 model defines profile packet", passportModel.includes("PassportProfilePacket"));
ok("V5 model defines path graph", passportModel.includes("EconomicPathNode"));
ok("V5 model defines skill gaps", passportModel.includes("SkillGap"));
ok("V5 model builds export payload", passportModel.includes("buildPassportExportPayload"));
ok("V5 page exists", passportPage.includes("CareerPassportPage"));
ok("V5 page creates passport export job", passportPage.includes("career.passport.export"));
ok("V5 page links V4", passportPage.includes("/career-decision"));
ok("V5 page links versions", passportPage.includes("/career-versions"));

if (failed) {
  throw new Error(`CAREER_SURFACES_VERIFY ${failed} checks failed`);
}

console.log("[PASS] CAREER_SURFACES_VERIFY");
