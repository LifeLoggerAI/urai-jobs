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

const urlKeys = new Set([
  "NARRATOR_WORKER_URL",
  "ASSET_WORKER_URL",
  "SPATIAL_WORKER_URL",
  "STUDIO_WORKER_URL"
]);

const secretKeys = new Set([
  "WEBHOOK_SIGNING_SECRET"
]);

function loadDotEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasPlaceholder(value) {
  return /replace-with|placeholder|your-|example\.com|example-|dummy|fake|todo|changeme/i.test(String(value || ""));
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !hasPlaceholder(url.hostname);
  } catch {
    return false;
  }
}

loadDotEnvFile(".env");
loadDotEnvFile(".env.production");
loadDotEnvFile("ops/production.env");

const failures = [];
const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
const presentOptional = optional.filter((key) => process.env[key] && process.env[key]?.trim() !== "");

for (const key of required) {
  const value = process.env[key] || "";
  let ok = Boolean(value.trim());

  if (ok && hasPlaceholder(value)) {
    ok = false;
    failures.push(`${key} contains a placeholder value.`);
  }

  if (ok && urlKeys.has(key) && !validUrl(value)) {
    ok = false;
    failures.push(`${key} must be a real https URL.`);
  }

  if (ok && secretKeys.has(key) && value.length < 24) {
    ok = false;
    failures.push(`${key} must be at least 24 characters.`);
  }

  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${key}`);
}

for (const key of optional) {
  const value = process.env[key] || "";
  const ok = Boolean(value.trim()) && !hasPlaceholder(value);
  console.log(`${ok ? "[PASS]" : "[WARN]"} optional ${key}`);
  if (value && hasPlaceholder(value)) failures.push(`${key} contains a placeholder value.`);
}

if (process.env.URAI_ENV && process.env.URAI_ENV !== "prod") {
  failures.push(`URAI_ENV must be prod for production deploy, got ${process.env.URAI_ENV}`);
}

if (missing.length) {
  failures.push(`Missing required production env vars: ${missing.join(", ")}`);
}

if (failures.length) {
  console.error("\n[FAIL] Production env precheck failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\n[PASS] Production env precheck complete. Optional configured: ${presentOptional.length}/${optional.length}`);
