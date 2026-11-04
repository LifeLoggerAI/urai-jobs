#!/usr/bin/env bash
set -euo pipefail

# R525 / Jobs #252: historical bootstrap grants generic objectAdmin on a
# worker bucket. Until each bucket/principal is independently reconciled,
# this entry point must not create identities, enable services or grant IAM.
# This is an unconditional *source-level* veto, not proof against old grants.
echo "[BLOCKED] MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF: restricted scoped broker and IAM review required (Jobs #252)." >&2
exit 1
