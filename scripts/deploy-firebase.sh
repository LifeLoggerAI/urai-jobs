#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-prod}"
HOSTING_SITE="${FIREBASE_HOSTING_SITE:-urai-jobs}"
FALLBACK_HOSTING_SITE="${FIREBASE_FALLBACK_HOSTING_SITE:-}"
ALLOW_CREATE_HOSTING_SITE="${ALLOW_CREATE_HOSTING_SITE:-false}"
FUNCTIONS_ENV_FILE="functions/.env"
URAI_JOBS_WORKER_TOKEN_SECRET="${URAI_JOBS_WORKER_TOKEN_SECRET:-URAI_JOBS_WORKER_TOKEN}"

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"

command -v firebase >/dev/null 2>&1 || {
  echo "[FAIL] firebase CLI is required" >&2
  exit 1
}
command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}
command -v pnpm >/dev/null 2>&1 || {
  echo "[FAIL] pnpm is required" >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "[FAIL] node is required" >&2
  exit 1
}

trap 'rm -f "$FUNCTIONS_ENV_FILE"' EXIT

if [ "$TARGET" != "prod" ] && [ "$TARGET" != "staging" ] && [ "$TARGET" != "dev" ]; then
  echo "[FAIL] TARGET must be dev, staging, or prod. Got: $TARGET" >&2
  exit 1
fi

set_hosting_site_in_firebase_json() {
  local site="$1"
  SITE="$site" node <<'NODE'
const fs = require('fs');
const path = 'firebase.json';
const site = process.env.SITE;
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
if (!config.hosting || Array.isArray(config.hosting)) {
  throw new Error('Expected firebase.json hosting to be a single hosting object.');
}
config.hosting.site = site;
fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
NODE
}

ensure_hosting_site() {
  local site="$1"

  echo "[INFO] Ensuring Firebase Hosting site exists: $site"
  if firebase hosting:sites:get "$site" --project "$FIREBASE_PROJECT_ID" >/dev/null 2>&1; then
    echo "[PASS] Hosting site exists: $site"
    HOSTING_SITE="$site"
    return 0
  fi

  if [ "$ALLOW_CREATE_HOSTING_SITE" != "true" ]; then
    echo "[FAIL] Hosting site '$site' was not found in project '$FIREBASE_PROJECT_ID'." >&2
    echo "[FAIL] Refusing to create hosting sites during production deploy." >&2
    return 1
  fi

  echo "[WARN] Creating hosting site $site because ALLOW_CREATE_HOSTING_SITE=true"
  firebase hosting:sites:create "$site" --project "$FIREBASE_PROJECT_ID" --non-interactive
  HOSTING_SITE="$site"
}

verify_worker_secret() {
  gcloud secrets describe "$URAI_JOBS_WORKER_TOKEN_SECRET" \
    --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
    echo "[FAIL] Firebase executeJob requires Secret Manager secret: $URAI_JOBS_WORKER_TOKEN_SECRET" >&2
    exit 1
  }
  if [ "$URAI_JOBS_WORKER_TOKEN_SECRET" != "URAI_JOBS_WORKER_TOKEN" ]; then
    echo "[FAIL] executeJob binds the canonical Firebase secret name URAI_JOBS_WORKER_TOKEN." >&2
    echo "[FAIL] Set URAI_JOBS_WORKER_TOKEN_SECRET=URAI_JOBS_WORKER_TOKEN and use that same secret for Cloud Run." >&2
    exit 1
  fi
  echo "[PASS] Worker bearer token secret exists and matches the Firebase binding."
}

write_functions_env() {
  echo "[INFO] Writing non-secret Firebase Functions environment file: $FUNCTIONS_ENV_FILE"

  for key in NARRATOR_WORKER_URL ASSET_WORKER_URL GCS_BUCKET_NAME API_ALLOWED_ORIGINS URAI_ENV GCP_REGION GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID; do
    if [ -z "${!key:-}" ]; then
      echo "[FAIL] $key is required before Firebase Functions deploy." >&2
      exit 1
    fi
  done

  cat > "$FUNCTIONS_ENV_FILE" <<EOF
URAI_ENV=${URAI_ENV:-prod}
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
GCLOUD_PROJECT=$GCLOUD_PROJECT
GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
GCP_REGION=$GCP_REGION
API_ALLOWED_ORIGINS=$API_ALLOWED_ORIGINS
GCS_BUCKET_NAME=$GCS_BUCKET_NAME
NARRATOR_WORKER_URL=$NARRATOR_WORKER_URL
ASSET_WORKER_URL=$ASSET_WORKER_URL
EOF

  for key in SPATIAL_WORKER_URL STUDIO_WORKER_URL CAREER_WORKER_URL CONTENT_WORKER_URL STORYTIME_WORKER_URL ANALYTICS_WORKER_URL COMMUNICATIONS_WORKER_URL PUBSUB_JOB_EXECUTION_TOPIC URAI_JOBS_WORKER_TIMEOUT_MS; do
    if [ -n "${!key:-}" ]; then
      printf '%s=%s\n' "$key" "${!key}" >> "$FUNCTIONS_ENV_FILE"
    fi
  done

  echo "[PASS] Firebase Functions non-secret environment file prepared."
}

echo "[INFO] Running production precheck for target=$TARGET"
pnpm prod:precheck

echo "[INFO] Building shared types, functions, and web"
pnpm --filter @urai-jobs/shared-types build
pnpm --filter urai-jobs-functions build
pnpm --filter urai-jobs-web build

echo "[INFO] Selecting Firebase project: $FIREBASE_PROJECT_ID"
firebase use "$FIREBASE_PROJECT_ID"

if ! ensure_hosting_site "$HOSTING_SITE"; then
  if [ -n "$FALLBACK_HOSTING_SITE" ]; then
    echo "[WARN] Primary hosting site '$HOSTING_SITE' is unavailable. Trying fallback '$FALLBACK_HOSTING_SITE'."
    ensure_hosting_site "$FALLBACK_HOSTING_SITE"
  else
    exit 1
  fi
fi

verify_worker_secret

echo "[INFO] Setting firebase.json hosting.site to $HOSTING_SITE"
set_hosting_site_in_firebase_json "$HOSTING_SITE"
write_functions_env

echo "[INFO] Deploying Firebase Functions, Firestore rules/indexes, and Hosting"
firebase deploy --only functions,firestore,hosting --project "$FIREBASE_PROJECT_ID" --non-interactive

echo "[PASS] Firebase deployment completed for $FIREBASE_PROJECT_ID"
