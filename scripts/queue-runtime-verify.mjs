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
const runtimeJobTypes = read("functions/src/core/runtimeJobTypes.ts");
const queueNow = read("functions/src/jobs/processQueueNow.ts");
const jobsApi = read("web/src/lib/jobsApi.ts");
const smoke = read("scripts/urai-jobs-smoke.mjs");

requireMarker("functions/src/index.ts", index, "processQueueNow");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "publishMessage");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "JOB_EXECUTION_TOPIC");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "PENDING");
requireMarker("functions/src/jobs/processQueueNow.ts", queueNow, "LEASED");
requireMarker("web/src/lib/jobsApi.ts", jobsApi, "processQueueNow");
requireMarker("functions/src/jobs/executeJob.ts", executor, "workerEnvKeyForJobType(jobType)");
requireMarker("functions/src/jobs/executeJob.ts", executor, "workerRouteForJobType(jobType)");
requireMarker("functions/src/jobs/executeJob.ts", executor, "execution.leaseToken");
for (const marker of [
  "NARRATOR_WORKER_URL",
  "ASSET_WORKER_URL",
  "STUDIO_WORKER_URL",
  "COMMUNICATIONS_WORKER_URL",
  "PRIVATE_SOURCE_WORKER_URL",
  "'narrator.tts'",
  "'asset-render'",
  "'asset.render'",
  "'studio.render.video'",
  "'communications.message.send'",
  "'memory.private-source.transcribe'",
  "route: '/'",
  "route: '/execute-job'",
  "route: '/executeJob'"
]) {
  requireMarker("functions/src/core/runtimeJobTypes.ts", runtimeJobTypes, marker);
}
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "asset.render routes to asset worker root");
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "career jobs remain hard-off");
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "spatial jobs remain hard-off");
requireMarker("scripts/urai-jobs-smoke.mjs", smoke, "running update mirrors lease token");

if (failures.length) {
  console.error("\n[FAIL] Queue runtime verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n[PASS] Queue runtime wiring verification complete.");
