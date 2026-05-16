#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-urai-jobs}}"
ALERT_DIR="monitoring/alerts"

if [[ ! -d "$ALERT_DIR" ]]; then
  echo "[FAIL] Missing $ALERT_DIR"
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[INFO] Applying monitoring alert policies from $ALERT_DIR"

for policy in "$ALERT_DIR"/*.json; do
  [[ -f "$policy" ]] || continue

  echo "[INFO] Applying $(basename "$policy")"
  gcloud alpha monitoring policies create --policy-from-file="$policy" || true

done

echo "[PASS] Monitoring policy apply pass complete"
