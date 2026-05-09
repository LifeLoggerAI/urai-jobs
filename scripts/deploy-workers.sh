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

deploy_worker() {
  local worker="$1"
  local dir="workers/$worker"
  local image="gcr.io/$GCLOUD_PROJECT/$worker"

  if [ ! -d "$dir" ]; then
    echo "[FAIL] Missing worker directory: $dir" >&2
    exit 1
  fi

  echo "[INFO] Building $worker -> $image"
  gcloud builds submit "$dir" --tag "$image"

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
