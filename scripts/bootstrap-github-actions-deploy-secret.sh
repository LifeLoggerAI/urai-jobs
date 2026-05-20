#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-urai-jobs}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-urai-jobs-github-deploy}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_NAME="${SECRET_NAME:-GCP_SERVICE_ACCOUNT_JSON}"
REPO_FULL_NAME="${REPO_FULL_NAME:-LifeLoggerAI/urai-jobs}"
KEY_FILE="${KEY_FILE:-./.tmp-${SERVICE_ACCOUNT_NAME}.json}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required and must be authenticated." >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || {
  echo "[FAIL] GitHub CLI gh is required and must be authenticated." >&2
  exit 1
}

echo "[INFO] Configuring deploy service account for project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "[INFO] Creating service account: ${SERVICE_ACCOUNT_EMAIL}"
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name "URAI Jobs GitHub Actions deploy" \
    --project "${PROJECT_ID}"
else
  echo "[PASS] Service account already exists: ${SERVICE_ACCOUNT_EMAIL}"
fi

ROLES=(
  "roles/firebase.admin"
  "roles/cloudfunctions.admin"
  "roles/run.admin"
  "roles/cloudbuild.builds.editor"
  "roles/iam.serviceAccountUser"
  "roles/artifactregistry.admin"
  "roles/storage.admin"
  "roles/datastore.owner"
)

for role in "${ROLES[@]}"; do
  echo "[INFO] Ensuring IAM role ${role}"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role "${role}" \
    --quiet >/dev/null
done

rm -f "${KEY_FILE}"
echo "[INFO] Creating short-lived local key file for GitHub secret upload: ${KEY_FILE}"
gcloud iam service-accounts keys create "${KEY_FILE}" \
  --iam-account "${SERVICE_ACCOUNT_EMAIL}" \
  --project "${PROJECT_ID}" >/dev/null

echo "[INFO] Uploading ${SECRET_NAME} to ${REPO_FULL_NAME}"
gh secret set "${SECRET_NAME}" \
  --repo "${REPO_FULL_NAME}" \
  --body "$(cat "${KEY_FILE}")"

rm -f "${KEY_FILE}"

echo "[PASS] GitHub Actions deploy secret configured: ${SECRET_NAME}"
echo "[INFO] Next: run the 'URAI Jobs Deploy Publish' workflow with confirm_launch_unlock=LAUNCH-UNLOCK, deploy_workers=true, run_smoke=false, require_custom_domains=false."
