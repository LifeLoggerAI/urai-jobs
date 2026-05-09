#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-urai-jobs-60331881}"
DEPLOY_SA="${DEPLOY_SA:-}"

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

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required." >&2
  exit 1
}

echo "[INFO] Project: $PROJECT_ID"
echo "[INFO] Deploy service account: $DEPLOY_SA"

gcloud config set project "$PROJECT_ID"

echo "[INFO] Enabling required APIs."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT_ID"

ROLES=(
  roles/cloudbuild.builds.editor
  roles/run.admin
  roles/storage.admin
  roles/artifactregistry.writer
  roles/iam.serviceAccountUser
)

for role in "${ROLES[@]}"; do
  echo "[INFO] Granting $role to $DEPLOY_SA"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA}" \
    --role="$role" \
    --quiet >/dev/null
  echo "[PASS] $role"
done

echo "[PASS] GCP deploy IAM bootstrap complete. Rerun URAI Jobs Production Deploy with deploy_workers=true and run_smoke=false."
