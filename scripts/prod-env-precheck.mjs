import fs from "fs";

const required = [
  "URAI_ENV",
  "FIREBASE_PROJECT_ID",
  "GCLOUD_PROJECT",
  "GOOGLE_CLOUD_PROJECT",
  "GCP_REGION",
  "API_ALLOWED_ORIGINS",
  "WEBHOOK_SIGNING_SECRET",
  "GCS_BUCKET_NAME",
  "NARRATOR_WORKER_URL",
  "ASSET_WORKER_URL",
  "SPATIAL_WORKER_URL",
  "STUDIO_WORKER_URL"
];

const optional = [
  "MAILGUN_KEY",
  "MAILGUN_DOMAIN",
  "WORKER_SERVICE_ACCOUNT_EMAIL",
  "FIREBASE_HOSTING_SITE"
];

function loadDotEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvFile(".env");
loadDotEnvFile(".env.production");
loadDotEnvFile("ops/production.env");

const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
const presentOptional = optional.filter((key) => process.env[key] && process.env[key]?.trim() !== "");

for (const key of required) {
  console.log(`${process.env[key] ? "[PASS]" : "[FAIL]"} ${key}`);
}

for (const key of optional) {
  console.log(`${process.env[key] ? "[PASS]" : "[WARN]"} optional ${key}`);
}

if (process.env.URAI_ENV && process.env.URAI_ENV !== "prod") {
  console.error(`[FAIL] URAI_ENV must be prod for production deploy, got ${process.env.URAI_ENV}`);
  process.exit(1);
}

if (missing.length) {
  console.error(`\n[FAIL] Missing required production env vars: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`\n[PASS] Production env precheck complete. Optional configured: ${presentOptional.length}/${optional.length}`);
