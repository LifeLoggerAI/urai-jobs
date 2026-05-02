const statuses = ["queued", "running", "succeeded", "failed", "cancelled", "retry_needed"];

function assert(name, condition) {
  if (!condition) {
    console.error(`[FAIL] ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`[PASS] ${name}`);
  }
}

function canRetry(status) {
  return status === "failed" || status === "retry_needed";
}

function canCancel(status) {
  return status === "queued" || status === "running";
}

const ownerByPrefix = {
  spatial: "urai-spatial",
  marketing: "urai-marketing",
  studio: "urai-studio",
  assetFactory: "asset-factory",
  analytics: "analytics",
  communications: "communications",
  privacy: "privacy-consent",
  storytime: "storytime",
  admin: "admin",
  narrator: "narrator"
};

function inferOwner(jobType) {
  const [prefix] = jobType.split(".");
  return ownerByPrefix[prefix] ?? "unknown";
}

assert("queued is cancellable", canCancel("queued"));
assert("running is cancellable", canCancel("running"));
assert("failed is retryable", canRetry("failed"));
assert("retry_needed is retryable", canRetry("retry_needed"));
assert("succeeded is not retryable", !canRetry("succeeded"));
assert("cancelled is not cancellable", !canCancel("cancelled"));
assert("known statuses include retry_needed", statuses.includes("retry_needed"));
assert("spatial owner maps", inferOwner("spatial.memory.snapshot") === "urai-spatial");
assert("privacy owner maps", inferOwner("privacy.delete.run") === "privacy-consent");
assert("narrator owner maps", inferOwner("narrator.tts") === "narrator");

if (process.exitCode) {
  console.error("[FAIL] URAI_JOBS_SMOKE");
  process.exit(process.exitCode);
}

console.log("[PASS] URAI_JOBS_SMOKE");
