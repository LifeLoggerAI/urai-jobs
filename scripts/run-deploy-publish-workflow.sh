#!/usr/bin/env bash
set -euo pipefail

REPO_FULL_NAME="${REPO_FULL_NAME:-LifeLoggerAI/urai-jobs}"
WORKFLOW_FILE="${WORKFLOW_FILE:-production-deploy-publish.yml}"
CONFIRM_LAUNCH_UNLOCK="${CONFIRM_LAUNCH_UNLOCK:-LAUNCH-UNLOCK}"
DEPLOY_WORKERS="${DEPLOY_WORKERS:-true}"
RUN_SMOKE="${RUN_SMOKE:-false}"
REQUIRE_CUSTOM_DOMAINS="${REQUIRE_CUSTOM_DOMAINS:-false}"
REF="${REF:-main}"

GH=(gh)
if ! command -v gh >/dev/null 2>&1; then
  if command -v nix >/dev/null 2>&1; then
    GH=(nix shell nixpkgs#gh -c gh)
    echo "[WARN] gh is not installed permanently. Using nix shell nixpkgs#gh -c gh."
  else
    echo "[FAIL] GitHub CLI gh is required and must be authenticated." >&2
    echo "[INFO] Install gh or add pkgs.gh to dev.nix, then run: gh auth login" >&2
    exit 1
  fi
fi

if ! "${GH[@]}" auth status >/dev/null 2>&1; then
  echo "[FAIL] GitHub CLI is available but not authenticated." >&2
  echo "[INFO] Run: ${GH[*]} auth login" >&2
  exit 1
fi

echo "[INFO] Starting workflow ${WORKFLOW_FILE} in ${REPO_FULL_NAME} on ${REF}"
echo "[INFO] Inputs: deploy_workers=${DEPLOY_WORKERS}, run_smoke=${RUN_SMOKE}, require_custom_domains=${REQUIRE_CUSTOM_DOMAINS}"

"${GH[@]}" workflow run "${WORKFLOW_FILE}" \
  --repo "${REPO_FULL_NAME}" \
  --ref "${REF}" \
  -f "confirm_launch_unlock=${CONFIRM_LAUNCH_UNLOCK}" \
  -f "deploy_workers=${DEPLOY_WORKERS}" \
  -f "run_smoke=${RUN_SMOKE}" \
  -f "require_custom_domains=${REQUIRE_CUSTOM_DOMAINS}"

echo "[PASS] Workflow dispatched. Recent runs:"
"${GH[@]}" run list --repo "${REPO_FULL_NAME}" --workflow "${WORKFLOW_FILE}" --limit 5

echo "[INFO] To watch the newest run:"
echo "${GH[*]} run watch --repo ${REPO_FULL_NAME}"
