#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"
: "${WORKER_RUNTIME_SERVICE_ACCOUNT:?WORKER_RUNTIME_SERVICE_ACCOUNT is required}"
: "${URAI_JOBS_WORKER_TOKEN_SECRET:?URAI_JOBS_WORKER_TOKEN_SECRET is required}"

WORKER_BUILD_TIMEOUT_SECONDS="${WORKER_BUILD_TIMEOUT_SECONDS:-900}"
WORKER_BUILD_POLL_SECONDS="${WORKER_BUILD_POLL_SECONDS:-10}"
WORKER_DEPLOY_PARALLEL="${WORKER_DEPLOY_PARALLEL:-false}"
WORKER_MAX_INSTANCES="${WORKER_MAX_INSTANCES:-4}"

# Only the narrator worker is approved for this canonical deploy path today.
# Asset Factory has a separate callback-facing workflow and must not be deployed
# here until its dispatch endpoint, callback replay protection, and shared schema
# are certified. Spatial and Studio workers remain disabled placeholders.
WORKERS=("narrator-worker")

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null

gcloud secrets describe "$URAI_JOBS_WORKER_TOKEN_SECRET" \
  --project "$GCLOUD_PROJECT" >/dev/null || {
  echo "[FAIL] Secret Manager entry does not exist: $URAI_JOBS_WORKER_TOKEN_SECRET" >&2
  exit 1
}

print_build_diagnostics() {
  local build_id="$1"
  echo "[INFO] Cloud Build diagnostics for $build_id"
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

  echo "[INFO] [$worker] Waiting for Cloud Build $build_id without streaming logs"
  echo "[INFO] [$worker] Timeout: ${WORKER_BUILD_TIMEOUT_SECONDS}s; poll interval: ${WORKER_BUILD_POLL_SECONDS}s"

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
      QUEUED|WORKING|PENDING|"")
        echo "[INFO] [$worker] Cloud Build $build_id status: ${status:-PENDING}"
        ;;
      *)
        echo "[INFO] [$worker] Cloud Build $build_id status: $status"
        ;;
    esac

    local now elapsed
    now="$(date +%s)"
    elapsed=$((now - started))
    if [ "$elapsed" -ge "$WORKER_BUILD_TIMEOUT_SECONDS" ]; then
      echo "[FAIL] [$worker] Cloud Build $build_id exceeded ${WORKER_BUILD_TIMEOUT_SECONDS}s timeout" >&2
      print_build_diagnostics "$build_id" >&2
      return 1
    fi

    sleep "$WORKER_BUILD_POLL_SECONDS"
  done
}

deploy_worker() {
  local worker="$1"
  local dir="workers/$worker"
  local image="gcr.io/$GCLOUD_PROJECT/$worker"
  local build_id=""

  if [ "$worker" != "narrator-worker" ]; then
    echo "[FAIL] Worker is not approved by the canonical deploy authority: $worker" >&2
    return 1
  fi

  if [ ! -d "$dir" ]; then
    echo "[FAIL] Missing worker directory: $dir" >&2
    return 1
  fi

  echo "[INFO] [$worker] Building -> $image"
  build_id="$(gcloud builds submit "$dir" \
    --project "$GCLOUD_PROJECT" \
    --tag "$image" \
    --async \
    --format='value(id)')"

  if [ -z "$build_id" ]; then
    echo "[FAIL] Cloud Build did not return a build id for $worker" >&2
    return 1
  fi

  wait_for_build "$build_id" "$worker"

  echo "[INFO] [$worker] Deploying with Secret Manager-backed application authorization"
  gcloud run deploy "$worker" \
    --project "$GCLOUD_PROJECT" \
    --image "$image" \
    --platform managed \
    --region "$GCP_REGION" \
    --service-account "$WORKER_RUNTIME_SERVICE_ACCOUNT" \
    --allow-unauthenticated \
    --ingress all \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances "$WORKER_MAX_INSTANCES" \
    --concurrency 20 \
    --timeout 300 \
    --set-env-vars "URAI_ENV=production,GCS_BUCKET_NAME=$GCS_BUCKET_NAME" \
    --set-secrets "URAI_JOBS_WORKER_TOKEN=${URAI_JOBS_WORKER_TOKEN_SECRET}:latest"

  local url
  url="$(gcloud run services describe "$worker" \
    --project "$GCLOUD_PROJECT" \
    --platform managed \
    --region "$GCP_REGION" \
    --format='value(status.url)')"

  if [ -z "$url" ]; then
    echo "[FAIL] [$worker] Cloud Run did not return a service URL" >&2
    return 1
  fi

  echo "[PASS] [$worker] deployed with application-level bearer authorization: $url"
}

if [ "$WORKER_DEPLOY_PARALLEL" = "true" ]; then
  echo "[INFO] Deploying approved workers in parallel"
  pids=()
  for worker in "${WORKERS[@]}"; do
    deploy_worker "$worker" &
    pids+=("$!")
  done

  failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failed=1
    fi
  done

  if [ "$failed" -ne 0 ]; then
    echo "[FAIL] One or more approved workers failed to deploy" >&2
    exit 1
  fi
else
  echo "[INFO] Deploying approved workers sequentially"
  for worker in "${WORKERS[@]}"; do
    deploy_worker "$worker"
  done
fi

echo "[PASS] Canonical URAI Jobs worker deployment completed."
