#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"

WORKERS=(
  "narrator-worker"
  "asset-worker"
  "spatial-worker"
  "studio-worker"
)

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null

wait_for_build() {
  local build_id="$1"
  local status=""

  echo "[INFO] Waiting for Cloud Build $build_id without streaming logs"

  while true; do
    status="$(gcloud builds describe "$build_id" \
      --project "$GCLOUD_PROJECT" \
      --format='value(status)')"

    case "$status" in
      SUCCESS)
        echo "[PASS] Cloud Build $build_id succeeded"
        return 0
        ;;
      FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
        echo "[FAIL] Cloud Build $build_id ended with status: $status" >&2
        echo "[INFO] Inspect build logs in Google Cloud Console for build id: $build_id" >&2
        return 1
        ;;
      QUEUED|WORKING|PENDING|"")
        echo "[INFO] Cloud Build $build_id status: ${status:-PENDING}"
        sleep 10
        ;;
      *)
        echo "[INFO] Cloud Build $build_id status: $status"
        sleep 10
        ;;
    esac
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

  echo "[INFO] Building $worker -> $image"
  build_id="$(gcloud builds submit "$dir" \
    --tag "$image" \
    --async \
    --format='value(id)')"

  if [ -z "$build_id" ]; then
    echo "[FAIL] Cloud Build did not return a build id for $worker" >&2
    exit 1
  fi

  wait_for_build "$build_id"

  echo "[INFO] Deploying $worker to Cloud Run in $GCP_REGION"
  gcloud run deploy "$worker" \
    --image "$image" \
    --platform managed \
    --region "$GCP_REGION" \
    --allow-unauthenticated \
    --set-env-vars "URAI_ENV=${URAI_ENV:-prod},GCS_BUCKET_NAME=$GCS_BUCKET_NAME"

  local url
  url="$(gcloud run services describe "$worker" --platform managed --region "$GCP_REGION" --format='value(status.url)')"
  echo "[PASS] $worker deployed: $url"
}

for worker in "${WORKERS[@]}"; do
  deploy_worker "$worker"
done

echo "[PASS] All URAI Jobs Runtime workers deployed."
