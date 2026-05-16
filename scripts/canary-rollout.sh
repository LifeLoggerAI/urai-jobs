#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-urai-jobs-worker}"
REGION="${REGION:-us-central1}"
PROJECT_ID="${PROJECT_ID:-urai-jobs}"
REVISION="${REVISION:-latest}"

function shift_traffic() {
  local percent="$1"

  echo "[INFO] shifting ${percent}% traffic to ${REVISION}"

  gcloud run services update-traffic "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --to-revisions="${REVISION}=${percent}"
}

shift_traffic 5
sleep 60

shift_traffic 25
sleep 120

shift_traffic 50
sleep 180

shift_traffic 100

echo "[PASS] canary rollout completed"
