#!/bin/bash
set -euo pipefail

# Smoke test
if curl --fail http://localhost:5001/urai-jobs/us-central1/api; then
  echo "Smoke test passed!"
else
  echo "Smoke test failed!"
  exit 1
fi
