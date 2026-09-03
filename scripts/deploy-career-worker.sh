#!/usr/bin/env bash
set -euo pipefail

echo "[BLOCKED] career-worker is scaffold-only and is intentionally excluded from production deployment." >&2
echo "[BLOCKED] Complete issue #71 and the typed worker registry in issue #70 before enabling this service." >&2
exit 1
