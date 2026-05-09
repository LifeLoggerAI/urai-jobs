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

assert("PENDING is cancellable", canCancel("PENDING"));
assert("LEASED is cancellable", canCancel("LEASED"));
assert("RUNNING is cancellable", canCancel("RUNNING"));
assert("FAILED is retryable", canRetry("FAILED"));
assert("SUCCESS is not retryable", !canRetry("SUCCESS"));
assert("DEAD is not retryable", !canRetry("DEAD"));
assert("CANCELLED is not cancellable", !canCancel("CANCELLED"));
assert("known statuses include DEAD", statuses.includes("DEAD"));
assert("known statuses do not include retry_needed", !statuses.includes("retry_needed"));
assert("spatial owner maps", inferOwner("spatial.memory.snapshot") === "urai-spatial");
assert("privacy owner maps", inferOwner("privacy.delete.run") === "privacy-consent");
assert("narrator owner maps", inferOwner("narrator.tts") === "narrator");

if (process.exitCode) {
  console.error("[FAIL] URAI_JOBS_SMOKE");
  process.exit(process.exitCode);
}

console.log("[PASS] URAI_JOBS_SMOKE");
