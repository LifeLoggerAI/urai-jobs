#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="urai-jobs"
PROJECT_ID="urai-4dc1d"
TAG="v1.0.0-jobs-lock"
UTC_TS="$(date -u +%Y%m%d_%H%M%S)"
LOG="/tmp/${PROJECT_NAME}_ship_${UTC_TS}.log"

exec > >(tee -a "$LOG") 2>&1

echo "=== ${PROJECT_NAME} FINAL SHIP START (UTC $(date -u)) ==="

# -------------------------------
# 0) Sanity
# -------------------------------
echo "--- sanity checks ---"
node -v
npm -v
firebase --version

# -------------------------------
# 1) Clean
# -------------------------------
echo "--- clean ---"
rm -rf functions/node_modules functions/lib

# -------------------------------
# 2) Install
# -------------------------------
echo "--- install ---"
npm install --prefix functions

# -------------------------------
# 3) Build
# -------------------------------
echo "--- build ---"
npm run build --workspace=functions

# -------------------------------
# 4) Deploy (functions only)
# -------------------------------
echo "--- firebase deploy ---"
firebase use "urai-4dc1d"
firebase deploy --project "urai-4dc1d" --only functions

# -------------------------------
# 5) Lock file
# -------------------------------
echo "--- lock ---"
cat > URAI_JOBS_LOCK.md <<LOCK
# URAI JOBS — LOCKED

Project: ${PROJECT_NAME}
Firebase: ${PROJECT_ID}
Tag: ${TAG}
Locked (UTC): $(date -u)

Commit: $(git rev-parse HEAD)

Status:
- Dependencies installed
- Build complete
- Functions deployed
- Project frozen

Changes require version bump + explicit unlock.
LOCK

# -------------------------------
# 6) Git freeze
# -------------------------------
echo "--- git freeze ---"
git add .
git commit -m "lock(urai-jobs): final ship + freeze ${TAG}" || true
git tag -f "${TAG}"

echo "=== ${PROJECT_NAME} LOCK COMPLETE (UTC $(date -u)) ==="
echo "LOG: $LOG"
