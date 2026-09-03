#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

sanitize_bucket_name() {
  local value="$1"
  echo "$value" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^[^a-z0-9]+//; s/[^a-z0-9]+$//; s/-+/-/g'
}

valid_bucket_name() {
  local value="$1"
  [[ ${#value} -ge 3 && ${#value} -le 63 ]] || return 1
  [[ "$value" =~ ^[a-z0-9][a-z0-9._-]*[a-z0-9]$ ]] || return 1
  [[ ! "$value" =~ [_.-]{2,} ]] || return 1
  [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
}

DEFAULT_BUCKET="$(sanitize_bucket_name "${GCLOUD_PROJECT}-artifacts")"
CANDIDATE_BUCKET="$(sanitize_bucket_name "${GCS_BUCKET_NAME:-}")"

if ! valid_bucket_name "$CANDIDATE_BUCKET"; then
  echo "[FAIL] GCS_BUCKET_NAME is required and must be a valid explicit bucket name." >&2
  echo "[FAIL] Refusing to guess an infrastructure target during deployment." >&2
  exit 1
fi
GCS_BUCKET_NAME="$CANDIDATE_BUCKET"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "GCS_BUCKET_NAME=${GCS_BUCKET_NAME}" >> "$GITHUB_ENV"
fi

if gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project "${GCLOUD_PROJECT}" >/dev/null 2>&1; then
  echo "[PASS] GCS bucket exists: gs://${GCS_BUCKET_NAME}"
  exit 0
fi

if [ "${ALLOW_CREATE_GCS_BUCKET:-false}" != "true" ] || [ "${GCS_BUCKET_CREATION_APPROVAL:-}" != "CREATE-URAI-JOBS-GCS-BUCKET" ]; then
  echo "[FAIL] Required GCS bucket does not exist: gs://${GCS_BUCKET_NAME}" >&2
  echo "[FAIL] Deployment scripts may not create billable infrastructure implicitly." >&2
  echo "[FAIL] Create it separately under approved infrastructure change control, or explicitly set both ALLOW_CREATE_GCS_BUCKET=true and GCS_BUCKET_CREATION_APPROVAL=CREATE-URAI-JOBS-GCS-BUCKET." >&2
  exit 1
fi

if [ "${URAI_ENV:-}" = "prod" ] || [ "${URAI_ENV:-}" = "production" ]; then
  if [ "${PRODUCTION_INFRASTRUCTURE_APPROVAL:-}" != "APPROVE-URAI-JOBS-PRODUCTION-INFRASTRUCTURE" ]; then
    echo "[FAIL] Production bucket creation requires PRODUCTION_INFRASTRUCTURE_APPROVAL=APPROVE-URAI-JOBS-PRODUCTION-INFRASTRUCTURE" >&2
    exit 1
  fi
fi

echo "[WARN] Explicitly authorized GCS bucket creation: gs://${GCS_BUCKET_NAME} in ${GCP_REGION}"
gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" \
  --project "${GCLOUD_PROJECT}" \
  --location "${GCP_REGION}" \
  --uniform-bucket-level-access

echo "[PASS] Created explicitly approved GCS bucket: gs://${GCS_BUCKET_NAME}"
