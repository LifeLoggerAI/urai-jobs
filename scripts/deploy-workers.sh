#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"
: "${WORKER_RUNTIME_SERVICE_ACCOUNT:?WORKER_RUNTIME_SERVICE_ACCOUNT is required}"
: "${ARTIFACT_REGISTRY_REPOSITORY:=urai-jobs}"
: "${URAI_JOBS_WORKER_TOKEN_SECRET:=urai-jobs-worker-token}"
: "${URAI_WHEEL_GITHUB_TOKEN_SECRET:=urai-wheel-github-token}"
: "${URAI_JOBS_CALLBACK_SECRET_NAME:=urai-jobs-callback-secret}"
: "${GITHUB_SHA:?GITHUB_SHA must contain the verified deployment source SHA}"

sha_pattern='^[0-9a-f]{40}$'
[[ "$GITHUB_SHA" =~ $sha_pattern ]] || {
  echo "[FAIL] GITHUB_SHA must be a full lowercase 40-character SHA" >&2
  exit 1
}

URAI_ENV="${URAI_ENV:-prod}"
WORKER_BUILD_TIMEOUT_SECONDS="${WORKER_BUILD_TIMEOUT_SECONDS:-900}"
WORKER_BUILD_POLL_SECONDS="${WORKER_BUILD_POLL_SECONDS:-10}"
DEPLOY_RECEIPT_PATH="${DEPLOY_RECEIPT_PATH:-docs/release-evidence/worker-deploy-receipt.json}"
WORKERS_CSV="${URAI_JOBS_DEPLOY_WORKERS:-narrator-worker,asset-worker}"
IFS=',' read -r -a WORKERS <<< "$WORKERS_CSV"

for command in gcloud curl node; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "[FAIL] $command is required" >&2
    exit 1
  }
done

case "$URAI_ENV" in
  prod|production|staging) ;;
  *)
    echo "[FAIL] URAI_ENV must be prod, production, or staging for worker deployment" >&2
    exit 1
    ;;
esac

for worker in "${WORKERS[@]}"; do
  case "$worker" in
    narrator-worker|asset-worker) ;;
    spatial-worker|studio-worker|career-worker)
      echo "[FAIL] $worker is incomplete and is intentionally excluded from production deployment" >&2
      exit 1
      ;;
    *)
      echo "[FAIL] Unsupported worker deployment target: $worker" >&2
      exit 1
      ;;
  esac
done

required_secrets=("$URAI_JOBS_WORKER_TOKEN_SECRET")
for worker in "${WORKERS[@]}"; do
  if [ "$worker" = "asset-worker" ]; then
    required_secrets+=("$URAI_WHEEL_GITHUB_TOKEN_SECRET" "$URAI_JOBS_CALLBACK_SECRET_NAME")
  fi
done

declare -A SECRET_VERSION_IDS=()
for secret_name in "${required_secrets[@]}"; do
  if [ -n "${SECRET_VERSION_IDS[$secret_name]:-}" ]; then
    continue
  fi
  gcloud secrets describe "$secret_name" --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
    echo "[FAIL] Required Secret Manager secret does not exist: $secret_name" >&2
    exit 1
  }
  version_name="$(gcloud secrets versions list "$secret_name" \
    --project "$GCLOUD_PROJECT" \
    --filter='state=ENABLED' \
    --sort-by='~createTime' \
    --limit=1 \
    --format='value(name)')"
  version_id="${version_name##*/}"
  [[ "$version_id" =~ ^[1-9][0-9]*$ ]] || {
    echo "[FAIL] No enabled numeric Secret Manager version exists for $secret_name" >&2
    exit 1
  }
  SECRET_VERSION_IDS["$secret_name"]="$version_id"
done

gcloud iam service-accounts describe "$WORKER_RUNTIME_SERVICE_ACCOUNT" \
  --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
  echo "[FAIL] Runtime service account does not exist: $WORKER_RUNTIME_SERVICE_ACCOUNT" >&2
  exit 1
}

gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPOSITORY" \
  --project "$GCLOUD_PROJECT" \
  --location "$GCP_REGION" >/dev/null 2>&1 || {
  echo "[FAIL] Artifact Registry repository does not exist: ${GCP_REGION}-docker.pkg.dev/$GCLOUD_PROJECT/$ARTIFACT_REGISTRY_REPOSITORY" >&2
  echo "[FAIL] Refusing to create paid cloud infrastructure from the deployment script." >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null
mkdir -p "$(dirname "$DEPLOY_RECEIPT_PATH")"
receipt_tmp="$(mktemp)"
trap 'rm -f "$receipt_tmp"' EXIT
echo '[]' > "$receipt_tmp"

print_build_diagnostics() {
  local build_id="$1"
  gcloud builds describe "$build_id" \
    --project "$GCLOUD_PROJECT" \
    --format='value(id,status,createTime,startTime,finishTime,logUrl)' || true
}

wait_for_build() {
  local build_id="$1"
  local worker="$2"
  local status=""
  local started
  started="$(date +%s)"

  while true; do
    status="$(gcloud builds describe "$build_id" \
      --project "$GCLOUD_PROJECT" \
      --format='value(status)')"

    case "$status" in
      SUCCESS)
        echo "[PASS] [$worker] Cloud Build $build_id succeeded"
        return 0
        ;;
      FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
        echo "[FAIL] [$worker] Cloud Build $build_id ended with status: $status" >&2
        print_build_diagnostics "$build_id" >&2
        return 1
        ;;
    esac

    if [ $(( $(date +%s) - started )) -ge "$WORKER_BUILD_TIMEOUT_SECONDS" ]; then
      echo "[FAIL] [$worker] Cloud Build $build_id exceeded ${WORKER_BUILD_TIMEOUT_SECONDS}s" >&2
      print_build_diagnostics "$build_id" >&2
      return 1
    fi
    sleep "$WORKER_BUILD_POLL_SECONDS"
  done
}

build_secret_versions_json() {
  local worker="$1"
  WORKER="$worker" \
  WORKER_TOKEN_VERSION="${SECRET_VERSION_IDS[$URAI_JOBS_WORKER_TOKEN_SECRET]}" \
  WHEEL_TOKEN_VERSION="${SECRET_VERSION_IDS[$URAI_WHEEL_GITHUB_TOKEN_SECRET]:-}" \
  CALLBACK_SECRET_VERSION="${SECRET_VERSION_IDS[$URAI_JOBS_CALLBACK_SECRET_NAME]:-}" \
  node <<'NODE'
const versions = {
  URAI_JOBS_WORKER_TOKEN: process.env.WORKER_TOKEN_VERSION,
};
if (process.env.WORKER === 'asset-worker') {
  versions.URAI_WHEEL_GITHUB_TOKEN = process.env.WHEEL_TOKEN_VERSION;
  versions.URAI_JOBS_CALLBACK_SECRET = process.env.CALLBACK_SECRET_VERSION;
}
process.stdout.write(JSON.stringify(versions));
NODE
}

verify_revision_secret_versions() {
  local revision_json="$1"
  local expected_json="$2"
  REVISION_JSON="$revision_json" EXPECTED_SECRET_VERSIONS_JSON="$expected_json" node <<'NODE'
const revision = JSON.parse(process.env.REVISION_JSON || '{}');
const expected = JSON.parse(process.env.EXPECTED_SECRET_VERSIONS_JSON || '{}');
const env = revision?.spec?.containers?.[0]?.env || [];
const observed = {};
for (const entry of env) {
  const ref = entry?.valueSource?.secretKeyRef || entry?.valueFrom?.secretKeyRef;
  if (entry?.name && ref?.version) observed[entry.name] = String(ref.version);
}
const failures = [];
for (const [name, version] of Object.entries(expected)) {
  if (!/^[1-9][0-9]*$/.test(String(version))) failures.push(`${name} expected version is not numeric`);
  if (observed[name] !== String(version)) failures.push(`${name} deployed version ${observed[name] || '<missing>'} does not match pinned ${version}`);
}
if (failures.length) {
  console.error(`[FAIL] Deployed revision secret provenance mismatch:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
NODE
}

append_receipt() {
  local worker="$1"
  local build_id="$2"
  local image="$3"
  local url="$4"
  local revision="$5"
  local rollback_revision="$6"
  local image_digest="$7"
  local rollback_image_digest="$8"
  local secret_versions_json="$9"

  WORKER="$worker" BUILD_ID="$build_id" IMAGE="$image" SERVICE_URL="$url" REVISION="$revision" \
  ROLLBACK_REVISION="$rollback_revision" IMAGE_DIGEST="$image_digest" \
  ROLLBACK_IMAGE_DIGEST="$rollback_image_digest" SECRET_VERSIONS_JSON="$secret_versions_json" \
  URAI_ENV="$URAI_ENV" GCP_REGION="$GCP_REGION" GCS_BUCKET_NAME="$GCS_BUCKET_NAME" \
  WORKER_RUNTIME_SERVICE_ACCOUNT="$WORKER_RUNTIME_SERVICE_ACCOUNT" RECEIPT_TMP="$receipt_tmp" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('fs');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

const secretVersions = JSON.parse(process.env.SECRET_VERSIONS_JSON || '{}');
const configuration = {
  worker: process.env.WORKER,
  environment: process.env.URAI_ENV,
  region: process.env.GCP_REGION,
  bucket: process.env.GCS_BUCKET_NAME,
  runtimeServiceAccount: process.env.WORKER_RUNTIME_SERVICE_ACCOUNT,
  secretVersions,
};
const configFingerprint = crypto.createHash('sha256').update(JSON.stringify(stable(configuration))).digest('hex');
const path = process.env.RECEIPT_TMP;
const current = JSON.parse(fs.readFileSync(path, 'utf8'));
current.push({
  worker: process.env.WORKER,
  buildId: process.env.BUILD_ID,
  image: process.env.IMAGE,
  serviceUrl: process.env.SERVICE_URL,
  revision: process.env.REVISION,
  rollbackRevision: process.env.ROLLBACK_REVISION || null,
  imageDigest: process.env.IMAGE_DIGEST || null,
  rollbackImageDigest: process.env.ROLLBACK_IMAGE_DIGEST || null,
  secretVersions,
  configuration,
  configFingerprint,
  unauthorizedProbe: 'PASS',
  authorizedProbe: 'PASS',
});
fs.writeFileSync(path, JSON.stringify(current, null, 2));
NODE
}

deploy_worker() {
  local worker="$1"
  local dir="workers/$worker"
  local image="${GCP_REGION}-docker.pkg.dev/$GCLOUD_PROJECT/$ARTIFACT_REGISTRY_REPOSITORY/$worker:${GITHUB_SHA}"
  local build_id=""
  local rollback_revision=""
  local rollback_image_digest=""

  [ -d "$dir" ] || {
    echo "[FAIL] Missing worker directory: $dir" >&2
    exit 1
  }

  rollback_revision="$(gcloud run services describe "$worker" \
    --project "$GCLOUD_PROJECT" \
    --region "$GCP_REGION" \
    --platform managed \
    --format='value(status.latestReadyRevisionName)' 2>/dev/null || true)"

  if [ -n "$rollback_revision" ]; then
    [[ "$rollback_revision" == "$worker-"* ]] || {
      echo "[FAIL] [$worker] Existing rollback revision does not belong to the worker service: $rollback_revision" >&2
      exit 1
    }
    rollback_image_digest="$(gcloud run revisions describe "$rollback_revision" \
      --project "$GCLOUD_PROJECT" \
      --region "$GCP_REGION" \
      --format='value(status.imageDigest)' 2>/dev/null || true)"
    [[ "$rollback_image_digest" =~ (^|@)sha256:[0-9a-f]{64}$ ]] || {
      echo "[FAIL] [$worker] Existing rollback revision lacks an immutable image digest: ${rollback_image_digest:-<empty>}" >&2
      exit 1
    }
  fi

  if { [ "$URAI_ENV" = "prod" ] || [ "$URAI_ENV" = "production" ]; } && [ -z "$rollback_revision" ]; then
    echo "[FAIL] [$worker] Production deployment requires an existing rollback revision before any new revision is created" >&2
    exit 1
  fi

  echo "[INFO] [$worker] Building $image"
  build_id="$(gcloud builds submit "$dir" \
    --project "$GCLOUD_PROJECT" \
    --tag "$image" \
    --async \
    --format='value(id)')"
  [ -n "$build_id" ] || {
    echo "[FAIL] Cloud Build did not return a build ID for $worker" >&2
    exit 1
  }
  wait_for_build "$build_id" "$worker"

  local worker_token_version="${SECRET_VERSION_IDS[$URAI_JOBS_WORKER_TOKEN_SECRET]}"
  local env_vars="URAI_ENV=$URAI_ENV,GCS_BUCKET_NAME=$GCS_BUCKET_NAME"
  local secret_vars="URAI_JOBS_WORKER_TOKEN=${URAI_JOBS_WORKER_TOKEN_SECRET}:${worker_token_version}"
  if [ "$worker" = "asset-worker" ]; then
    env_vars="$env_vars,ASSET_FACTORY_REPO=LifeLoggerAI/asset-factory"
    secret_vars="$secret_vars,URAI_WHEEL_GITHUB_TOKEN=${URAI_WHEEL_GITHUB_TOKEN_SECRET}:${SECRET_VERSION_IDS[$URAI_WHEEL_GITHUB_TOKEN_SECRET]},URAI_JOBS_CALLBACK_SECRET=${URAI_JOBS_CALLBACK_SECRET_NAME}:${SECRET_VERSION_IDS[$URAI_JOBS_CALLBACK_SECRET_NAME]}"
  fi
  [[ "$secret_vars" != *":latest"* ]] || {
    echo "[FAIL] [$worker] Mutable Secret Manager aliases are forbidden in deployed revisions" >&2
    exit 1
  }

  echo "[INFO] [$worker] Deploying with exact Secret Manager versions"
  gcloud run deploy "$worker" \
    --project "$GCLOUD_PROJECT" \
    --image "$image" \
    --platform managed \
    --region "$GCP_REGION" \
    --service-account "$WORKER_RUNTIME_SERVICE_ACCOUNT" \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --concurrency 20 \
    --timeout 300 \
    --set-env-vars "$env_vars" \
    --set-secrets "$secret_vars" \
    --quiet

  local url revision image_digest worker_token unauthorized_code authorized_code revision_json secret_versions_json
  url="$(gcloud run services describe "$worker" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.url)')"
  revision="$(gcloud run services describe "$worker" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.latestReadyRevisionName)')"
  [[ "$revision" == "$worker-"* ]] || {
    echo "[FAIL] [$worker] Latest revision does not belong to the expected service: $revision" >&2
    exit 1
  }
  [ "$revision" != "$rollback_revision" ] || {
    echo "[FAIL] [$worker] Deployment did not create a revision distinct from rollback: $revision" >&2
    exit 1
  }
  image_digest="$(gcloud run revisions describe "$revision" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.imageDigest)' 2>/dev/null || true)"
  [[ "$image_digest" =~ (^|@)sha256:[0-9a-f]{64}$ ]] || {
    echo "[FAIL] [$worker] Immutable image digest is missing or invalid for revision $revision: ${image_digest:-<empty>}" >&2
    exit 1
  }

  secret_versions_json="$(build_secret_versions_json "$worker")"
  revision_json="$(gcloud run revisions describe "$revision" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format=json)"
  verify_revision_secret_versions "$revision_json" "$secret_versions_json"
  worker_token="$(gcloud secrets versions access "$worker_token_version" --secret "$URAI_JOBS_WORKER_TOKEN_SECRET" --project "$GCLOUD_PROJECT")"

  curl --fail-with-body --retry 6 --retry-delay 5 "$url/healthz" >/dev/null
  unauthorized_code="$(curl -sS -o /dev/null -w '%{http_code}' "$url/authz")"
  [ "$unauthorized_code" = "401" ] || {
    echo "[FAIL] [$worker] unauthorized auth probe returned $unauthorized_code, expected 401" >&2
    exit 1
  }
  authorized_code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $worker_token" "$url/authz")"
  [ "$authorized_code" = "200" ] || {
    echo "[FAIL] [$worker] authorized auth probe returned $authorized_code, expected 200" >&2
    exit 1
  }

  append_receipt "$worker" "$build_id" "$image" "$url" "$revision" "$rollback_revision" "$image_digest" "$rollback_image_digest" "$secret_versions_json"
  echo "[PASS] [$worker] deployed with pinned secret provenance and auth probes: $url"
}

for worker in "${WORKERS[@]}"; do
  deploy_worker "$worker"
done

RECEIPT_TMP="$receipt_tmp" RECEIPT_PATH="$DEPLOY_RECEIPT_PATH" \
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-LifeLoggerAI/urai-jobs}" GITHUB_REF_NAME="${GITHUB_REF_NAME:-}" \
GITHUB_SHA="$GITHUB_SHA" GCLOUD_PROJECT="$GCLOUD_PROJECT" GCP_REGION="$GCP_REGION" URAI_ENV="$URAI_ENV" \
ARTIFACT_REGISTRY_REPOSITORY="$ARTIFACT_REGISTRY_REPOSITORY" \
WORKER_RUNTIME_SERVICE_ACCOUNT="$WORKER_RUNTIME_SERVICE_ACCOUNT" node <<'NODE'
const fs = require('fs');
const services = JSON.parse(fs.readFileSync(process.env.RECEIPT_TMP, 'utf8'));
const receipt = {
  schemaVersion: 'urai-jobs-worker-deploy-receipt-2',
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY,
  branch: process.env.GITHUB_REF_NAME || null,
  commitSha: process.env.GITHUB_SHA,
  project: process.env.GCLOUD_PROJECT,
  region: process.env.GCP_REGION,
  environment: process.env.URAI_ENV,
  artifactRegistryRepository: process.env.ARTIFACT_REGISTRY_REPOSITORY,
  runtimeServiceAccount: process.env.WORKER_RUNTIME_SERVICE_ACCOUNT,
  services,
  caveats: [
    'Cloud Run ingress is public because Asset Factory callbacks cannot present Cloud Run IAM credentials.',
    'Execution and callback routes are protected by exact Secret Manager version-backed bearer tokens.',
    'Spatial, Studio, and Career workers are intentionally excluded until their implementations are production-capable.',
  ],
};
fs.writeFileSync(process.env.RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
NODE

node scripts/validate-worker-deploy-receipt.mjs "$DEPLOY_RECEIPT_PATH"
echo "[PASS] Worker deployment receipt: $DEPLOY_RECEIPT_PATH"
