import fs from "fs";

const failures = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing ${path}`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

function requireMarker(path, content, marker) {
  const ok = content.includes(marker);
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${path} includes ${marker}`);
  if (!ok) failures.push(`${path} missing ${marker}`);
}

const index = read("functions/src/index.ts");
const executor = read("functions/src/jobs/executeJob.ts");
const queueNow = read("functions/src/jobs/processQueueNow.ts");
const jobsApi = read("web/src/lib/jobsApi.ts");
const smoke = read("scripts/urai-jobs-smoke.mjs");

requireMarker("functions/src/index.ts", index, "processQueueNow");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "publishMessage");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "JOB_EXECUTION_TOPIC");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "PENDING");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "LEASED");
requireMarker("web/src/lib/jobsApi.ts", jobsApi, "processQueueNow");
requireMarker("functions/src/jobs/executeJob.ts", executor, "ASSET_WORKER_URL");
requireMarker("functions/src/jobs/executeJob.ts", executor, "SPATIAL_WORKER_URL");
requireMarker("functions/src/jobs/executeJob.ts", executor, "STUDIO_WORKER_URL");
requireMarker("functions/src/jobs/executeJob.ts", executor, "NARRATOR_WORKER_URL");
requireMarker("functions/src/jobs/executeJob.ts", executor, "execution.leaseToken");
requireMarker("functions/src/jobs/executeJob.ts", executor, "route: '/'");
requireMarker("functions/src/jobs/executeJob.ts", executor, "route: '/execute-job'");
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "asset-render routes to asset worker root");
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "running update mirrors lease token");

if (failures.length) {
  console.error("\n[FAIL] Queue runtime verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n[PASS] Queue runtime wiring verification complete.");
