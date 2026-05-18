#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-urai-jobs}}"
REGION="${GCP_REGION:-us-central1}"

if [[ -z "${ROLLBACK_REVISION:-}" ]]; then
  echo "[FAIL] ROLLBACK_REVISION is required."
  echo "Example: ROLLBACK_REVISION=narrator-worker-00003-abc WORKER_SERVICE=narrator-worker bash scripts/rollback-cloud-run-workers.sh"
  exit 1
fi

if [[ -z "${WORKER_SERVICE:-}" ]]; then
  echo "[FAIL] WORKER_SERVICE is required."
  echo "Example: WORKER_SERVICE=narrator-worker"
  exit 1
fi

echo "[INFO] Rolling back $WORKER_SERVICE in $PROJECT_ID/$REGION to $ROLLBACK_REVISION"
gcloud config set project "$PROJECT_ID" >/dev/null

gcloud run services update-traffic "$WORKER_SERVICE" \
  --region "$REGION" \
  --to-revisions "$ROLLBACK_REVISION=100"

echo "[PASS] Rollback traffic update complete for $WORKER_SERVICE -> $ROLLBACK_REVISION"
