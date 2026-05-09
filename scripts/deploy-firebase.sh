#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-prod}"

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"

command -v firebase >/dev/null 2>&1 || {
  echo "[FAIL] firebase CLI is required" >&2
  exit 1
}

command -v pnpm >/dev/null 2>&1 || {
  echo "[FAIL] pnpm is required" >&2
  exit 1
}

if [ "$TARGET" != "prod" ] && [ "$TARGET" != "staging" ] && [ "$TARGET" != "dev" ]; then
  echo "[FAIL] TARGET must be dev, staging, or prod. Got: $TARGET" >&2
  exit 1
fi

echo "[INFO] Running production precheck for target=$TARGET"
pnpm prod:precheck

echo "[INFO] Building shared types, functions, and web"
pnpm --filter @urai-jobs/shared-types build
pnpm --filter urai-jobs-functions build
pnpm --filter urai-jobs-web build

echo "[INFO] Selecting Firebase target: $TARGET"
firebase use "$TARGET" || firebase use "$FIREBASE_PROJECT_ID"

echo "[INFO] Deploying Firebase Functions, Firestore rules/indexes, and Hosting"
firebase deploy --only functions,firestore,hosting --project "$FIREBASE_PROJECT_ID"

echo "[PASS] Firebase deployment completed for $FIREBASE_PROJECT_ID"
