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
: "${DEPLOY_SOURCE_SHA:?DEPLOY_SOURCE_SHA is required}"
: "${URAI_FIREBASE_PREBUILT_VERIFIED:?URAI_FIREBASE_PREBUILT_VERIFIED is required}"

command -v firebase >/dev/null 2>&1 || { echo "[FAIL] firebase CLI is required" >&2; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "[FAIL] gcloud CLI is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[FAIL] node is required" >&2; exit 1; }

trap 'rm -f "$FUNCTIONS_ENV_FILE"' EXIT

if [ "$TARGET" != "prod" ] && [ "$TARGET" != "staging" ]; then
  echo "[FAIL] Canonical Firebase deployment target must be staging or prod. Got: $TARGET" >&2
  exit 1
fi
if [ "$URAI_FIREBASE_PREBUILT_VERIFIED" != "1" ]; then
  echo "[FAIL] Canonical Firebase deployment requires URAI_FIREBASE_PREBUILT_VERIFIED=1" >&2
  exit 1
fi
if [ "$DEPLOY_SOURCE_SHA" != "$(git rev-parse HEAD)" ]; then
  echo "[FAIL] Firebase deployment must use the exact verified target SHA" >&2
  exit 1
fi

set_hosting_site_in_firebase_json() {
  local site="$1"
  SITE="$site" node <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const site = process.env.SITE;
if (!config.hosting || Array.isArray(config.hosting)) throw new Error('Expected firebase.json hosting to be a single hosting object.');
config.hosting.site = site;
fs.writeFileSync('firebase.json', `${JSON.stringify(config, null, 2)}\n`);
NODE
}

ensure_hosting_site() {
  local site="$1"
  echo "[INFO] Verifying Firebase Hosting site: $site"
  if firebase hosting:sites:get "$site" --project "$FIREBASE_PROJECT_ID" >/dev/null 2>&1; then
    echo "[PASS] Hosting site exists: $site"
    HOSTING_SITE="$site"
    return 0
  fi
  if [ "$ALLOW_CREATE_HOSTING_SITE" != "true" ]; then
    echo "[FAIL] Hosting site '$site' was not found in project '$FIREBASE_PROJECT_ID'." >&2
    echo "[FAIL] Refusing to create hosting infrastructure during deployment." >&2
    return 1
  fi
  if [ "${HOSTING_SITE_CREATION_APPROVAL:-}" != "CREATE-URAI-JOBS-HOSTING-SITE" ]; then
    echo "[FAIL] Hosting creation requires separate infrastructure approval" >&2
    return 1
  fi
  if [ "$TARGET" = "prod" ] && [ "${PRODUCTION_INFRASTRUCTURE_APPROVAL:-}" != "APPROVE-URAI-JOBS-PRODUCTION-INFRASTRUCTURE" ]; then
    echo "[FAIL] Production hosting creation requires separate production infrastructure approval" >&2
    return 1
  fi
  firebase hosting:sites:create "$site" --project "$FIREBASE_PROJECT_ID" --non-interactive
  HOSTING_SITE="$site"
}

verify_worker_secret() {
  gcloud secrets describe "$URAI_JOBS_WORKER_TOKEN_SECRET" --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
    echo "[FAIL] Firebase executeJob requires Secret Manager secret: $URAI_JOBS_WORKER_TOKEN_SECRET" >&2
    exit 1
  }
}

write_functions_env() {
  for key in NARRATOR_WORKER_URL ASSET_WORKER_URL GCS_BUCKET_NAME API_ALLOWED_ORIGINS URAI_ENV GCP_REGION GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID; do
    if [ -z "${!key:-}" ] || [[ "${!key}" == *$'\n'* ]]; then
      echo "[FAIL] $key is missing or contains a newline" >&2
      exit 1
    fi
  done
  cat > "$FUNCTIONS_ENV_FILE" <<EOF
URAI_ENV=${URAI_ENV}
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
      [[ "${!key}" != *$'\n'* ]] || { echo "[FAIL] $key contains a newline" >&2; exit 1; }
      printf '%s=%s\n' "$key" "${!key}" >> "$FUNCTIONS_ENV_FILE"
    fi
  done
}

echo "[INFO] Verifying source-bound Firebase prebuilt bytes"
node scripts/firebase-prebuilt-manifest.mjs --verify

if [ "$FIREBASE_PROJECT_ID" != "$GCLOUD_PROJECT" ]; then
  echo "[FAIL] FIREBASE_PROJECT_ID and GCLOUD_PROJECT must match" >&2
  exit 1
fi
firebase use "$FIREBASE_PROJECT_ID"

if ! ensure_hosting_site "$HOSTING_SITE"; then
  if [ -n "$FALLBACK_HOSTING_SITE" ]; then
    ensure_hosting_site "$FALLBACK_HOSTING_SITE"
  else
    exit 1
  fi
fi

verify_worker_secret
set_hosting_site_in_firebase_json "$HOSTING_SITE"
write_functions_env

node scripts/firebase-prebuilt-manifest.mjs --verify

echo "[INFO] Deploying verified Firebase Functions, Firestore rules/indexes, and Hosting"
firebase deploy --only functions,firestore,hosting --project "$FIREBASE_PROJECT_ID" --non-interactive

echo "[PASS] Firebase deployment completed for $FIREBASE_PROJECT_ID"
