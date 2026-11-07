#!/usr/bin/env bash
# R876: exact-source, disposable-emulator-only review runner. NOT production approval.
# Tests replay an old privileged Storage write to demonstrate why GCS IAM proof
# and a real in-flight upload drain remain separate, unresolved P0 release gates.
set -Eeuo pipefail
umask 077

hold() { printf 'URAI_R876_HOLD: %s\n' "$*" >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT='d51a66a4c7433c2b58fa7d789f82c4f38d8983ba'
PROJECT='urai-staging-test'
SCOPE='DISPOSABLE_FIREBASE_EMULATORS_ONLY'

[[ "${1:-}" == '--run-exact-review-only' ]] || hold 'Explicit --run-exact-review-only required'
[[ "${URAI_R876_ACCEPTANCE_SCOPE:-}" == "$SCOPE" ]] || hold "Set URAI_R876_ACCEPTANCE_SCOPE=$SCOPE"
EXPECTED="${URAI_JOBS_ACCEPTANCE_SHA:-}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || hold 'Full reviewed URAI_JOBS_ACCEPTANCE_SHA required'
for cmd in git node pnpm npx java sha256sum mktemp timeout grep tail; do
  command -v "$cmd" >/dev/null 2>&1 || hold "Missing command: $cmd"
done
[[ "$(node --version)" == v22.* ]] || hold 'Node 22 required'
[[ "$(pnpm --version)" == 8.15.9 ]] || hold 'pnpm 8.15.9 required'
cd "$ROOT"
[[ "$(git rev-parse --show-toplevel 2>/dev/null)" == "$ROOT" ]] || hold 'Must run from complete Jobs checkout'
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || hold 'Actual Git HEAD differs from declared reviewed SHA'
git merge-base --is-ancestor "$PARENT" HEAD 2>/dev/null || hold 'PR #336 source is not an ancestor (full history required)'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || hold 'Source working tree is not clean'

# Every critical file must match the same original, independently reviewed Git blob.
# This script belongs on a child branch: do not hardcode a future self-referential HEAD.
check_blob() {
  local path="$1" hash="$2"
  [[ -f "$path" ]] || hold "Source file missing: $path"
  [[ "$(git hash-object -- "$path")" == "$hash" ]] || hold "Source mismatch: $path"
}
check_blob 'functions/src/privacy/lifeMovieGenerationEvidenceReview.ts' '5e0e94736aa783d20e3b5158ac3204ce25e89972'
check_blob 'scripts/life-movie-generation-evidence-review.test.mjs' 'a2b6d7118b0341f48c343724ae9408d7935c23b3'
check_blob 'scripts/life-movie-generation-evidence-matrix.test.mjs' '39d73f873714d4c35106b08b164f2036431cda50'
check_blob 'scripts/life-movies-review-only-physical-broker.firebase-emulator.mjs' 'd7cf29fbfd70ffcdf942543a5da7478d9f6888eb'
check_blob 'scripts/run-r854-private-storage-p0-negative-native.sh' '19d078daf110c1ac633aa535b583918a43e568a6'
check_blob 'workers/studio-worker/private-output-write-authority.js' 'ea6b25f3949ec2c17f65a9da68fa9cf937e86e76'

for name in GOOGLE_APPLICATION_CREDENTIALS GOOGLE_APPLICATION_CREDENTIALS_JSON \
  FIREBASE_TOKEN FIREBASE_CLI_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN \
  GOOGLE_CLOUD_ACCESS_TOKEN FIREBASE_CONFIG GCS_BUCKET_NAME \
  FIREBASE_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_BUCKET \
  GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY STRIPE_SECRET_KEY OPENAI_API_KEY; do
  [[ -z "$(printenv "$name" 2>/dev/null || true)" ]] || hold "Credential/bucket environment is forbidden: $name"
done
for name in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT CLOUDSDK_CORE_PROJECT FIREBASE_PROJECT_ID URAI_EMULATOR_PROJECT; do
  value="$(printenv "$name" 2>/dev/null || true)"
  [[ -z "$value" || "$value" == "$PROJECT" ]] || hold "Non-disposable project in $name"
done
for name in FIRESTORE_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST \
  FIREBASE_AUTH_EMULATOR_HOST FIREBASE_FUNCTIONS_EMULATOR_HOST; do
  [[ -z "$(printenv "$name" 2>/dev/null || true)" ]] || hold "Inherited emulator endpoint forbidden: $name"
done

OUT="$(mktemp -d /tmp/urai-r876-exact-native.XXXXXX)"
mkdir -m 700 "$OUT/home" "$OUT/cloudsdk"
export HOME="$OUT/home" CLOUDSDK_CONFIG="$OUT/cloudsdk" GCE_METADATA_HOST='127.0.0.1:9'
export URAI_EMULATOR_PROJECT="$PROJECT" GCLOUD_PROJECT="$PROJECT" GOOGLE_CLOUD_PROJECT="$PROJECT"
unset NODE_OPTIONS HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
printf 'stage\tstatus\texit\tlog_sha256\n' > "$OUT/stages.tsv"
printf 'URAI_R876_REVIEW_SOURCE=%s disposableOnly=true output=%s\n' "$EXPECTED" "$OUT"

stage() {
  local id="$1" limit="$2" rc=0 digest
  shift 2
  timeout -k 25s "$limit" "$@" > "$OUT/$id.log" 2>&1 || rc=$?
  digest="$(sha256sum "$OUT/$id.log" | cut -d' ' -f1)"
  if (( rc != 0 )); then
    printf '%s\tFAIL\t%s\t%s\n' "$id" "$rc" "$digest" >> "$OUT/stages.tsv"
    tail -n 50 "$OUT/$id.log" >&2 || true
    hold "Failed stage $id; exit=$rc log_sha256=$digest log=$OUT/$id.log"
  fi
  printf '%s\tPASS\t0\t%s\n' "$id" "$digest" >> "$OUT/stages.tsv"
  printf 'URAI_R876_STAGE_PASS stage=%s sha256=%s\n' "$id" "$digest"
}

# Original R854 complete frozen install, workspace verify/typecheck/build,
# hard-off checks, race model, and four disposable native negative suites.
stage r854_original 5400s bash scripts/run-r854-private-storage-p0-negative-native.sh
grep -q 'URAI_R854_PRIVATE_STORAGE_P0_NEGATIVE_REPRODUCED' "$OUT/r854_original.log" || hold 'Missing R854 native marker'
grep -q 'privilegedBypassObserved=true storageLevelFenceVerified=false' "$OUT/r854_original.log" || hold 'Original negative Storage bypass evidence missing'

# Separately rerun exact new source-level suite and real Firebase Storage/Firestore
# emulator generation readback. Neither is an actual GCS IAM/owner-signature test.
stage generation_17_source 120s node --experimental-strip-types --test \
  scripts/life-movie-generation-evidence-review.test.mjs \
  scripts/life-movie-generation-evidence-matrix.test.mjs
grep -q '# pass 17' "$OUT/generation_17_source.log" || hold '17 source subtests not recorded'

stage physical_generation_9_native 1200s npx --yes firebase-tools@15.24.0 \
  --config firebase.json --project "$PROJECT" emulators:exec \
  --only auth,firestore,storage \
  'node scripts/life-movies-review-only-physical-broker.firebase-emulator.mjs'
grep -q 'R857_REVIEW_ONLY_PHYSICAL_GENERATION_LEDGER_PASS checks=9' "$OUT/physical_generation_9_native.log" || hold 'Missing genuine nine-case native marker'
grep -q 'actualFirestoreEmulator=true actualStorageEmulator=true' "$OUT/physical_generation_9_native.log" || hold 'Actual emulator assertion missing'
grep -q 'privilegedBypassObserved=true exclusiveIAMVerified=false' "$OUT/physical_generation_9_native.log" || hold 'Storage-level bypass/unknown IAM not established'
grep -q 'privateDeletionAcknowledged=false productionAuthorized=false' "$OUT/physical_generation_9_native.log" || hold 'Incorrect native production scope'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || hold 'Acceptance changed the pinned working tree'

printf 'URAI_R876_SOURCE_LEVEL_AND_DISPOSABLE_NATIVE_REVIEW_PASS head=%s\n' "$EXPECTED"
printf 'URAI_R876_RECEIPTS=%s/stages.tsv\n' "$OUT"
printf 'URAI_R876_GENESIS_HOLD effectiveIam403=false signedOwnerConsent=false inflightDrain=false privateReplay=false productionAuthorized=false\n'
