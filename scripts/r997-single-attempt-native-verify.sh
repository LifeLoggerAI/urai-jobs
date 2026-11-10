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
# R1000: Explicit toolchain/dependency admission, before any real native test.
# A one-shot attempt installs dependencies only after clean HEAD attestation.
status='PRECHECK_FAILED'
rc=125
: > "$receipt/native.log"
: > "$receipt/install.log"
: > "$receipt/toolchain.log"
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  printf 'node and pnpm must both exist before native verification\n' > "$receipt/toolchain.log"
elif [[ ! -f "$checkout/package.json" || ! -f "$checkout/pnpm-lock.yaml" ]]; then
  printf 'package.json or pnpm-lock.yaml missing from pinned source\n' > "$receipt/toolchain.log"
else
  node_v=$(node --version 2>&1) || node_v='unavailable'
  pnpm_v=$(timeout 20s env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version 2>&1) || pnpm_v='unavailable'
  printf 'node_version=%s\npnpm_version=%s\nnode_path=%s\npnpm_path=%s\n' "$node_v" "$pnpm_v" "$(command -v node)" "$(command -v pnpm)" > "$receipt/toolchain.log"
  if [[ "$node_v" != v22.* || "$pnpm_v" != 8.15.9 ]]; then
    printf 'Pinned toolchain refused (requires Node 22 and pnpm 8.15.9)\n' >> "$receipt/toolchain.log"
  elif ! node - "$checkout/package.json" >> "$receipt/toolchain.log" 2>&1 <<'R1000_PACKAGE_CHECK'
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (pkg.packageManager !== 'pnpm@8.15.9' || typeof pkg.scripts?.['urai-jobs:verify'] !== 'string' || !pkg.scripts['urai-jobs:verify'].trim()) {
    process.stderr.write('Pinned packageManager or urai-jobs:verify script mismatch\n'); process.exit(1);
  }
} catch (e) { process.stderr.write(String(e) + '\n'); process.exit(1); }
R1000_PACKAGE_CHECK
  then
    printf 'Pinned package manifest refused\n' >> "$receipt/toolchain.log"
  else
    printf 'Pinned package manifest accepted\n' >> "$receipt/toolchain.log"
    set +e
    (cd -- "$checkout" && timeout --signal=TERM --kill-after=5s 180s env CI=1 GIT_TERMINAL_PROMPT=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile) > "$receipt/install.log" 2>&1
    rc=$?
    set -e
    if (( rc != 0 )); then
      status='INSTALL_FAILED'
      if (( rc == 124 || rc == 137 )); then status='INSTALL_TIMEOUT_OR_KILLED'; fi
      printf 'Native suite not attempted: frozen dependency install failed (exit %s)\n' "$rc" > "$receipt/native.log"
    else
      # Native tests may run only if installation did not alter tracked or
      # non-ignored source; ignored node_modules is expected after pnpm install.
      post_status=''; post_flags=''
      if ! post_status=$(git -C "$checkout" status --porcelain=v1 --untracked-files=all 2>&1) || \
         ! post_flags=$(git -C "$checkout" ls-files -v -- 2>/dev/null | LC_ALL=C awk '/^[a-zS]/ { if (!bad) bad=$0 } END { if (bad) print bad }') || \
         [[ -n "$post_status" || -n "$post_flags" || "$(git -C "$checkout" rev-parse HEAD 2>/dev/null)" != "$sha" ]]; then
        status='SOURCE_MUTATED_AFTER_INSTALL'
        rc=126
        printf 'Native suite not attempted: frozen install changed protected source or index flags\n%s\n%s\n' "$post_status" "$post_flags" > "$receipt/native.log"
      else
        set +e
        (cd -- "$checkout" && timeout --signal=TERM --kill-after=5s 300s env CI=1 GIT_TERMINAL_PROMPT=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm urai-jobs:verify) > "$receipt/native.log" 2>&1
        rc=$?
        set -e
        status='FAILED'
        if (( rc == 0 )); then status='PASSED'; fi
        if (( rc == 124 || rc == 137 )); then status='TIMEOUT_OR_KILLED'; fi
      fi
    fi
  fi
fi
if [[ "$status" == PRECHECK_FAILED ]]; then
  printf 'Native suite not attempted: toolchain precheck failed\n' > "$receipt/native.log"
fi
end_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
end_epoch=$(date -u +%s)
log_sha=$(sha256sum "$receipt/native.log" | awk '{print $1}')
install_sha=$(sha256sum "$receipt/install.log" | awk '{print $1}')
toolchain_sha=$(sha256sum "$receipt/toolchain.log" | awk '{print $1}')
printf '{"schema":"R1000_NATIVE_VERIFY_V1","evidence_class":"LOCAL_SCRIPT_EXECUTION_NOT_PROTECTED_CI","source_sha":"%s","tree_sha":"%s","start_utc":"%s","end_utc":"%s","duration_seconds":%d,"exit_code":%d,"status":"%s","log_sha256":"%s","install_log_sha256":"%s","toolchain_log_sha256":"%s"}\n' "$sha" "$source_tree" "$start_utc" "$end_utc" "$((end_epoch-start_epoch))" "$rc" "$status" "$log_sha" "$install_sha" "$toolchain_sha" > "$receipt/receipt.json"
printf 'R1000_NATIVE_STATUS=%s EXIT=%d RECEIPT=%s\n' "$status" "$rc" "$receipt"
# Propagate the *actual* native process status to downstream automation.
# A receipt is not certification.
exit "$rc"
