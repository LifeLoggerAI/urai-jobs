#!/usr/bin/env bash
set -euo pipefail

# R526 / P0 #252: retired. Historic generic-worker bootstrap previously
# created buckets and granted broad Storage objectAdmin. Leaving the old
# mutating commands after an "exit" is unsafe because a future edit could
# accidentally make them reachable. They are intentionally removed here.
#
# New IAM must be provisioned through a separately reviewed least-privilege
# workflow with an exclusive writer, live IAM evidence and security approval.
# This file has no cloud commands and no environment flag can override it.
echo "[BLOCKED] MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF: no generic Storage IAM bootstrap; see Jobs #252." >&2
exit 1
