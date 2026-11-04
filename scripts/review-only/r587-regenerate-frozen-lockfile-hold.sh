#!/usr/bin/env bash
# R587 — offline review-only dependency freeze repair. NEVER enables a worker or release.
# Run in a disposable checkout of Jobs PR #269 after verifying the exact source tree.
set -Eeuo pipefail
umask 077
export CI=1 GIT_TERMINAL_PROMPT=0 NO_GCE_CHECK=true
export NEXT_TELEMETRY_DISABLED=1
unset GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT CLOUDSDK_CORE_PROJECT GOOGLE_OAUTH_ACCESS_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY STRIPE_SECRET_KEY OPENAI_API_KEY || true

expected_base=12b0fdda591d548d032a02cc43aa2d7d471bf96a
expected_tree=743b66280918029d4770bc9821f1153b0a796428
old_lock=bf84bc10a13a889f5a24ac7c5b540480110a1219
new_lock=197b02617cb068f94fc06b2bb709ccfa4cc151df
stage=preflight
logs_dir=$(mktemp -d "${TMPDIR:-/tmp}/urai-r587-lock-XXXXXX")
finish() {
  rc=$?
  trap - EXIT
  echo "R587_REPRO_STAGE=$stage"
  echo "R587_REPRO_EXIT=$rc"
  for name in resolve frozen maintained functions_build functions_types; do
    if test -f "$logs_dir/$name.log"; then
      printf 'R587_LOG_SHA_%s=%s\n' "$name" "$(sha256sum "$logs_dir/$name.log" | cut -d ' ' -f 1)"
    fi
  done
  echo "R587_PRODUCTION_AUTHORIZED=false"
  echo "R587_RELEASE_VERDICT=HOLD"
  exit "$rc"
}
trap finish EXIT

test "$(git rev-parse HEAD)" = "$expected_base" || { echo "HOLD: checkout must be exact original #269 head"; exit 11; }
test "$(git rev-parse HEAD^{tree})" = "$expected_tree" || { echo "HOLD: source tree drift"; exit 12; }
test "$(git hash-object package-lock.json)" = "$old_lock" || { echo "HOLD: original lockfile drift"; exit 13; }
test -z "$(git status --porcelain -- package-lock.json)" || { echo "HOLD: lockfile has edits"; exit 14; }
test "$(node --version | cut -d . -f 1)" = "v22" || { echo "HOLD: Node 22 required"; exit 15; }
test "$(npm --version)" = "10.9.9" || { echo "HOLD: tested npm version 10.9.9 required"; exit 16; }
echo "R587_ORIGINAL_LOCK_BLOB=$old_lock"
echo "R587_EXACT_TREE=$expected_tree"

stage=resolve
if ! npm install --package-lock-only --ignore-scripts --no-audit --no-fund >"$logs_dir/resolve.log" 2>&1; then
  echo "HOLD: deterministic lockfile resolver failed"; tail -n 30 "$logs_dir/resolve.log"; exit 20
fi
test "$(git hash-object package-lock.json)" = "$new_lock" || { echo "HOLD: regenerated lockfile does not match original tested bytes"; exit 21; }
echo "R587_REGENERATED_LOCK_BLOB=$new_lock"
echo "R587_LOCK_DIFF_NUMSTAT=$(git diff --numstat -- package-lock.json | tr '\t' '/')"

stage=frozen
if ! npm ci --ignore-scripts --no-audit --no-fund >"$logs_dir/frozen.log" 2>&1; then
  echo "HOLD: frozen clean install failed"; tail -n 30 "$logs_dir/frozen.log"; exit 22
fi
echo "R587_FROZEN_INSTALL=PASS"

stage=maintained
if ! { npm run build --prefix packages/shared-types && npm run urai-jobs:verify; } >"$logs_dir/maintained.log" 2>&1; then
  echo "HOLD: maintained Jobs verification failed"; tail -n 40 "$logs_dir/maintained.log"; exit 23
fi
echo "R587_MAINTAINED_JOBS=PASS"

stage=functions_build
if ! npm run build --prefix functions >"$logs_dir/functions_build.log" 2>&1; then
  echo "HOLD: Functions build failed"; tail -n 40 "$logs_dir/functions_build.log"; exit 24
fi
echo "R587_FUNCTIONS_BUILD=PASS"

stage=functions_types
if ! npm run typecheck --prefix functions >"$logs_dir/functions_types.log" 2>&1; then
  echo "HOLD: Functions typecheck failed"; tail -n 40 "$logs_dir/functions_types.log"; exit 25
fi
echo "R587_FUNCTIONS_TYPECHECK=PASS"
echo "R587_REPRODUCTION=PASS_NOT_RELEASE"
echo "R587_REVIEW_ONLY_NO_COMMIT_OR_DEPLOY=true"
