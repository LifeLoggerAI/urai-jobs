#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"

WORKER="career-worker"
DIR="workers/$WORKER"
IMAGE="gcr.io/$GCLOUD_PROJECT/$WORKER"

if [ ! -d "$DIR" ]; then
  echo "[FAIL] Missing worker directory: $DIR" >&2
  exit 1
fi

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

gcloud config set project "$GCLOUD_PROJECT" >/dev/null

echo "[INFO] Building $WORKER"
gcloud builds submit "$DIR" --tag "$IMAGE"

echo "[INFO] Deploying $WORKER"
gcloud run deploy "$WORKER" \
  --image "$IMAGE" \
  --platform managed \
  --region "$GCP_REGION" \
  --allow-unauthenticated

URL="$(gcloud run services describe "$WORKER" --platform managed --region "$GCP_REGION" --format='value(status.url)')"
echo "[PASS] $WORKER deployed: $URL"
echo "[NEXT] Set CAREER_WORKER_URL=$URL in the runtime environment."
