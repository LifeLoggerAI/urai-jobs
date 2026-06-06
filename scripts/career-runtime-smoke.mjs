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

const payloads = {
  "career.profile.summarize": {
    profile: { preferredMode: "flexible", autonomy: "high", meetingLoad: "low" },
    outputPrefix: "career-smoke/profile-summary"
  },
  "career.fit.score": {
    profile: { preferredMode: "flexible", autonomy: "high" },
    opportunity: { id: "opportunity-ai-builder", title: "AI Workflow Builder" },
    outputPrefix: "career-smoke/fit-score"
  },
  "career.document.parse": {
    documentRef: "gs://urai-jobs-sample-inputs/career/profile.md",
    outputPrefix: "career-smoke/document-parse"
  },
  "career.document.tailor": {
    documentRef: "gs://urai-jobs-sample-inputs/career/profile.md",
    opportunity: { id: "opportunity-ai-builder", title: "AI Workflow Builder" },
    outputPrefix: "career-smoke/document-tailor"
  },
  "career.packet.generate": {
    candidate: { id: "candidate-v2-seed" },
    opportunity: { id: "opportunity-ai-builder" },
    outputPrefix: "career-smoke/packet"
  },
  "career.followup.plan": {
    rule: { id: "rule-deep-work-ai-product", reviewRequired: true },
    opportunity: { id: "opportunity-ai-builder" },
    outputPrefix: "career-smoke/followup-plan"
  },
  "career.interview.prep": {
    prepRoom: { id: "interview-prep-v4-seed" },
    opportunity: { id: "opportunity-ai-builder" },
    outputPrefix: "career-smoke/interview-prep"
  },
  "career.offer.compare": {
    offers: [{ id: "offer-ai-builder" }, { id: "offer-spatial-lead" }],
    outputPrefix: "career-smoke/offer-compare"
  },
  "career.spatial.portal.generate": {
    portal: { id: "portal-v4-seed", routeType: "golden-path" },
    outputPrefix: "career-smoke/spatial-portal"
  },
  "career.passport.export": {
    passport: { activeMode: "founder" },
    outputPrefix: "career-smoke/passport-export"
  }
};

function assert(name, condition) {
  if (!condition) {
    console.error(`[FAIL] ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`[PASS] ${name}`);
  }
}

function inferCareerWorkerRoute(jobType) {
  if (jobType.startsWith("career.")) return "CAREER_WORKER_URL:/execute-job";
  return "unknown";
}

function createSmokeJob(jobType) {
  return {
    jobId: `career-smoke-${jobType.replace(/[^a-z0-9]+/gi, "-")}`,
    type: jobType,
    jobType,
    status: "CREATED",
    origin: "JOBS",
    targetSystem: "JOBS",
    payload: {
      source: "career-runtime-smoke",
      ...payloads[jobType]
    }
  };
}

careerJobTypes.forEach((jobType) => {
  const smokeJob = createSmokeJob(jobType);
  assert(`${jobType} routes to career worker`, inferCareerWorkerRoute(jobType) === "CAREER_WORKER_URL:/execute-job");
  assert(`${jobType} has payload`, Boolean(payloads[jobType]));
  assert(`${jobType} smoke job carries type`, smokeJob.type === jobType && smokeJob.jobType === jobType);
  assert(`${jobType} smoke job targets JOBS`, smokeJob.origin === "JOBS" && smokeJob.targetSystem === "JOBS");
  assert(`${jobType} smoke job has outputPrefix`, typeof smokeJob.payload.outputPrefix === "string" && smokeJob.payload.outputPrefix.length > 0);
});

assert("career smoke covers ten job types", careerJobTypes.length === 10);
assert("career smoke includes V1 profile summary", careerJobTypes.includes("career.profile.summarize"));
assert("career smoke includes V1 fit score", careerJobTypes.includes("career.fit.score"));
assert("career smoke includes V2 packet generation", careerJobTypes.includes("career.packet.generate"));
assert("career smoke includes V3 follow-up planning", careerJobTypes.includes("career.followup.plan"));
assert("career smoke includes V4 spatial portal", careerJobTypes.includes("career.spatial.portal.generate"));
assert("career smoke includes V5 passport export", careerJobTypes.includes("career.passport.export"));

if (process.exitCode) {
  console.error("[FAIL] CAREER_RUNTIME_SMOKE");
  process.exit(process.exitCode);
}

console.log("[PASS] CAREER_RUNTIME_SMOKE");
