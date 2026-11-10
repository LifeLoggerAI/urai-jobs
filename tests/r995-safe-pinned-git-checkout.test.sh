#!/usr/bin/env bash
set -Eeuo pipefail
script=$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd -P)/r995-safe-pinned-git-checkout.sh
sandbox=$(mktemp -d /tmp/r995-checkout-tests.XXXXXXXX)
trap 'rm -rf -- "$sandbox"' EXIT
export R995_ALLOW_LOCAL_TEST_URL=1
passed=0
ok() { passed=$((passed + 1)); printf 'ok %d - %s\n' "$passed" "$1"; }
expect_fail() {
  local reason=$1; shift
  if "$@" >"$sandbox/failure.log" 2>&1; then
    printf 'not ok - %s unexpectedly passed\n' "$reason" >&2
    exit 1
  fi
  grep -q 'R995_CHECKOUT_DENIED:' "$sandbox/failure.log" || {
    printf 'not ok - %s lacked fail-closed marker\n' "$reason" >&2; cat "$sandbox/failure.log" >&2; exit 1;
  }
}

git init -q --bare "$sandbox/remote.git"
git init -q "$sandbox/source"
git -C "$sandbox/source" config user.name 'R995 Test'
git -C "$sandbox/source" config user.email 'r995@example.invalid'
printf 'pinned-source\n' > "$sandbox/source/data.txt"
git -C "$sandbox/source" add data.txt
git -C "$sandbox/source" commit -qm 'initial test commit'
sha=$(git -C "$sandbox/source" rev-parse HEAD)
git -C "$sandbox/source" remote add origin "$sandbox/remote.git"
git -C "$sandbox/source" push -q origin HEAD:refs/heads/main
uri="file://$sandbox/remote.git"
target="$sandbox/checkouts/jobs"

output=$(bash "$script" "$uri" "$sha" "$target")
[[ "$output" == *R995_CHECKOUT_CREATED* && "$(git -C "$target" rev-parse HEAD)" == "$sha" ]]
ok 'fresh staged checkout publishes exact 40-byte SHA after verification'

mv -- "$sandbox/remote.git" "$sandbox/remote.unavailable"
output=$(bash "$script" "$uri" "$sha" "$target")
[[ "$output" == *R995_CHECKOUT_REUSED* ]]
ok 'already-verified checkout is reusable without network or recloning'
mv -- "$sandbox/remote.unavailable" "$sandbox/remote.git"

expect_fail 'wrong full SHA' bash "$script" "$uri" 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$target"
[[ "$(git -C "$target" rev-parse HEAD)" == "$sha" ]]
ok 'mismatched exact SHA rejected without touching existing worktree'

printf 'dirty\n' >> "$target/data.txt"
expect_fail 'dirty worktree' bash "$script" "$uri" "$sha" "$target"
git -C "$target" restore data.txt
ok 'modified tracked file rejected'

printf 'new\n' > "$target/untracked.txt"
expect_fail 'untracked file' bash "$script" "$uri" "$sha" "$target"
rm -- "$target/untracked.txt"
ok 'untracked files rejected'

old_origin=$(git -C "$target" remote get-url origin)
git -C "$target" remote set-url origin 'file:///tmp/untrusted-origin.git'
expect_fail 'wrong origin' bash "$script" "$uri" "$sha" "$target"
git -C "$target" remote set-url origin "$old_origin"
ok 'wrong Git remote rejected'

mkdir -p "$sandbox/not-a-repo"
printf 'evidence-do-not-delete\n' > "$sandbox/not-a-repo/sentinel"
expect_fail 'ordinary directory' bash "$script" "$uri" "$sha" "$sandbox/not-a-repo"
[[ "$(cat "$sandbox/not-a-repo/sentinel")" == 'evidence-do-not-delete' ]]
ok 'existing non-repo directory and contents preserved'

ln -s "$target" "$sandbox/linked-dir"
expect_fail 'symlink destination' bash "$script" "$uri" "$sha" "$sandbox/linked-dir"
[[ -L "$sandbox/linked-dir" ]]
ok 'symlink target rejected without mutation'

mkdir -p "$target/nested"
expect_fail 'subdirectory in repo' bash "$script" "$uri" "$sha" "$target/nested"
rmdir "$target/nested"
ok 'nested Git checkout target rejected'

expect_fail 'invalid SHA' bash "$script" "$uri" 'abc' "$sandbox/checkouts/invalid"
[[ ! -e "$sandbox/checkouts/invalid" ]]
ok 'abbreviated or malformed SHA denied before filesystem mutation'

expect_fail 'unapproved URL' bash "$script" 'https://example.com/attacker.git' "$sha" "$sandbox/checkouts/invalid-url"
[[ ! -e "$sandbox/checkouts/invalid-url" ]]
ok 'unapproved repo URL denied before clone'

if R995_ALLOW_LOCAL_TEST_URL=0 bash "$script" "$uri" "$sha" "$sandbox/checkouts/without-test-switch" >"$sandbox/failure.log" 2>&1; then
  echo 'not ok - local test URL accepted with test switch disabled' >&2; exit 1;
fi
[[ ! -e "$sandbox/checkouts/without-test-switch" ]]
ok 'test-only file URL rejected by default'

expect_fail 'unreachable commit' bash "$script" "$uri" 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' "$sandbox/checkouts/unknown"
[[ ! -e "$sandbox/checkouts/unknown" ]]
if compgen -G "$sandbox/checkouts/.r995-pinned-source.*" >/dev/null; then
  echo 'not ok - failed clone left staging debris' >&2; exit 1
fi
ok 'failed exact-SHA fetch leaves no published target or staging debris'

[[ "$(git -C "$target" status --porcelain --untracked-files=all)" == '' ]]
[[ "$(git -C "$target" rev-parse HEAD)" == "$sha" ]]
ok 'verified worktree remains clean and points at original exact SHA'

printf 'R995_REGRESSION_PASS=%d\n' "$passed"
