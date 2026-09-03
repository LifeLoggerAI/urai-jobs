#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-prod}"
HOSTING_SITE="${FIREBASE_HOSTING_SITE:-urai-jobs}"
FALLBACK_HOSTING_SITE="${FIREBASE_FALLBACK_HOSTING_SITE:-}"
ALLOW_CREATE_HOSTING_SITE="${ALLOW_CREATE_HOSTING_SITE:-false}"
FUNCTIONS_ENV_FILE="functions/.env"
FIREBASE_CONFIG_RECEIPT_PATH="${FIREBASE_CONFIG_RECEIPT_PATH:-docs/release-evidence/firebase-deploy-config-receipt.json}"
REPOSITORY_ROOT="$(pwd -P)"
FIREBASE_DEPLOY_CONFIG_PATH="${URAI_FIREBASE_DEPLOY_CONFIG_PATH:-${REPOSITORY_ROOT}/.urai-jobs-firebase-${DEPLOY_SOURCE_SHA:-unknown}.json}"
URAI_JOBS_WORKER_TOKEN_SECRET="${URAI_JOBS_WORKER_TOKEN_SECRET:-URAI_JOBS_WORKER_TOKEN}"
APPROVED_WORKER_TOKEN_VERSION=""
RESOLVED_WORKER_TOKEN_VERSION=""

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${DEPLOY_SOURCE_SHA:?DEPLOY_SOURCE_SHA is required}"
: "${URAI_FIREBASE_PREBUILT_VERIFIED:?URAI_FIREBASE_PREBUILT_VERIFIED is required}"
: "${DEPLOY_TARGET_SECRET_VERSIONS_JSON:?DEPLOY_TARGET_SECRET_VERSIONS_JSON is required}"

command -v firebase >/dev/null 2>&1 || { echo "[FAIL] firebase CLI is required" >&2; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "[FAIL] gcloud CLI is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[FAIL] node is required" >&2; exit 1; }

cleanup() {
  rm -f "$FUNCTIONS_ENV_FILE" "$FIREBASE_DEPLOY_CONFIG_PATH"
}
trap cleanup EXIT

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
if [ "$FIREBASE_PROJECT_ID" != "$GCLOUD_PROJECT" ]; then
  echo "[FAIL] FIREBASE_PROJECT_ID and GCLOUD_PROJECT must match" >&2
  exit 1
fi

REPOSITORY_ROOT="$REPOSITORY_ROOT" FIREBASE_DEPLOY_CONFIG_PATH="$FIREBASE_DEPLOY_CONFIG_PATH" DEPLOY_SOURCE_SHA="$DEPLOY_SOURCE_SHA" node <<'NODE'
const path = require('path');
const root = path.resolve(process.env.REPOSITORY_ROOT);
const candidate = path.resolve(process.env.FIREBASE_DEPLOY_CONFIG_PATH);
if (path.dirname(candidate) !== root) throw new Error('Temporary Firebase config must stay at the repository root.');
if (path.basename(candidate) !== `.urai-jobs-firebase-${process.env.DEPLOY_SOURCE_SHA}.json`) {
  throw new Error('Temporary Firebase config filename must bind the exact source SHA.');
}
NODE

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

approved_worker_token_version() {
  node <<'NODE'
const approval = JSON.parse(process.env.DEPLOY_TARGET_SECRET_VERSIONS_JSON || 'null');
if (!approval || Array.isArray(approval) || typeof approval !== 'object') {
  throw new Error('DEPLOY_TARGET_SECRET_VERSIONS_JSON must be a JSON object.');
}
const value = String(approval.URAI_JOBS_WORKER_TOKEN || '');
if (!/^[1-9][0-9]*$/.test(value)) {
  throw new Error('URAI_JOBS_WORKER_TOKEN must use an exact numeric Secret Manager version.');
}
process.stdout.write(value);
NODE
}

verify_worker_secret() {
  APPROVED_WORKER_TOKEN_VERSION="$(approved_worker_token_version)"
  local state
  state="$(gcloud secrets versions describe "$APPROVED_WORKER_TOKEN_VERSION" \
    --secret "$URAI_JOBS_WORKER_TOKEN_SECRET" \
    --project "$GCLOUD_PROJECT" \
    --format='value(state)')"
  [ "$state" = "ENABLED" ] || {
    echo "[FAIL] Approved worker token version $APPROVED_WORKER_TOKEN_VERSION is not ENABLED" >&2
    exit 1
  }

  RESOLVED_WORKER_TOKEN_VERSION="$(gcloud secrets versions list "$URAI_JOBS_WORKER_TOKEN_SECRET" \
    --project "$GCLOUD_PROJECT" \
    --filter='state=ENABLED' \
    --sort-by='~createTime' \
    --limit=1 \
    --format='value(name.basename())')"
  [[ "$RESOLVED_WORKER_TOKEN_VERSION" =~ ^[1-9][0-9]*$ ]] || {
    echo "[FAIL] Unable to resolve the current enabled worker token version" >&2
    exit 1
  }
  [ "$RESOLVED_WORKER_TOKEN_VERSION" = "$APPROVED_WORKER_TOKEN_VERSION" ] || {
    echo "[FAIL] Firebase Functions would bind worker token version $RESOLVED_WORKER_TOKEN_VERSION, but protected approval requires $APPROVED_WORKER_TOKEN_VERSION" >&2
    exit 1
  }
  export APPROVED_WORKER_TOKEN_VERSION RESOLVED_WORKER_TOKEN_VERSION
  echo "[PASS] Firebase Functions worker token binding matches approved numeric version $APPROVED_WORKER_TOKEN_VERSION"
}

write_functions_env() {
  for key in NARRATOR_WORKER_URL ASSET_WORKER_URL GCS_BUCKET_NAME API_ALLOWED_ORIGINS URAI_ENV GCP_REGION GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID DEPLOY_SOURCE_SHA URAI_JOBS_TERMINAL_EVENT_TOPIC; do
    if [ -z "${!key:-}" ] || [[ "${!key}" == *$'\n'* ]] || [[ "${!key}" == *$'\r'* ]]; then
      echo "[FAIL] $key is missing or contains a newline" >&2
      exit 1
    fi
  done
  cat > "$FUNCTIONS_ENV_FILE" <<EOF
URAI_ENV=${URAI_ENV}
URAI_BUILD_SHA=${DEPLOY_SOURCE_SHA}
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
GCLOUD_PROJECT=$GCLOUD_PROJECT
GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
GCP_REGION=$GCP_REGION
API_ALLOWED_ORIGINS=$API_ALLOWED_ORIGINS
GCS_BUCKET_NAME=$GCS_BUCKET_NAME
NARRATOR_WORKER_URL=$NARRATOR_WORKER_URL
ASSET_WORKER_URL=$ASSET_WORKER_URL
URAI_JOBS_TERMINAL_EVENT_TOPIC=$URAI_JOBS_TERMINAL_EVENT_TOPIC
EOF
  for key in SPATIAL_WORKER_URL STUDIO_WORKER_URL CAREER_WORKER_URL CONTENT_WORKER_URL STORYTIME_WORKER_URL ANALYTICS_WORKER_URL COMMUNICATIONS_WORKER_URL PUBSUB_JOB_EXECUTION_TOPIC URAI_JOBS_WORKER_TIMEOUT_MS; do
    if [ -n "${!key:-}" ]; then
      [[ "${!key}" != *$'\n'* && "${!key}" != *$'\r'* ]] || { echo "[FAIL] $key contains a newline" >&2; exit 1; }
      printf '%s=%s\n' "$key" "${!key}" >> "$FUNCTIONS_ENV_FILE"
    fi
  done
}

write_temporary_config() {
  SITE="$HOSTING_SITE" OUTPUT="$FIREBASE_DEPLOY_CONFIG_PATH" node <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
if (!config.hosting || Array.isArray(config.hosting)) throw new Error('Expected firebase.json hosting to be a single hosting object.');
config.hosting.site = process.env.SITE;
const rewrites = Array.isArray(config.hosting.rewrites) ? config.hosting.rewrites : [];
config.hosting.rewrites = [
  { source: '/api/buildinfo', function: 'buildInfo' },
  ...rewrites.filter((rewrite) => rewrite?.source !== '/api/buildinfo'),
];
fs.writeFileSync(process.env.OUTPUT, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
NODE
}

write_config_receipt() {
  local completed="$1"
  mkdir -p "$(dirname "$FIREBASE_CONFIG_RECEIPT_PATH")"
  FIREBASE_CONFIG_RECEIPT_PATH="$FIREBASE_CONFIG_RECEIPT_PATH" \
  FIREBASE_DEPLOY_CONFIG_PATH="$FIREBASE_DEPLOY_CONFIG_PATH" \
  FUNCTIONS_ENV_FILE="$FUNCTIONS_ENV_FILE" \
  HOSTING_SITE="$HOSTING_SITE" \
  TARGET="$TARGET" \
  DEPLOYMENT_COMPLETED="$completed" node <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const receipt = {
  schemaVersion: 'urai-jobs-firebase-deploy-config-1',
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || 'LifeLoggerAI/urai-jobs',
  workflowRunId: process.env.GITHUB_RUN_ID || null,
  sourceSha: process.env.DEPLOY_SOURCE_SHA,
  environment: process.env.TARGET,
  project: process.env.FIREBASE_PROJECT_ID,
  region: process.env.GCP_REGION,
  hostingSite: process.env.HOSTING_SITE,
  artifactBucket: process.env.GCS_BUCKET_NAME,
  allowedOrigins: String(process.env.API_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean).sort(),
  narratorWorkerUrl: process.env.NARRATOR_WORKER_URL,
  assetWorkerUrl: process.env.ASSET_WORKER_URL,
  terminalEventTopic: process.env.URAI_JOBS_TERMINAL_EVENT_TOPIC,
  firebaseCliVersion: process.env.FIREBASE_CLI_VERSION || null,
  firebaseConfigSha256: hashFile(process.env.FIREBASE_DEPLOY_CONFIG_PATH),
  functionsEnvSha256: hashFile(process.env.FUNCTIONS_ENV_FILE),
  workerTokenSecretName: process.env.URAI_JOBS_WORKER_TOKEN_SECRET,
  approvedWorkerTokenVersion: process.env.APPROVED_WORKER_TOKEN_VERSION,
  resolvedWorkerTokenVersion: process.env.RESOLVED_WORKER_TOKEN_VERSION,
  buildInfoPath: '/api/buildinfo',
  buildInfoExpectedSha: process.env.DEPLOY_SOURCE_SHA,
  deploymentCommandCompleted: process.env.DEPLOYMENT_COMPLETED === 'true',
  runtimeIdentityVerified: false,
  secretValuesIncluded: false,
};
fs.writeFileSync(process.env.FIREBASE_CONFIG_RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
NODE
}

assert_only_evidence_residue() {
  local residual
  residual="$(git status --porcelain --untracked-files=all | grep -vE '^\?\? docs/release-evidence/' || true)"
  if [ -n "$residual" ]; then
    echo "[FAIL] Firebase deployment left unexpected repository changes:" >&2
    printf '%s\n' "$residual" >&2
    exit 1
  fi
}

echo "[INFO] Verifying source-bound Firebase prebuilt bytes"
node scripts/firebase-prebuilt-manifest.mjs --verify

if ! ensure_hosting_site "$HOSTING_SITE"; then
  if [ -n "$FALLBACK_HOSTING_SITE" ]; then ensure_hosting_site "$FALLBACK_HOSTING_SITE"; else exit 1; fi
fi

verify_worker_secret
write_functions_env
write_temporary_config
node scripts/firebase-prebuilt-manifest.mjs --verify
write_config_receipt false

echo "[INFO] Deploying verified Firebase Functions, Firestore rules/indexes, and Hosting"
firebase deploy \
  --config "$FIREBASE_DEPLOY_CONFIG_PATH" \
  --only functions,firestore,hosting \
  --project "$FIREBASE_PROJECT_ID" \
  --non-interactive
verify_worker_secret
write_config_receipt true

cleanup
trap - EXIT
assert_only_evidence_residue

echo "[PASS] Firebase deployment command completed for $FIREBASE_PROJECT_ID; public runtime identity verification is still required"
