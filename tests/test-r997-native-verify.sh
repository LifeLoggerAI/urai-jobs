#!/usr/bin/env bash
set -Eeuo pipefail
runner=$(cd "$(dirname "$0")/../scripts" && pwd -P)/r997-single-attempt-native-verify.sh
sandbox=$(mktemp -d /tmp/r997-native-tests.XXXXXXXX)
trap 'rm -rf -- "$sandbox"' EXIT
export R996_ALLOW_LOCAL_TEST_URL=1
mkdir -p "$sandbox/bin" "$sandbox/checkouts" "$sandbox/receipts"
git init -q --bare "$sandbox/remote.git"
git init -q "$sandbox/source"
git -C "$sandbox/source" config user.email test@example.invalid
git -C "$sandbox/source" config user.name Test
printf 'safe-source\n' > "$sandbox/source/entry.txt"
cat > "$sandbox/source/package.json" <<'PACKAGE_JSON'
{"name":"test-jobs","packageManager":"pnpm@8.15.9","scripts":{"urai-jobs:verify":"echo test"}}
PACKAGE_JSON
printf "lockfileVersion: '6.0'\n" > "$sandbox/source/pnpm-lock.yaml"
git -C "$sandbox/source" add entry.txt package.json pnpm-lock.yaml
git -C "$sandbox/source" commit -qm init
sha=$(git -C "$sandbox/source" rev-parse HEAD)
git -C "$sandbox/source" remote add origin "$sandbox/remote.git"
git -C "$sandbox/source" push -q origin HEAD:refs/heads/main
uri="file://$sandbox/remote.git"
cat > "$sandbox/bin/pnpm" <<'SH'
#!/bin/sh
if [ "${1:-}" = "--version" ]; then printf '%s\n' "${R1000_MOCK_VERSION:-8.15.9}"; exit 0; fi
if [ "${1:-}" = "install" ]; then
  printf 'MOCK_FROZEN_INSTALL %s\n' "${2:-}"
  if [ "${R1000_MOCK_INSTALL_FAIL:-0}" = 1 ]; then exit 17; fi
  if [ "${R1000_MOCK_INSTALL_TAMPER:-0}" = 1 ]; then printf 'changed by install\n' >> entry.txt; fi
  exit 0
fi
[ "${1:-}" = "urai-jobs:verify" ] || exit 45
printf 'MOCK_NATIVE_TEST_RAN\n' 
if [ "${R997_MOCK_FAIL:-0}" = 1 ]; then exit 12; fi
if [ -n "${R999_MOCK_EXIT:-}" ]; then exit "$R999_MOCK_EXIT"; fi
if [ "${R997_MOCK_SLEEP:-0}" = 1 ]; then sleep 999; fi
exit 0
SH
chmod +x "$sandbox/bin/pnpm"
export PATH="$sandbox/bin:$PATH"
ok=0
pass() { ok=$((ok+1)); printf 'ok %s - %s\n' "$ok" "$1"; }
denied() { local label=$1;shift; if "$@" > "$sandbox/deny.log" 2>&1; then echo "unexpected success: $label" >&2; exit 1;fi; grep -Eq 'R997_DENIED:|R996_CHECKOUT_DENIED:' "$sandbox/deny.log" || { cat "$sandbox/deny.log";exit 1;}; pass "$label"; }
target="$sandbox/checkouts/jobs";rec="$sandbox/receipts/success"
out=$(bash "$runner" "$uri" "$sha" "$target" "$rec")
[[ "$out" == *R1000_NATIVE_STATUS=PASSED* ]]
grep -q MOCK_NATIVE_TEST_RAN "$rec/native.log"
grep -q 'MOCK_FROZEN_INSTALL --frozen-lockfile' "$rec/install.log"
grep -q '"install_log_sha256"' "$rec/receipt.json"
grep -q '"exit_code":0' "$rec/receipt.json"
pass 'first real local source checkout and native stub writes immutable success receipt'

denied 'same attempt cannot run twice' bash "$runner" "$uri" "$sha" "$target" "$rec"
[[ $(grep -c MOCK_NATIVE_TEST_RAN "$rec/native.log") == 1 ]]
pass 'duplicate attempt does not overwrite prior receipt'

mv "$sandbox/remote.git" "$sandbox/remote.unavailable"
out=$(bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/reused")
[[ "$out" == *R1000_NATIVE_STATUS=PASSED* ]]
pass 'pinned clean checkout reuses source without network'
mv "$sandbox/remote.unavailable" "$sandbox/remote.git"

# Real GitHub source checkouts may lack an executable bit on the helper.
# The runner must invoke the helper through bash rather than direct exec.
helper="$(dirname "$runner")/r996-safe-pinned-git-checkout.sh"
chmod a-x "$helper"
out=$(bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/nonexec-helper")
[[ "$out" == *R1000_NATIVE_STATUS=PASSED* ]]
[[ -f "$sandbox/receipts/nonexec-helper/receipt.json" ]]
chmod +x "$helper"
pass 'non-executable helper in Git checkout is invoked via bash'

printf 'tampered\n' >> "$target/entry.txt"
denied 'dirty checkout fails before receipt created' bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/dirty"
[[ ! -e "$sandbox/receipts/dirty" ]]
git -C "$target" restore entry.txt
pass 'preflight failure keeps attempted receipt slot reusable'

mkdir -p "$target/build"; echo junk > "$target/build/test.txt"; printf 'build/\n' >> "$target/.git/info/exclude"
denied 'ignored output denied' bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/ignored"
[[ ! -e "$sandbox/receipts/ignored" ]]
rm -rf "$target/build"; :> "$target/.git/info/exclude"

git -C "$target" update-index --assume-unchanged entry.txt
printf 'hidden\n' >> "$target/entry.txt"
denied 'assume-unchanged masked edit denied' bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/masked"
git -C "$target" update-index --no-assume-unchanged entry.txt
git -C "$target" restore entry.txt

export R997_MOCK_FAIL=1
set +e
bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/failed" > "$sandbox/failed.log" 2>&1
failure_rc=$?
set -e
[[ "$failure_rc" -eq 12 ]] || { printf 'expected rc 12 got %s\n' "$failure_rc" >&2; exit 1; }
[[ -f "$sandbox/receipts/failed/receipt.json" ]]
grep -q '"exit_code":12' "$sandbox/receipts/failed/receipt.json"
grep -q '"status":"FAILED"' "$sandbox/receipts/failed/receipt.json"
pass 'failed native command has preserved receipt and propagates exact exit status 12'
unset R997_MOCK_FAIL

export R999_MOCK_EXIT=43
set +e
bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/exit43" > "$sandbox/exit43.log" 2>&1
failure_rc=$?
set -e
[[ "$failure_rc" -eq 43 ]] || { printf 'expected rc 43 got %s\n' "$failure_rc" >&2; exit 1; }
grep -q '"exit_code":43' "$sandbox/receipts/exit43/receipt.json"
grep -q '"status":"FAILED"' "$sandbox/receipts/exit43/receipt.json"
pass 'nonstandard native exit 43 is preserved at launcher boundary'
unset R999_MOCK_EXIT

denied 'reject overlapping receipt within checkout' bash "$runner" "$uri" "$sha" "$target" "$target/rec"
mkdir -p "$sandbox/checkouts/outside"
ln -s "$target" "$sandbox/alias-checkout"
denied 'reject symlink parent alias of checkout' bash "$runner" "$uri" "$sha" "$target" "$sandbox/alias-checkout/x"

denied 'reject abbreviated SHA' bash "$runner" "$uri" badsha "$target" "$sandbox/receipts/badsha"
denied 'reject dot-dot path' bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/../escapes"

git -C "$target" update-index --skip-worktree entry.txt
printf 'more-hidden\n' >> "$target/entry.txt"
denied 'skip-worktree masked edit denied' bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/skip"
git -C "$target" update-index --no-skip-worktree entry.txt
git -C "$target" restore entry.txt

# The test does not consume paid compute, real providers, or authentic protected CI.
export R1000_MOCK_VERSION=9.0.0
set +e
bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/wrong-version" > "$sandbox/wrong-version.log" 2>&1
wrong_version_rc=$?
set -e
[[ "$wrong_version_rc" -eq 125 ]]
grep -q '"status":"PRECHECK_FAILED"' "$sandbox/receipts/wrong-version/receipt.json"
pass 'wrong pnpm version fails closed before install or native test'
unset R1000_MOCK_VERSION

export R1000_MOCK_INSTALL_FAIL=1
set +e
bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/install-fail" > "$sandbox/install-fail.log" 2>&1
install_rc=$?
set -e
[[ "$install_rc" -eq 17 ]]
grep -q '"status":"INSTALL_FAILED"' "$sandbox/receipts/install-fail/receipt.json"
! grep -q MOCK_NATIVE_TEST_RAN "$sandbox/receipts/install-fail/native.log"
pass 'failed dependency install preserves exact code and skips native suite'
unset R1000_MOCK_INSTALL_FAIL

export R1000_MOCK_INSTALL_TAMPER=1
set +e
bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/install-tamper" > "$sandbox/install-tamper.log" 2>&1
mutation_rc=$?
set -e
[[ "$mutation_rc" -eq 126 ]]
grep -q '"status":"SOURCE_MUTATED_AFTER_INSTALL"' "$sandbox/receipts/install-tamper/receipt.json"
! grep -q MOCK_NATIVE_TEST_RAN "$sandbox/receipts/install-tamper/native.log"
pass 'frozen install cannot mutate tracked source before native suite'
unset R1000_MOCK_INSTALL_TAMPER

printf 'R1000_TEST_PASS=%d\n' "$ok"
