#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"
: "${URAI_JOBS_WORKER_TOKEN:?URAI_JOBS_WORKER_TOKEN is required so worker endpoints do not deploy open or disabled}"

WORKER_BUILD_TIMEOUT_SECONDS="${WORKER_BUILD_TIMEOUT_SECONDS:-900}"
WORKER_BUILD_POLL_SECONDS="${WORKER_BUILD_POLL_SECONDS:-10}"
WORKER_DEPLOY_PARALLEL="${WORKER_DEPLOY_PARALLEL:-false}"
DEPLOY_GATED_WORKERS="${DEPLOY_GATED_WORKERS:-false}"

WORKERS=(
  "narrator-worker"
)

if [ "$DEPLOY_GATED_WORKERS" = "true" ]; then
  echo "[WARN] DEPLOY_GATED_WORKERS=true: deploying workers that are fail-closed/NOT_IMPLEMENTED placeholders. They are not production execution proof."
  WORKERS+=("asset-worker" "spatial-worker" "studio-worker")
fi

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null

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

  if [ ! -d "$dir" ]; then
    echo "[FAIL] Missing worker directory: $dir" >&2
    exit 1
  fi

  echo "[INFO] [$worker] Building -> $image"
  build_id="$(gcloud builds submit "$dir" \
    --tag "$image" \
    --async \
    --format='value(id)')"

  if [ -z "$build_id" ]; then
    echo "[FAIL] Cloud Build did not return a build id for $worker" >&2
    exit 1
  fi

  wait_for_build "$build_id" "$worker"

  echo "[INFO] [$worker] Deploying to Cloud Run in $GCP_REGION"
  gcloud run deploy "$worker" \
    --image "$image" \
    --platform managed \
    --region "$GCP_REGION" \
    --allow-unauthenticated \
    --set-env-vars "URAI_ENV=${URAI_ENV:-prod},GCS_BUCKET_NAME=$GCS_BUCKET_NAME,URAI_JOBS_WORKER_TOKEN=$URAI_JOBS_WORKER_TOKEN"

  local url
  url="$(gcloud run services describe "$worker" --platform managed --region "$GCP_REGION" --format='value(status.url)')"
  echo "[PASS] [$worker] deployed: $url"
}

if [ "${#WORKERS[@]}" -eq 0 ]; then
  echo "[FAIL] No workers selected for deployment" >&2
  exit 1
fi

if [ "$WORKER_DEPLOY_PARALLEL" = "true" ]; then
  echo "[INFO] Deploying selected workers in parallel: ${WORKERS[*]}"
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
    echo "[FAIL] One or more workers failed to deploy" >&2
    exit 1
  fi
else
  echo "[INFO] Deploying selected workers sequentially: ${WORKERS[*]}"
  for worker in "${WORKERS[@]}"; do
    deploy_worker "$worker"
  done
fi

echo "[PASS] Selected URAI Jobs Runtime workers deployed: ${WORKERS[*]}"
