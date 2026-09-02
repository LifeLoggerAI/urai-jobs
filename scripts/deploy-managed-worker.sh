#!/usr/bin/env bash
set -euo pipefail

echo "[BLOCKED] The generic managed worker emits synthetic success and is not an approved production runtime." >&2
echo "[BLOCKED] Use scripts/deploy-workers.sh for the canonical Narrator and Asset workers." >&2
echo "[BLOCKED] Complete issues #65, #66, and #70 before introducing any replacement generic worker." >&2
exit 1
