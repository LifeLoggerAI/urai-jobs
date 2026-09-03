#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${WORKER_SERVICE:-${1:-}}"
REGION="${GCP_REGION:-${REGION:-us-central1}}"
PROJECT_ID="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-urai-jobs}}"
REVISION="${ROLL_OUT_REVISION:-${REVISION:-}}"
VERIFY_COMMAND="${VERIFY_COMMAND:-pnpm prod:verify-workers}"
SLEEP_5="${CANARY_SLEEP_5:-60}"
SLEEP_25="${CANARY_SLEEP_25:-120}"
SLEEP_50="${CANARY_SLEEP_50:-180}"

if [[ -z "$SERVICE_NAME" ]]; then
  echo "[FAIL] WORKER_SERVICE or first argument is required."
  echo "Example: WORKER_SERVICE=narrator-worker ROLL_OUT_REVISION=narrator-worker-00005-abc bash scripts/canary-rollout.sh"
  exit 1
fi

if [[ -z "$REVISION" ]]; then
  echo "[FAIL] ROLL_OUT_REVISION or REVISION is required. Refusing to use an implicit revision."
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null

function verify() {
  echo "[INFO] Running verification: $VERIFY_COMMAND"
  bash -lc "$VERIFY_COMMAND"
}

function shift_traffic() {
  local percent="$1"

  echo "[INFO] shifting ${percent}% traffic for ${SERVICE_NAME} to ${REVISION} in ${PROJECT_ID}/${REGION}"

  gcloud run services update-traffic "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --to-revisions="$REVISION=$percent"

  verify
}

shift_traffic 5
sleep "$SLEEP_5"

shift_traffic 25
sleep "$SLEEP_25"

shift_traffic 50
sleep "$SLEEP_50"

shift_traffic 100

echo "[PASS] canary rollout completed for $SERVICE_NAME -> $REVISION"
