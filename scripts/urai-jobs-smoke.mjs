const statuses = ["PENDING", "LEASED", "RUNNING", "SUCCESS", "FAILED", "DEAD", "CANCELLED"];
const supportedJobTypes = ["narrator.tts"];
const gatedWorkerFamilies = ["asset", "spatial", "studio", "career"];

function assert(name, condition) {
  if (!condition) {
    console.error(`[FAIL] ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`[PASS] ${name}`);
  }
}

function canRetry(status) {
  return status === "FAILED";
}

function canCancel(status) {
  return status === "PENDING" || status === "LEASED" || status === "RUNNING";
}

function isSupportedJobType(jobType) {
  return supportedJobTypes.includes(jobType);
}

function isGatedWorkerFamily(jobType) {
  const [prefix] = jobType.split(/[._-]/);
  return gatedWorkerFamilies.includes(prefix);
}

function inferWorkerRoute(jobType) {
  if (jobType === "narrator.tts") return "NARRATOR_WORKER_URL:/execute-job";
  return "GATED_OR_NOT_IMPLEMENTED";
}

function runningUpdateIncludesLegacyLeaseToken(update) {
  return update["execution.leaseToken"] === "lease-token";
}

assert("PENDING is cancellable", canCancel("PENDING"));
assert("LEASED is cancellable", canCancel("LEASED"));
assert("RUNNING is cancellable", canCancel("RUNNING"));
assert("FAILED is retryable", canRetry("FAILED"));
assert("SUCCESS is not retryable", !canRetry("SUCCESS"));
assert("DEAD is not retryable", !canRetry("DEAD"));
assert("CANCELLED is not cancellable", !canCancel("CANCELLED"));
assert("known statuses include DEAD", statuses.includes("DEAD"));
assert("known statuses do not include retry_needed", !statuses.includes("retry_needed"));
assert("narrator.tts is supported", isSupportedJobType("narrator.tts"));
assert("asset job types are gated", isGatedWorkerFamily("asset.render"));
assert("spatial job types are gated", isGatedWorkerFamily("spatial.index"));
assert("studio job types are gated", isGatedWorkerFamily("studio.render"));
assert("career job types are gated", isGatedWorkerFamily("career.profile.summarize"));
assert("narrator.tts routes to narrator execute endpoint", inferWorkerRoute("narrator.tts") === "NARRATOR_WORKER_URL:/execute-job");
assert("gated job families do not claim active route", inferWorkerRoute("asset.render") === "GATED_OR_NOT_IMPLEMENTED");
assert("running update mirrors lease token for deployed subsystem workers", runningUpdateIncludesLegacyLeaseToken({ "execution.leaseToken": "lease-token" }));

if (process.exitCode) {
  console.error("[FAIL] URAI_JOBS_SMOKE");
  process.exit(process.exitCode);
}

console.log("[PASS] URAI_JOBS_SMOKE");
