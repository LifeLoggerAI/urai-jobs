import { execFileSync } from "child_process";
import fs from "fs";

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
const region = process.env.GCP_REGION || "us-central1";
const outputFile = process.env.GITHUB_ENV || process.env.URAI_JOBS_WORKER_ENV_FILE || "";

const workers = [
  ["NARRATOR_WORKER_URL", "narrator-worker"],
  ["ASSET_WORKER_URL", "asset-worker"],
  ["SPATIAL_WORKER_URL", "spatial-worker"],
  ["STUDIO_WORKER_URL", "studio-worker"]
];

if (!project) {
  console.error("[FAIL] GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT, or FIREBASE_PROJECT_ID is required.");
  process.exit(1);
}

function describe(worker) {
  return execFileSync("gcloud", [
    "run",
    "services",
    "describe",
    worker,
    "--platform",
    "managed",
    "--region",
    region,
    "--project",
    project,
    "--format=value(status.url)"
  ], { encoding: "utf8" }).trim();
}

const lines = [];
let failed = false;

for (const [key, worker] of workers) {
  try {
    const url = describe(worker);
    if (!url || !url.startsWith("https://")) {
      console.error(`[FAIL] ${worker} did not return a real https URL.`);
      failed = true;
      continue;
    }
    console.log(`[PASS] ${key}=${url}`);
    lines.push(`${key}=${url}`);
  } catch (error) {
    console.error(`[FAIL] Could not read URL for ${worker}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

if (failed) process.exit(1);

if (outputFile) {
  fs.appendFileSync(outputFile, `${lines.join("\n")}\n`);
  console.log(`[PASS] Exported worker URLs to ${outputFile}`);
} else {
  console.log(lines.join("\n"));
}
