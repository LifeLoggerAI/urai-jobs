#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-urai-jobs}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-urai-jobs-github-deploy}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"
WIF_PROVIDER="${WIF_PROVIDER:-}"
REPO_FULL_NAME="${REPO_FULL_NAME:-LifeLoggerAI/urai-jobs}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required and must be authenticated." >&2
  exit 1
}

GH=(gh)
if ! command -v gh >/dev/null 2>&1; then
  if command -v nix >/dev/null 2>&1; then
    GH=(nix shell nixpkgs#gh -c gh)
    echo "[WARN] gh is not installed permanently. Using nix shell nixpkgs#gh -c gh."
  else
    echo "[FAIL] GitHub CLI gh is required and must be authenticated." >&2
    exit 1
  fi
fi

if ! "${GH[@]}" auth status >/dev/null 2>&1; then
  echo "[FAIL] GitHub CLI is available but not authenticated." >&2
  exit 1
fi

if [ -z "$WIF_PROVIDER" ]; then
  echo "[FAIL] WIF_PROVIDER is required. Pass the full Workload Identity Provider resource name." >&2
  echo "[INFO] This script will not create or upload service-account keys." >&2
  exit 1
fi

echo "[INFO] Verifying deploy service account: ${SERVICE_ACCOUNT_EMAIL}"
gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null

echo "[INFO] Recording non-secret GitHub Actions WIF variables for ${REPO_FULL_NAME}"
"${GH[@]}" variable set GCP_WIF_PROVIDER --repo "${REPO_FULL_NAME}" --body "$WIF_PROVIDER"
"${GH[@]}" variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo "${REPO_FULL_NAME}" --body "$SERVICE_ACCOUNT_EMAIL"
"${GH[@]}" variable set URAI_JOBS_FIREBASE_PROJECT_ID --repo "${REPO_FULL_NAME}" --body "$PROJECT_ID"

echo "[PASS] WIF deploy variables configured."
echo "[INFO] No service-account key was created, downloaded, or uploaded to GitHub."
echo "[INFO] Provider-side WIF trust and least-privilege IAM bindings must be configured and validated separately before deployment."
