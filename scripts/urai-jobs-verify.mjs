import fs from "fs";
import path from "path";

const IGNORED_DIRS = new Set(["node_modules", "dist", "build", ".next", ".git", "_audit"]);
let failed = 0;

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function check(name, condition) {
  if (condition) console.log(`[PASS] ${name}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}

const badRepeatedJs = ".js" + ".js";

const sourceFiles = [...walk("workers"), ...walk("functions/src"), ...walk("web/src")]
  .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));

const offenders = sourceFiles.filter((file) => read(file).includes(badRepeatedJs));
if (offenders.length) {
  console.error("[DETAIL] repeated extension offenders:");
  for (const file of offenders) console.error(`- ${file}`);
}
check("source does not contain repeated .js.js imports", offenders.length === 0);

const adminPage = read("web/src/pages/AdminPage.tsx");
check("AdminPage exists", adminPage.length > 0);
check("AdminPage has no mockData identifier", !adminPage.includes("mockData"));
check("AdminPage has no fake setTimeout loading", !adminPage.includes("setTimeout("));
check("AdminPage imports jobsApi", adminPage.includes("../lib/jobsApi"));

const jobsApi = read("web/src/lib/jobsApi.ts");
check("jobsApi exists", jobsApi.length > 0);

for (const name of ["listJobs", "getJob", "retryJob", "cancelJob", "listJobLogs"]) {
  check(
    `jobsApi exports ${name}`,
    new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+const\\s+${name}\\b`).test(jobsApi)
  );
}

const adminFns = read("functions/src/jobs/admin.ts");
const cancelFn = read("functions/src/jobs/cancelJob.ts");
const index = read("functions/src/index.ts");

check("backend listJobs exists", adminFns.includes("listJobs") || index.includes("listJobs"));
check("backend retryJob exists", adminFns.includes("retryJob") || index.includes("retryJob"));
check("backend listJobLogs exists", adminFns.includes("listJobLogs") || index.includes("listJobLogs"));
check("backend cancelJob exists", cancelFn.includes("cancelJob") || adminFns.includes("cancelJob") || index.includes("cancelJob"));

const contracts = read("docs/URAI_JOBS_INTEGRATION_CONTRACTS.md");
check("integration contracts exist", contracts.includes("spatial.memory.snapshot") && contracts.includes("privacy.delete.run"));

const leaseFiles = [
  "packages/shared-types/src/index.ts",
  "functions/src/jobs/processQueueTick.ts",
  "functions/src/jobs/retryExpiredLeases.ts",
  "functions/src/jobs/systemReconcile.ts",
  "firestore.indexes.json",
];

const legacyLeaseExpiryOffenders = leaseFiles.filter((file) => {
  const content = read(file);
  return content.includes("leaseExpiresAt") || content.includes("lease.leaseExpiresAt");
});

if (legacyLeaseExpiryOffenders.length) {
  console.error("[DETAIL] legacy lease expiry offenders:");
  for (const file of legacyLeaseExpiryOffenders) console.error(`- ${file}`);
}

check("lease recovery uses canonical lease.expiresAt", legacyLeaseExpiryOffenders.length === 0);

const processQueueTick = read("functions/src/jobs/processQueueTick.ts");
const retryExpiredLeases = read("functions/src/jobs/retryExpiredLeases.ts");
const systemReconcile = read("functions/src/jobs/systemReconcile.ts");
const indexes = read("firestore.indexes.json");

check("processQueueTick writes lease.expiresAt", processQueueTick.includes("expiresAt"));
check("retryExpiredLeases queries lease.expiresAt", retryExpiredLeases.includes("lease.expiresAt"));
check("systemReconcile queries lease.expiresAt", systemReconcile.includes("lease.expiresAt"));
check("firestore index covers lease.expiresAt", indexes.includes("lease.expiresAt"));
check("firestore index covers stale heartbeat reconciliation", indexes.includes("lease.heartbeatAt"));

const pkg = JSON.parse(read("package.json") || "{}");
check("urai-jobs:verify script exists", Boolean(pkg.scripts?.["urai-jobs:verify"]));
check("urai-jobs:smoke script exists", Boolean(pkg.scripts?.["urai-jobs:smoke"]));

if (failed > 0) {
  console.error(`[FAIL] URAI_JOBS_VERIFY ${failed} checks failed`);
  process.exit(1);
}

console.log("[PASS] URAI_JOBS_VERIFY");
