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
git -C "$sandbox/source" add entry.txt
git -C "$sandbox/source" commit -qm init
sha=$(git -C "$sandbox/source" rev-parse HEAD)
git -C "$sandbox/source" remote add origin "$sandbox/remote.git"
git -C "$sandbox/source" push -q origin HEAD:refs/heads/main
uri="file://$sandbox/remote.git"
cat > "$sandbox/bin/pnpm" <<'SH'
#!/bin/sh
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
[[ "$out" == *R997_NATIVE_STATUS=PASSED* ]]
grep -q MOCK_NATIVE_TEST_RAN "$rec/native.log"
grep -q '"exit_code":0' "$rec/receipt.json"
pass 'first real local source checkout and native stub writes immutable success receipt'

denied 'same attempt cannot run twice' bash "$runner" "$uri" "$sha" "$target" "$rec"
[[ $(grep -c MOCK_NATIVE_TEST_RAN "$rec/native.log") == 1 ]]
pass 'duplicate attempt does not overwrite prior receipt'

mv "$sandbox/remote.git" "$sandbox/remote.unavailable"
out=$(bash "$runner" "$uri" "$sha" "$target" "$sandbox/receipts/reused")
[[ "$out" == *R997_NATIVE_STATUS=PASSED* ]]
pass 'pinned clean checkout reuses source without network'
mv "$sandbox/remote.unavailable" "$sandbox/remote.git"

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
printf 'R999_TEST_PASS=%d\n' "$ok"
