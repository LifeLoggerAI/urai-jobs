#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-urai-jobs}}}"
REGION="${GCP_REGION:-us-central1}"
REPOSITORY="${ARTIFACT_REPOSITORY:-urai-jobs}"
SERVICE_NAME="${URAI_WORKER_SERVICE_NAME:-urai-jobs-worker}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/worker:latest"
SERVICE_ACCOUNT="${WORKER_SERVICE_ACCOUNT_EMAIL:-}"

required=(
  URAI_ENV
  FIREBASE_PROJECT_ID
  GCLOUD_PROJECT
  GOOGLE_CLOUD_PROJECT
  GCP_REGION
  GCS_BUCKET_NAME
  NARRATOR_WORKER_URL
  ASSET_WORKER_URL
  SPATIAL_WORKER_URL
  STUDIO_WORKER_URL
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "[FAIL] Missing required env var: ${key}" >&2
    exit 1
  fi
  if [[ "${!key}" =~ replace-with|placeholder|YOUR_|dummy|fake|changeme ]]; then
    echo "[FAIL] ${key} contains a placeholder value" >&2
    exit 1
  fi
done

if [[ -z "${SERVICE_ACCOUNT}" ]]; then
  echo "[FAIL] WORKER_SERVICE_ACCOUNT_EMAIL is required for managed worker deployment" >&2
  exit 1
fi

echo "[INFO] Project: ${PROJECT_ID}"
echo "[INFO] Region: ${REGION}"
echo "[INFO] Artifact repository: ${REPOSITORY}"
echo "[INFO] Cloud Run service: ${SERVICE_NAME}"
echo "[INFO] Image: ${IMAGE}"

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  logging.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "[INFO] Creating Artifact Registry repository ${REPOSITORY}"
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location "${REGION}" \
    --description="URAI Jobs containers" \
    --project "${PROJECT_ID}"
fi

echo "[INFO] Building worker image"
gcloud builds submit . \
  --project "${PROJECT_ID}" \
  --config ops/cloudbuild-worker.yaml \
  --substitutions "_IMAGE=${IMAGE}"

echo "[INFO] Deploying Cloud Run worker"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --no-allow-unauthenticated \
  --no-cpu-throttling \
  --min-instances "${URAI_WORKER_MIN_INSTANCES:-1}" \
  --max-instances "${URAI_WORKER_MAX_INSTANCES:-2}" \
  --cpu "${URAI_WORKER_CPU:-1}" \
  --memory "${URAI_WORKER_MEMORY:-512Mi}" \
  --set-env-vars "URAI_ENV=${URAI_ENV},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID},GCLOUD_PROJECT=${GCLOUD_PROJECT},GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT},GCP_REGION=${GCP_REGION},URAI_WORKER_NAME=${URAI_WORKER_NAME:-cloud-run-worker},URAI_JOB_TYPE=${URAI_JOB_TYPE:-narrator.tts},URAI_WORKER_POLL_MS=${URAI_WORKER_POLL_MS:-2000},URAI_LEASE_MS=${URAI_LEASE_MS:-60000},URAI_MAX_ATTEMPTS=${URAI_MAX_ATTEMPTS:-3},GCS_BUCKET_NAME=${GCS_BUCKET_NAME},NARRATOR_WORKER_URL=${NARRATOR_WORKER_URL},ASSET_WORKER_URL=${ASSET_WORKER_URL},SPATIAL_WORKER_URL=${SPATIAL_WORKER_URL},STUDIO_WORKER_URL=${STUDIO_WORKER_URL}"

echo "[PASS] Managed worker deployed: ${SERVICE_NAME}"
