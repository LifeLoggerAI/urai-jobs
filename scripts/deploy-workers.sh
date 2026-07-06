#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"
: "${WORKER_RUNTIME_SERVICE_ACCOUNT:?WORKER_RUNTIME_SERVICE_ACCOUNT is required}"
: "${URAI_JOBS_WORKER_TOKEN_SECRET:=urai-jobs-worker-token}"
: "${URAI_WHEEL_GITHUB_TOKEN_SECRET:=urai-wheel-github-token}"
: "${URAI_JOBS_CALLBACK_SECRET_NAME:=urai-jobs-callback-secret}"

URAI_ENV="${URAI_ENV:-prod}"
WORKER_BUILD_TIMEOUT_SECONDS="${WORKER_BUILD_TIMEOUT_SECONDS:-900}"
WORKER_BUILD_POLL_SECONDS="${WORKER_BUILD_POLL_SECONDS:-10}"
DEPLOY_RECEIPT_PATH="${DEPLOY_RECEIPT_PATH:-docs/release-evidence/worker-deploy-receipt.json}"
WORKERS_CSV="${URAI_JOBS_DEPLOY_WORKERS:-narrator-worker,asset-worker}"
IFS=',' read -r -a WORKERS <<< "$WORKERS_CSV"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "[FAIL] curl is required" >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "[FAIL] node is required" >&2
  exit 1
}

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

for secret_name in "${required_secrets[@]}"; do
  gcloud secrets describe "$secret_name" --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
    echo "[FAIL] Required Secret Manager secret does not exist: $secret_name" >&2
    exit 1
  }
done

gcloud iam service-accounts describe "$WORKER_RUNTIME_SERVICE_ACCOUNT" \
  --project "$GCLOUD_PROJECT" >/dev/null 2>&1 || {
  echo "[FAIL] Runtime service account does not exist: $WORKER_RUNTIME_SERVICE_ACCOUNT" >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null
mkdir -p "$(dirname "$DEPLOY_RECEIPT_PATH")"
receipt_tmp="$(mktemp)"
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

append_receipt() {
  local worker="$1"
  local build_id="$2"
  local url="$3"
  local revision="$4"
  local rollback_revision="$5"
  local image_digest="$6"
  local config_fingerprint="$7"

  WORKER="$worker" BUILD_ID="$build_id" SERVICE_URL="$url" REVISION="$revision" \
  ROLLBACK_REVISION="$rollback_revision" IMAGE_DIGEST="$image_digest" \
  CONFIG_FINGERPRINT="$config_fingerprint" RECEIPT_TMP="$receipt_tmp" node <<'NODE'
const fs = require('fs');
const path = process.env.RECEIPT_TMP;
const current = JSON.parse(fs.readFileSync(path, 'utf8'));
current.push({
  worker: process.env.WORKER,
  buildId: process.env.BUILD_ID,
  serviceUrl: process.env.SERVICE_URL,
  revision: process.env.REVISION,
  rollbackRevision: process.env.ROLLBACK_REVISION || null,
  imageDigest: process.env.IMAGE_DIGEST || null,
  configFingerprint: process.env.CONFIG_FINGERPRINT,
  unauthorizedProbe: 'PASS',
  authorizedProbe: 'PASS',
});
fs.writeFileSync(path, JSON.stringify(current, null, 2));
NODE
}

deploy_worker() {
  local worker="$1"
  local dir="workers/$worker"
  local image="gcr.io/$GCLOUD_PROJECT/$worker:${GITHUB_SHA:-manual-$(date +%Y%m%d%H%M%S)}"
  local build_id=""
  local rollback_revision=""

  [ -d "$dir" ] || {
    echo "[FAIL] Missing worker directory: $dir" >&2
    exit 1
  }

  rollback_revision="$(gcloud run services describe "$worker" \
    --project "$GCLOUD_PROJECT" \
    --region "$GCP_REGION" \
    --platform managed \
    --format='value(status.latestReadyRevisionName)' 2>/dev/null || true)"

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

  local env_vars="URAI_ENV=$URAI_ENV,GCS_BUCKET_NAME=$GCS_BUCKET_NAME"
  local secret_vars="URAI_JOBS_WORKER_TOKEN=${URAI_JOBS_WORKER_TOKEN_SECRET}:latest"
  if [ "$worker" = "asset-worker" ]; then
    env_vars="$env_vars,ASSET_FACTORY_REPO=LifeLoggerAI/asset-factory"
    secret_vars="$secret_vars,URAI_WHEEL_GITHUB_TOKEN=${URAI_WHEEL_GITHUB_TOKEN_SECRET}:latest,URAI_JOBS_CALLBACK_SECRET=${URAI_JOBS_CALLBACK_SECRET_NAME}:latest"
  fi

  echo "[INFO] [$worker] Deploying with Secret Manager-backed application authentication"
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

  local url revision image_digest worker_token unauthorized_code authorized_code config_fingerprint
  url="$(gcloud run services describe "$worker" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.url)')"
  revision="$(gcloud run services describe "$worker" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.latestReadyRevisionName)')"
  image_digest="$(gcloud run revisions describe "$revision" --project "$GCLOUD_PROJECT" --region "$GCP_REGION" --format='value(status.imageDigest)' 2>/dev/null || true)"
  worker_token="$(gcloud secrets versions access latest --secret "$URAI_JOBS_WORKER_TOKEN_SECRET" --project "$GCLOUD_PROJECT")"

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

  config_fingerprint="$(printf '%s' "$worker|$URAI_ENV|$GCP_REGION|$GCS_BUCKET_NAME|$WORKER_RUNTIME_SERVICE_ACCOUNT|$secret_vars" | sha256sum | awk '{print $1}')"
  append_receipt "$worker" "$build_id" "$url" "$revision" "$rollback_revision" "$image_digest" "$config_fingerprint"
  echo "[PASS] [$worker] deployed and auth probes passed: $url"
}

for worker in "${WORKERS[@]}"; do
  deploy_worker "$worker"
done

RECEIPT_TMP="$receipt_tmp" RECEIPT_PATH="$DEPLOY_RECEIPT_PATH" node <<'NODE'
const fs = require('fs');
const services = JSON.parse(fs.readFileSync(process.env.RECEIPT_TMP, 'utf8'));
const receipt = {
  schemaVersion: 'urai-jobs-worker-deploy-receipt-1',
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || 'LifeLoggerAI/urai-jobs',
  branch: process.env.GITHUB_REF_NAME || null,
  commitSha: process.env.GITHUB_SHA || null,
  project: process.env.GCLOUD_PROJECT,
  region: process.env.GCP_REGION,
  environment: process.env.URAI_ENV,
  runtimeServiceAccount: process.env.WORKER_RUNTIME_SERVICE_ACCOUNT,
  services,
  caveats: [
    'Cloud Run ingress is public because Asset Factory callbacks cannot present Cloud Run IAM credentials.',
    'Execution and callback routes are protected by independent Secret Manager-backed bearer tokens.',
    'Spatial, Studio, and Career workers are intentionally excluded until their implementations are production-capable.',
  ],
};
fs.writeFileSync(process.env.RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
NODE

rm -f "$receipt_tmp"
echo "[PASS] Worker deployment receipt: $DEPLOY_RECEIPT_PATH"
