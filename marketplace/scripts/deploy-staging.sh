#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Running marketplace preflight"
node tests/preflight.mjs

echo "Running marketplace security verification"
node tests/security-boundaries.mjs

echo "Running marketplace route smoke verification"
node tests/routes-smoke.mjs

echo "Running marketplace integration scaffold verification"
node tests/integration-runtime.mjs || true

echo "Staging deploy remains blocked until runtime integrations are complete"
