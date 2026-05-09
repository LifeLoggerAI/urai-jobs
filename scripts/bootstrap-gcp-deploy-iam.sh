#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-urai-jobs}"
DEPLOY_SA="${DEPLOY_SA:-}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required." >&2
  exit 1
}

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[FAIL] GCP project '$PROJECT_ID' was not found or your active account cannot access it." >&2
  echo "[INFO] Active gcloud account:" >&2
  gcloud config get-value account >&2 || true
  echo "[INFO] Accessible projects:" >&2
  gcloud projects list --format='table(projectId,name)' >&2 || true
  echo "[INFO] Set PROJECT_ID to one of the projectId values above and rerun." >&2
  exit 1
fi

if [ -z "$DEPLOY_SA" ]; then
  DEPLOY_SA="$(gcloud iam service-accounts list \
    --project "$PROJECT_ID" \
    --filter='email~firebase-adminsdk' \
    --format='value(email)' \
    --limit=1)"
fi

if [ -z "$DEPLOY_SA" ]; then
  echo "[FAIL] Could not infer firebase-adminsdk service account for project $PROJECT_ID." >&2
  echo "Set DEPLOY_SA explicitly, then rerun." >&2
  exit 1
fi

echo "[INFO] Project: $PROJECT_ID"
echo "[INFO] Deploy service account: $DEPLOY_SA"

gcloud config set project "$PROJECT_ID"

echo "[INFO] Enabling required APIs."
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbilling.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  firebase.googleapis.com \
  firebaseextensions.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  serviceusage.googleapis.com \
  --project "$PROJECT_ID"

ROLES=(
  roles/artifactregistry.writer
  roles/cloudbuild.builds.editor
  roles/cloudfunctions.admin
  roles/datastore.indexAdmin
  roles/datastore.owner
  roles/firebase.admin
  roles/firebasehosting.admin
  roles/iam.serviceAccountUser
  roles/run.admin
  roles/serviceusage.serviceUsageAdmin
  roles/storage.admin
)

for role in "${ROLES[@]}"; do
  echo "[INFO] Granting $role to $DEPLOY_SA"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA}" \
    --role="$role" \
    --quiet >/dev/null
  echo "[PASS] $role"
done

echo "[PASS] GCP deploy IAM bootstrap complete. Rerun URAI Jobs Production Deploy with deploy_workers=false and run_smoke=false to continue Firebase deploy."
