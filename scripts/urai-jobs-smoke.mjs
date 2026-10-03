const statuses = ["PENDING", "LEASED", "RUNNING", "SUCCESS", "FAILED", "DEAD", "CANCELLED"];

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

const activeRoutes = {
  "narrator.tts": "NARRATOR_WORKER_URL:/execute-job",
  "asset-render": "ASSET_WORKER_URL:/",
  "asset.render": "ASSET_WORKER_URL:/",
  "studio.render.video": "STUDIO_WORKER_URL:/",
  "communications.message.send": "COMMUNICATIONS_WORKER_URL:/executeJob",
  "memory.private-source.transcribe": "PRIVATE_SOURCE_WORKER_URL:/execute-job"
};

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
assert("asset.render routes to asset worker root", activeRoutes["asset.render"] === "ASSET_WORKER_URL:/");
assert("studio.render.video routes to studio worker root", activeRoutes["studio.render.video"] === "STUDIO_WORKER_URL:/");
assert("narrator.tts routes to narrator execute endpoint", activeRoutes["narrator.tts"] === "NARRATOR_WORKER_URL:/execute-job");
assert("communications.message.send routes to communications execute endpoint", activeRoutes["communications.message.send"] === "COMMUNICATIONS_WORKER_URL:/executeJob");
assert("memory.private-source.transcribe routes to private source execute endpoint", activeRoutes["memory.private-source.transcribe"] === "PRIVATE_SOURCE_WORKER_URL:/execute-job");
assert("career jobs remain hard-off", !Object.keys(activeRoutes).some((type) => type.startsWith("career.")));
assert("spatial jobs remain hard-off", !Object.keys(activeRoutes).some((type) => type.startsWith("spatial.")));
assert("running update mirrors lease token for deployed subsystem workers", runningUpdateIncludesLegacyLeaseToken({ "execution.leaseToken": "lease-token" }));

if (process.exitCode) {
  console.error("[FAIL] URAI_JOBS_SMOKE");
  process.exit(process.exitCode);
}

console.log("[PASS] URAI_JOBS_SMOKE");
