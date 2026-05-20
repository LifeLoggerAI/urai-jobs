#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GCP_REGION:=us-central1}"
: "${GCS_BUCKET_NAME:?GCS_BUCKET_NAME is required}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}

if gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project "${GCLOUD_PROJECT}" >/dev/null 2>&1; then
  echo "[PASS] GCS bucket exists: gs://${GCS_BUCKET_NAME}"
  exit 0
fi

echo "[INFO] Creating GCS artifact bucket: gs://${GCS_BUCKET_NAME} in ${GCP_REGION}"
gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" \
  --project "${GCLOUD_PROJECT}" \
  --location "${GCP_REGION}" \
  --uniform-bucket-level-access

echo "[PASS] Created GCS bucket: gs://${GCS_BUCKET_NAME}"
