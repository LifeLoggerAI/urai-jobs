#!/usr/bin/env bash
# R997: one-shot evidence-preserving source-pinned Jobs verification launcher.
# This is a review-only harness; DOES NOT control existing Runpod pods.
set -Eeuo pipefail
umask 077
fail() { printf 'R997_DENIED: %s\n' "$*" >&2; exit 2; }
(( $# == 4 )) || fail 'Usage: launcher REPO_URL EXACT_SHA CHECKOUT_DIR RECEIPT_DIR'
repo=$1 sha=$2 checkout=$3 receipt=$4
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail 'Invalid full commit SHA'
for p in "$checkout" "$receipt"; do
  [[ "$p" =~ ^/[A-Za-z0-9._/-]+$ && "$p" != / && "$p" != */ ]] || fail 'Paths must be safe absolute ASCII directories'
  case "/${p#/}/" in */../*|*/./*) fail 'Dot path components forbidden';; esac
  [[ ! -L "$p" ]] || fail 'Symlink endpoint forbidden'
done
[[ "$receipt" != "$checkout" && "$receipt" != "$checkout"/* && "$checkout" != "$receipt"/* ]] || fail 'Receipt and checkout must be separate'
# Parent canonicalization guards symlink aliases and path overlap.
checkout_parent=$(dirname -- "$checkout"); receipt_parent=$(dirname -- "$receipt")
[[ -d "$checkout_parent" && -d "$receipt_parent" ]] || fail 'Parent directories must exist'
real_checkout=$(cd -- "$checkout_parent" && pwd -P)/$(basename -- "$checkout")
real_receipt=$(cd -- "$receipt_parent" && pwd -P)/$(basename -- "$receipt")
[[ "$real_receipt" != "$real_checkout" && "$real_receipt" != "$real_checkout"/* && "$real_checkout" != "$real_receipt"/* ]] || fail 'Canonical receipt and checkout overlap'
[[ ! -e "$receipt" ]] || fail 'Receipt exists: one attempt only; preserve existing evidence'
command -v git >/dev/null || fail 'Git unavailable'
command -v timeout >/dev/null || fail 'timeout unavailable'
# Pin source *before* consuming an attempt. Failed preflight does not create receipt.
"$(dirname -- "${BASH_SOURCE[0]}")/r996-safe-pinned-git-checkout.sh" "$repo" "$sha" "$checkout" >/dev/null || fail 'Source attestation refused'
[[ ! -e "$receipt" ]] || fail 'Receipt appeared during source verification'
mkdir -m 700 -- "$receipt" || fail 'Receipt reservation failed; another execution may own it'
# The receipt directory reservation is permanent, even if native verification fails.
start_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
start_epoch=$(date -u +%s)
source_tree=$(git -C "$checkout" rev-parse 'HEAD^{tree}')
printf 'R997_ATTEMPT_CREATED sha=%s tree=%s started=%s\n' "$sha" "$source_tree" "$start_utc" > "$receipt/metadata.log"
status='NATIVE_TOOL_MISSING'
rc=127
if command -v pnpm >/dev/null 2>&1; then
  set +e
  (cd -- "$checkout" && timeout --signal=TERM --kill-after=5s 300s env CI=1 GIT_TERMINAL_PROMPT=0 pnpm urai-jobs:verify) >"$receipt/native.log" 2>&1
  rc=$?
  set -e
  status='FAILED'
  if (( rc == 0 )); then status='PASSED'; fi
  if (( rc == 124 || rc == 137 )); then status='TIMEOUT_OR_KILLED'; fi
else
  printf 'pnpm not installed; no native command attempted\n' > "$receipt/native.log"
fi
end_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
end_epoch=$(date -u +%s)
log_sha=$(sha256sum "$receipt/native.log" | awk '{print $1}')
printf '{"schema":"R997_NATIVE_VERIFY_V1","evidence_class":"LOCAL_SCRIPT_EXECUTION_NOT_PROTECTED_CI","source_sha":"%s","tree_sha":"%s","start_utc":"%s","end_utc":"%s","duration_seconds":%d,"exit_code":%d,"status":"%s","log_sha256":"%s"}\n' "$sha" "$source_tree" "$start_utc" "$end_utc" "$((end_epoch-start_epoch))" "$rc" "$status" "$log_sha" > "$receipt/receipt.json"
printf 'R997_NATIVE_STATUS=%s EXIT=%d RECEIPT=%s\n' "$status" "$rc" "$receipt"
# Propagate failure to any downstream automation; a receipt is not certification.
(( rc == 0 ))
