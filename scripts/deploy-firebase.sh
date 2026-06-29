#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-prod}"
HOSTING_SITE="${FIREBASE_HOSTING_SITE:-urai-jobs}"
FALLBACK_HOSTING_SITE="${FIREBASE_FALLBACK_HOSTING_SITE:-}"
ALLOW_CREATE_HOSTING_SITE="${ALLOW_CREATE_HOSTING_SITE:-false}"
FUNCTIONS_ENV_FILE="functions/.env"

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"

command -v firebase >/dev/null 2>&1 || {
  echo "[FAIL] firebase CLI is required" >&2
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
    echo "[INFO] Set FIREBASE_HOSTING_SITE to an existing site, or run with ALLOW_CREATE_HOSTING_SITE=true intentionally." >&2
    return 1
  fi

  echo "[WARN] Creating hosting site $site in project $FIREBASE_PROJECT_ID because ALLOW_CREATE_HOSTING_SITE=true"
  firebase hosting:sites:create "$site" --project "$FIREBASE_PROJECT_ID" --non-interactive
  echo "[PASS] Created hosting site: $site"
  HOSTING_SITE="$site"
}

write_functions_env() {
  echo "[INFO] Writing Firebase Functions runtime env file: $FUNCTIONS_ENV_FILE"

  for key in NARRATOR_WORKER_URL WEBHOOK_SIGNING_SECRET GCS_BUCKET_NAME API_ALLOWED_ORIGINS URAI_ENV GCP_REGION GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID; do
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
WEBHOOK_SIGNING_SECRET=$WEBHOOK_SIGNING_SECRET
GCS_BUCKET_NAME=$GCS_BUCKET_NAME
NARRATOR_WORKER_URL=$NARRATOR_WORKER_URL
EOF

  if [ -n "${ASSET_WORKER_URL:-}" ]; then echo "ASSET_WORKER_URL=$ASSET_WORKER_URL" >> "$FUNCTIONS_ENV_FILE"; fi
  if [ -n "${SPATIAL_WORKER_URL:-}" ]; then echo "SPATIAL_WORKER_URL=$SPATIAL_WORKER_URL" >> "$FUNCTIONS_ENV_FILE"; fi
  if [ -n "${STUDIO_WORKER_URL:-}" ]; then echo "STUDIO_WORKER_URL=$STUDIO_WORKER_URL" >> "$FUNCTIONS_ENV_FILE"; fi

  echo "[PASS] Firebase Functions runtime env file prepared. Gated worker URLs are optional."
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

echo "[INFO] Setting firebase.json hosting.site to $HOSTING_SITE"
set_hosting_site_in_firebase_json "$HOSTING_SITE"

write_functions_env

echo "[INFO] Deploying Firebase Functions, Firestore rules/indexes, and Hosting"
firebase deploy --only functions,firestore,hosting --project "$FIREBASE_PROJECT_ID" --non-interactive

echo "[PASS] Firebase deployment completed for $FIREBASE_PROJECT_ID"
