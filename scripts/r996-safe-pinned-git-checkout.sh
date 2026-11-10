#!/usr/bin/env bash
# Review-only R996 source verifier for the exact urai-jobs commit and tree.
# Reuses a clean, matching checkout; never deletes or repairs a mismatched one.
set -Eeuo pipefail

fail() {
  printf 'R996_CHECKOUT_DENIED: %s\n' "$*" >&2
  exit 2
}

(( $# == 3 )) || fail 'Usage: r996-safe-pinned-git-checkout.sh REPO_URL FULL_COMMIT_SHA ABSOLUTE_TARGET_DIR'
repo=$1
expected=$2
target=$3

[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || fail 'Expected commit must be an exact 40-character lowercase SHA-1'
case "$repo" in
  'https://github.com/LifeLoggerAI/urai-jobs.git') ;;
  file:///*)
    [[ "${R996_ALLOW_LOCAL_TEST_URL:-0}" == 1 ]] || fail 'Local file URL is test-only'
    ;;
  *) fail 'Repository URL is not the approved urai-jobs origin' ;;
esac
[[ "$target" == /* && "$target" != / && "$target" != */ ]] || fail 'Target must be a non-root absolute directory path'
[[ ! -L "$target" ]] || fail 'Refusing symlink target'

parent=$(dirname -- "$target")
base=$(basename -- "$target")
[[ "$base" != . && "$base" != .. ]] || fail 'Invalid checkout basename'
mkdir -p -- "$parent"
parent=$(cd -- "$parent" && pwd -P)
target="$parent/$base"
[[ ! -L "$target" ]] || fail 'Refusing symlink after resolving parent'

authenticate_checkout() {
  local workdir=$1 top actual origin dirty tree
  [[ -d "$workdir" && ! -L "$workdir" ]] || fail 'Existing checkout is not a real directory'
  top=$(git -C "$workdir" rev-parse --show-toplevel 2>/dev/null) || fail 'Existing directory is not a Git checkout'
  top=$(cd -- "$top" && pwd -P)
  [[ "$top" == "$(cd -- "$workdir" && pwd -P)" ]] || fail 'Target points inside another Git checkout'
  origin=$(git -C "$workdir" remote get-url origin 2>/dev/null) || fail 'Checkout is missing origin'
  [[ "$origin" == "$repo" ]] || fail 'Origin mismatch; will not overwrite checkout'
  actual=$(git -C "$workdir" rev-parse HEAD 2>/dev/null) || fail 'Checkout has no commit HEAD'
  [[ "$actual" == "$expected" ]] || fail "HEAD mismatch: expected $expected actual $actual"
  # In contrast to plain git status, --ignored=matching reveals ignored build/dependency
  # artifacts. Reusing these can alter execution despite an exact HEAD source pin.
  dirty=$(git -C "$workdir" status --porcelain=v1 --untracked-files=all --ignored=matching 2>/dev/null) || fail 'Cannot determine Git worktree state'
  [[ -z "$dirty" ]] || fail 'Checkout contains modified, untracked, or ignored files'
  # Git index flags can conceal edited tracked source from status: both lower-case
  # assume-unchanged and upper-case skip-worktree have to be rejected explicitly.
  # Read the entire list without an early-exit SIGPIPE under set -o pipefail.
  local index_flags
  index_flags=$(git -C "$workdir" ls-files -v -- 2>/dev/null | LC_ALL=C awk '/^[a-zS]/ { if (!bad) bad=$0 } END { if (bad) print bad }') || fail 'Cannot audit Git index flags'
  [[ -z "$index_flags" ]] || fail 'Checkout contains masked source index flags (assume-unchanged or skip-worktree)'
  tree=$(git -C "$workdir" rev-parse 'HEAD^{tree}' 2>/dev/null) || fail 'Cannot read source tree'
  printf 'R996_PIN_VERIFIED commit=%s tree=%s\n' "$actual" "$tree"
}

if [[ -e "$target" ]]; then
  authenticate_checkout "$target"
  printf 'R996_CHECKOUT_REUSED target=%s\n' "$target"
  exit 0
fi

staging=$(mktemp -d "$parent/.r995-pinned-source.XXXXXXXX") || fail 'Failed to create private staging directory'
cleanup() {
  if [[ -n "${staging:-}" && -d "$staging" && ! -L "$staging" ]]; then
    rm -rf -- "$staging"
  fi
}
trap cleanup EXIT

# A fresh path is populated only after a complete, exact-SHA checkout passes.
git init -q "$staging" || fail 'Unable to initialize staged checkout'
git -C "$staging" remote add origin "$repo" || fail 'Unable to set staged origin'
# This is deliberately one network attempt, not a billable retry loop.
if ! timeout 180s env GIT_TERMINAL_PROMPT=0 git -C "$staging" fetch -q --no-tags --depth=1 origin "$expected"; then
  fail 'One-shot exact SHA fetch failed; no target was published'
fi
git -C "$staging" checkout -q --detach FETCH_HEAD || fail 'Exact detached checkout failed'
authenticate_checkout "$staging"
[[ ! -e "$target" && ! -L "$target" ]] || fail 'Target appeared during fetch; refusing overwrite'
mv -T -- "$staging" "$target" || fail 'Atomic checkout publication failed'
staging=''
authenticate_checkout "$target"
printf 'R996_CHECKOUT_CREATED target=%s\n' "$target"
