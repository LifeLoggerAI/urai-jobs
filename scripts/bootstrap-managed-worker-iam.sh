#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-urai-jobs}}}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="${WORKER_SERVICE_ACCOUNT_NAME:-urai-jobs-worker}"
SERVICE_ACCOUNT_EMAIL="${WORKER_SERVICE_ACCOUNT_EMAIL:-${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"
BUCKET="${GCS_BUCKET_NAME:-urai-jobs-artifacts}"

if [[ "${PROJECT_ID}" != "urai-jobs" ]]; then
  echo "[WARN] PROJECT_ID is ${PROJECT_ID}; expected urai-jobs for production."
fi

if [[ "${BUCKET}" =~ replace-with|placeholder|YOUR_|dummy|fake|changeme ]]; then
  echo "[FAIL] GCS_BUCKET_NAME contains a placeholder value." >&2
  exit 1
fi

echo "[INFO] Project: ${PROJECT_ID}"
echo "[INFO] Region: ${REGION}"
echo "[INFO] Worker service account: ${SERVICE_ACCOUNT_EMAIL}"
echo "[INFO] Artifact bucket: gs://${BUCKET}"

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "[INFO] Creating service account ${SERVICE_ACCOUNT_EMAIL}"
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="URAI Jobs Worker" \
    --description="Managed worker service account for URAI Jobs queue processing" \
    --project "${PROJECT_ID}"
else
  echo "[PASS] Service account already exists"
fi

for role in \
  roles/datastore.user \
  roles/logging.logWriter \
  roles/monitoring.metricWriter \
  roles/artifactregistry.reader; do
  echo "[INFO] Granting ${role}"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null
 done

if ! gsutil ls -b "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "[INFO] Creating bucket gs://${BUCKET}"
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BUCKET}"
else
  echo "[PASS] Bucket already exists"
fi

echo "[INFO] Granting bucket object admin on gs://${BUCKET}"
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT_EMAIL}:roles/storage.objectAdmin" "gs://${BUCKET}"

echo "[PASS] Managed worker IAM/bootstrap complete"
echo "export WORKER_SERVICE_ACCOUNT_EMAIL='${SERVICE_ACCOUNT_EMAIL}'"
echo "export GCS_BUCKET_NAME='${BUCKET}'"
