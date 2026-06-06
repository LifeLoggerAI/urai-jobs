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
const decisionModel = read("web/src/lib/careerDecision.ts");
const decisionPage = read("web/src/pages/CareerDecisionPage.tsx");
const passportModel = read("web/src/lib/careerPassport.ts");
const passportPage = read("web/src/pages/CareerPassportPage.tsx");

ok("app routes V1 Career Mirror", app.includes("/career-mirror"));
ok("app routes V2 Marketplace", app.includes("/career-marketplace"));
ok("app routes V3 Automation", app.includes("/career-automation"));
ok("app routes V4 Decision", app.includes("/career-decision"));
ok("app routes V5 Passport", app.includes("/career-passport"));
ok("app routes Version Console", app.includes("/career-versions"));

ok("landing links V1", landing.includes("/career-mirror"));
ok("landing links V2", landing.includes("/career-marketplace"));
ok("landing links V3", landing.includes("/career-automation"));
ok("landing links V4", landing.includes("/career-decision"));
ok("landing links V5", landing.includes("/career-passport"));
ok("landing links versions", landing.includes("/career-versions"));

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
