#!/bin/bash
set -euo pipefail
set +H

# Install dependencies
pnpm install --workspace-root

# Lint and typecheck
(cd functions && pnpm lint && pnpm typecheck)

# Run tests
(cd functions && pnpm test)

# Build functions
(cd functions && pnpm build)

# Run smoke tests
if [ -n "${CI:-}" ]; then
  echo "Skipping smoke tests in CI"
else
  ./scripts/smoke_jobs.sh
fi

# Deploy if requested
if [ "${DEPLOY:-0}" -eq 1 ]; then
  ./scripts/deploy_jobs.sh
fi
