#!/bin/bash
set -euo pipefail

LOG_FILE="/tmp/urai_jobs_lock_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

# Verify Tools
command -v node >/dev/null 2>&1 || { echo >&2 "node not found"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo >&2 "pnpm not found"; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo >&2 "firebase not found"; exit 1; }

# Backup and Install
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
for file in firebase.json pnpm-workspace.yaml apps/jobs-web/package.json apps/jobs-web/next.config.mjs functions/package.json functions/src/index.ts; do
  if [ -f "$file" ]; then
    cp -a "$file" "$file.bak_$BACKUP_DATE"
  fi
done

pnpm install

# Lint, Typecheck, Build
pnpm -C apps/jobs-web lint
pnpm -C apps/jobs-web typecheck
pnpm -C apps/jobs-web build
pnpm -C functions build

# Emulator Smoke Test
firebase emulators:start --only auth,functions,firestore,storage &>/dev/null &
EMULATOR_PID=$!

sleep 10 # give emulators time to start

if curl -s http://localhost:5001/urai-jobs/us-central1/api | grep -q "Hello from URAI-JOBS API"; then
  echo "Smoke test passed"
else
  echo "Smoke test failed"
  kill $EMULATOR_PID
  exit 1
fi

kill $EMULATOR_PID

# Deploy
firebase deploy --only hosting,functions

echo "LOG_FILE: $LOG_FILE"
