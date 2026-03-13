#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="urai-jobs"
PROJECT_ID="urai-4dc1d"
TAG="v1.0.0-jobs-lock"
UTC_TS="$(date -u +%Y%m%d_%H%M%S)"
ROOT="$HOME/urai-jobs"
LOG="/tmp/${PROJECT_NAME}_ship_${UTC_TS}.log"

exec > >(tee -a "$LOG") 2>&1

echo "=== ${PROJECT_NAME} FINAL SHIP START (UTC $(date -u)) ==="
cd "$ROOT"

# -------------------------------
# 0) Sanity
# -------------------------------
node -v
npx --yes pnpm@8.15.9 -v
firebase --version

# -------------------------------
# 1) Clean
# -------------------------------
echo "--- clean ---"
rm -rf node_modules functions/node_modules .next dist out || true

# -------------------------------
# 2) Install (COREPACK-SAFE)
# -------------------------------
echo "--- install ---"
npx --yes pnpm@8.15.9 install --frozen-lockfile

# -------------------------------
# 3) Typecheck (safe)
# -------------------------------
echo "--- typecheck ---"
if [ -f tsconfig.json ]; then
  npx --yes pnpm@8.15.9 exec tsc --noEmit
else
  echo "No tsconfig.json — skipping typecheck"
fi

# -------------------------------
# 4) Build
# -------------------------------
echo "--- build ---"
npx --yes pnpm@8.15.9 run build

# -------------------------------
# 5) Deploy (functions only)
# -------------------------------
echo "--- firebase deploy ---"
firebase use "$PROJECT_ID"
firebase deploy --project "$PROJECT_ID" --only functions

# -------------------------------
# 6) Lock file
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
- Dependencies frozen
- Build complete
- Functions deployed
- Project frozen

Changes require version bump + explicit unlock.
LOCK

# -------------------------------
# 7) Git freeze
# -------------------------------
git add .
git commit -m "lock(urai-jobs): final ship + freeze ${TAG}" || true
git tag -f "${TAG}"
git push origin main
git push origin --tags

echo "=== ${PROJECT_NAME} LOCK COMPLETE (UTC $(date -u)) ==="
echo "LOG: $LOG"
