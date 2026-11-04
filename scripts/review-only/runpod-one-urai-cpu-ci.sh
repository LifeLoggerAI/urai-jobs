#!/usr/bin/env bash
# ONE URAI Runpod CPU fallback verifier, review-only.
# Usage: bash runpod-one-urai-cpu-ci.sh <40-character immutable Jobs commit SHA>
# No deployment, cloud credentials, owner-consent issuance, media rendering, or release GO.
set -Eeuo pipefail
umask 077
export CI=1 GIT_TERMINAL_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NO_GCE_CHECK=true
unset GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY GOOGLE_APPLICATION_CREDENTIALS \
  GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT FIREBASE_TOKEN CLOUDSDK_CORE_PROJECT \
  CLOUD_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_OAUTH_ACCESS_TOKEN \
  AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY STRIPE_SECRET_KEY OPENAI_API_KEY || true

JOBS_SHA="$1"
if [[ ! "$JOBS_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "DENY: literal 40-character immutable Jobs SHA required"
  exit 64
fi
ROOT="$(mktemp -d /tmp/one-urai-runpod-cpu-ci-XXXXXX)"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"
STAGE="source"
START="$(date -u +%FT%TZ)"
finish() {
  local rc="$?"
  trap - EXIT
  echo "URAI_RUNPOD_CI_FINISHED=$(date -u +%FT%TZ)"
  echo "URAI_RUNPOD_CI_EXIT=$rc"
  echo "URAI_RUNPOD_CI_FINAL_STAGE=$STAGE"
  for name in model install shared functions typecheck verify emulators; do
    if [[ -f "$LOGS/$name.log" ]]; then
      echo "URAI_RUNPOD_CI_LOG_SHA256_$name=$(sha256sum "$LOGS/$name.log" | awk '{print $1}')"
    fi
  done
  if (( rc != 0 )) && [[ -f "$LOGS/$STAGE.log" ]]; then
    echo "URAI_RUNPOD_CI_FAILED_STAGE_TAIL_BEGIN"
    tail -n 35 "$LOGS/$STAGE.log" | sed -E 's/(token|authorization|api[_-]?key|password)=([^[:space:]]+)/\1=[REDACTED]/Ig' || true
    echo "URAI_RUNPOD_CI_FAILED_STAGE_TAIL_END"
  fi
  echo "URAI_RELEASE_PRODUCTION_AUTHORIZED=false"
  echo "URAI_RELEASE_VERDICT=HOLD"
  echo "URAI_NO_CUSTOMER_DATA=true"
  exit "$rc"
}
trap finish EXIT
run_stage() {
  local name="$1" max_s="$2"
  shift 2
  STAGE="$name"
  if timeout -k 10 "$max_s" "$@" >"$LOGS/$name.log" 2>&1; then
    echo "URAI_RUNPOD_CI_STAGE_$name=PASS"
  else
    echo "URAI_RUNPOD_CI_STAGE_$name=FAIL"
    return 1
  fi
}
echo "URAI_RUNPOD_CI_VERSION=1"
echo "URAI_RUNPOD_CI_START=$START"
echo "URAI_RUNPOD_CI_JOBS_SHA=$JOBS_SHA"
echo "URAI_RUNPOD_CI_MACHINE=$(uname -s)-$(uname -m)"
echo "URAI_RUNPOD_CI_NODE=$(node --version)"
echo "URAI_RUNPOD_CI_GIT=$(git --version)"
echo "URAI_RUNPOD_CI_RUNTIME_ONLY_NO_PRODUCTION=true"

STAGE="source"
mkdir -p "$ROOT/jobs"
git -C "$ROOT/jobs" init -q
git -C "$ROOT/jobs" remote add origin https://github.com/LifeLoggerAI/urai-jobs.git
timeout -k 10 90 git -C "$ROOT/jobs" fetch --quiet --depth 1 origin "$JOBS_SHA"
git -C "$ROOT/jobs" checkout --quiet --detach FETCH_HEAD
[[ "$(git -C "$ROOT/jobs" rev-parse HEAD)" == "$JOBS_SHA" ]]
echo "URAI_RUNPOD_CI_SOURCE_TREE=$(git -C "$ROOT/jobs" rev-parse HEAD^{tree})"
cd "$ROOT/jobs"
for f in package.json pnpm-lock.yaml \
  scripts/life-movie-writer-fence-race-model.test.mjs \
  scripts/life-movies-write-reservations.review-emulator.mjs \
  scripts/life-movies-late-write-storage-boundary.firebase-emulator.mjs \
  workers/studio-worker/private-output-write-authority.js; do
  [[ -f "$f" ]] || { echo "DENY: missing expected source $f"; exit 65; }
done
grep -q 'return false;' workers/studio-worker/private-output-write-authority.js ||
  { echo "DENY: Studio private-output hard-off absent"; exit 65; }
echo "URAI_RUNPOD_CI_HARD_OFF=PASS"

STAGE="toolchain"
corepack enable >/dev/null
corepack prepare pnpm@8.15.9 --activate >/dev/null 2>&1
echo "URAI_RUNPOD_CI_PNPM=$(pnpm --version)"
run_stage model 90 node --test scripts/life-movie-writer-fence-race-model.test.mjs
run_stage install 240 pnpm install --frozen-lockfile
run_stage shared 120 npm run build --prefix packages/shared-types
run_stage functions 150 npm run build --prefix functions
run_stage typecheck 150 npm run typecheck --prefix functions
run_stage verify 250 npm run urai-jobs:verify

# This local JS manifest is a reproducibility diagnostic, NOT signed provenance.
STAGE="manifest"
test -d functions/lib
find functions/lib -type f -name '*.js' -print | LC_ALL=C sort | while IFS= read -r f; do
  printf '%s  %s\n' "$(sha256sum "$f" | awk '{print $1}')" "$f"
done > "$LOGS/generated-manifest.txt"
echo "URAI_RUNPOD_CI_COMPILED_JS_FILES=$(wc -l < "$LOGS/generated-manifest.txt" | tr -d ' ')"
echo "URAI_RUNPOD_CI_COMPILED_MANIFEST_SHA256=$(sha256sum "$LOGS/generated-manifest.txt" | awk '{print $1}')"
echo "URAI_RUNPOD_CI_COMPILED_CONTENT_SHA256=$(awk '{print $1}' "$LOGS/generated-manifest.txt" | sha256sum | awk '{print $1}')"

# GREEN here means a security weakness was reproduced, NEVER release-safe.
run_stage emulators 350 env URAI_EMULATOR_PROJECT=urai-staging-test \
  npx --yes firebase-tools@15.24.0 emulators:exec \
  --project urai-staging-test --only firestore,storage \
  "npm run life-movies:write-fence:emulator:review"
STAGE="assertions"
grep -Fq 'R523_REVIEW_ONLY_FENCING_EMULATOR_PASS checks=11 productionAuthorized=false deletionAck=false' "$LOGS/emulators.log" ||
  { echo "DENY: fencing negative assertion missing"; exit 66; }
grep -Fq 'R522_REAL_FIREBASE_LATE_WRITE_BOUNDARY_REPRODUCED checks=10 privilegedBypassObserved=true' "$LOGS/emulators.log" ||
  { echo "DENY: late-write negative assertion missing"; exit 66; }
grep -Fq 'storageLevelFenceVerified=false productionAuthorized=false' "$LOGS/emulators.log" ||
  { echo "DENY: security HOLD marker missing"; exit 66; }
echo "URAI_RUNPOD_CI_EMULATOR_SECURITY_NEGATIVE=REPRODUCED"
echo "URAI_RUNPOD_CI_RESULT=PASS_REVIEW_TESTS_ONLY"
