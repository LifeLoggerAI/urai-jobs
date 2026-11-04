#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-}}}"
: "${PROJECT_ID:?FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT must explicitly select a project}"
for candidate in "${FIREBASE_PROJECT_ID:-}" "${GOOGLE_CLOUD_PROJECT:-}" "${GCLOUD_PROJECT:-}"; do
  if [[ -n "$candidate" && "$candidate" != "$PROJECT_ID" ]]; then
    echo "[FAIL] Conflicting project IDs: refuse worker IAM bootstrap." >&2
    exit 1
  fi
done
REGION="${GCP_REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="${WORKER_SERVICE_ACCOUNT_NAME:-urai-jobs-worker}"
SERVICE_ACCOUNT_EMAIL="${WORKER_SERVICE_ACCOUNT_EMAIL:-${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"

# Fail before any cloud mutation. Studio must not be deployed or bootstrapped
# with a generic worker identity while the private-media broker is unproven.
WORKERS_CSV="${URAI_JOBS_DEPLOY_WORKERS:-narrator-worker,asset-worker}"
WORKERS_CSV="$WORKERS_CSV" node scripts/studio-worker-deploy-veto.mjs

# A preapproved bucket is required. Never create a chargeable bucket or grant
# blanket Storage object administration as a bootstrap side effect.
BUCKET="${GCS_BUCKET_NAME:?GCS_BUCKET_NAME must identify an existing approved bucket}"
if ! [[ "$BUCKET" =~ ^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$ ]] || [[ "$BUCKET" == *..* ]]; then
  echo "[FAIL] GCS_BUCKET_NAME must be a single exact bucket name, not a path or glob." >&2
  exit 1
fi
if [[ "${BUCKET}" =~ replace-with|placeholder|YOUR_|dummy|fake|changeme ]]; then
  echo "[FAIL] GCS_BUCKET_NAME contains a placeholder value." >&2
  exit 1
fi
command -v gsutil >/dev/null 2>&1 || { echo "[FAIL] gsutil is required for read-only bucket preflight" >&2; exit 1; }
if ! gsutil ls -b "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "[HOLD] Approved GCS bucket must exist before worker bootstrap. No bucket creation performed." >&2
  exit 1
fi

echo "[INFO] Project: ${PROJECT_ID}"
echo "[INFO] Region: ${REGION}"
echo "[INFO] Worker service account: ${SERVICE_ACCOUNT_EMAIL}"
echo "[INFO] Existing artifact bucket: gs://${BUCKET}"
echo "[HOLD] Storage write authority is not granted by worker bootstrap; require separately approved scoped IAM."

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

echo "[PASS] Managed worker base IAM/bootstrap complete; Storage permissions unchanged"
echo "export WORKER_SERVICE_ACCOUNT_EMAIL='${SERVICE_ACCOUNT_EMAIL}'"
echo "export GCS_BUCKET_NAME='${BUCKET}'"
