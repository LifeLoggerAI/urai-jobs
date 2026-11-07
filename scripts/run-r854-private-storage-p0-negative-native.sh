#!/usr/bin/env bash
# R854: repeatable source-pinned P0 review of private Life Movie output revocation.
# This runner intentionally REPRODUCES the privileged Storage late-write gap.
# It does NOT establish a storage-enforced fence or authorize any real media.
set -Eeuo pipefail
umask 077

die() {
  printf 'URAI_R854_HOLD: %s\n' "$*" >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT=urai-staging-test
EXPECTED="$URAI_JOBS_ACCEPTANCE_SHA"

[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || die "Externally supplied full review SHA required"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || die "Jobs HEAD is not the reviewed source"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Jobs working tree is not clean"

for command_name in node pnpm npx java git timeout sha256sum mktemp tail grep; do
  command -v "$command_name" >/dev/null || die "Missing executable: $command_name"
done
[[ "$(node -v)" == v22.* ]] || die "Node 22 required"
[[ "$(pnpm -v)" == 8.15.9 ]] || die "pnpm 8.15.9 required"
java_major="$(java -version 2>&1 | head -n 1 | sed -nE 's/.*version "([0-9]+).*/\1/p')"
[[ -n "$java_major" && "$java_major" -ge 21 ]] || die "Java 21 or newer required"
[[ "$HOME" == /tmp/* ]] || die "Disposable /tmp HOME required"
[[ "$CLOUDSDK_CONFIG" == /tmp/* ]] || die "Disposable /tmp CLOUDSDK_CONFIG required"
[[ "$GCE_METADATA_HOST" == 127.0.0.1:9 ]] || die "Cloud metadata refusal required"
[[ ! -e "functions/.env.$PROJECT" ]] || die "Unexpected Firebase Functions environment file"

for name in GOOGLE_APPLICATION_CREDENTIALS GOOGLE_APPLICATION_CREDENTIALS_JSON \
  FIREBASE_TOKEN FIREBASE_CLI_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN GOOGLE_CLOUD_ACCESS_TOKEN \
  GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY STRIPE_SECRET_KEY OPENAI_API_KEY \
  FIREBASE_CONFIG GCS_BUCKET_NAME FIREBASE_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_BUCKET; do
  [[ -z "$(printenv "$name" 2>/dev/null || true)" ]] || die "Credentials or bucket override forbidden: $name"
done
for name in FIREBASE_AUTH_EMULATOR_HOST FIRESTORE_EMULATOR_HOST \
  FIREBASE_STORAGE_EMULATOR_HOST FIREBASE_FUNCTIONS_EMULATOR_HOST FUNCTIONS_EMULATOR_HOST; do
  [[ -z "$(printenv "$name" 2>/dev/null || true)" ]] || die "Inherited emulator override forbidden: $name"
done
for name in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT CLOUDSDK_CORE_PROJECT FIREBASE_PROJECT_ID URAI_EMULATOR_PROJECT; do
  value="$(printenv "$name" 2>/dev/null || true)"
  [[ -z "$value" || "$value" == "$PROJECT" ]] || die "Non-disposable project selection in $name"
done

export URAI_EMULATOR_PROJECT="$PROJECT" GCLOUD_PROJECT="$PROJECT" GOOGLE_CLOUD_PROJECT="$PROJECT"
OUT="$(mktemp -d /tmp/urai-r854-p0.XXXXXX)"
printf 'stage\tstatus\texit\tlog_sha256\n' > "$OUT/stages.tsv"
echo "URAI_R854_SOURCE_PIN jobs=$EXPECTED project=$PROJECT"

run_stage() {
  local stage="$1" limit="$2" rc=0 digest
  shift 2
  timeout -k 25s "$limit" "$@" > "$OUT/$stage.log" 2>&1 || rc=$?
  digest="$(sha256sum "$OUT/$stage.log" | cut -d' ' -f1)"
  if (( rc != 0 )); then
    printf '%s\tFAIL\t%s\t%s\n' "$stage" "$rc" "$digest" >> "$OUT/stages.tsv"
    echo "URAI_R854_STAGE_FAIL stage=$stage exit=$rc sha256=$digest" >&2
    tail -n 75 "$OUT/$stage.log" >&2 || true
    die "Source-native stage failed; do not issue any release receipt; log=$OUT/$stage.log"
  fi
  printf '%s\tPASS\t0\t%s\n' "$stage" "$digest" >> "$OUT/stages.tsv"
  echo "URAI_R854_STAGE_PASS stage=$stage sha256=$digest"
}

# Use existing original tests; add no substitute security implementation.
run_stage direct_write_hardoff 120s node --test scripts/life-movies-private-output-write-authority.test.mjs
run_stage revocation_race_model 120s node --test scripts/life-movie-writer-fence-race-model.test.mjs
run_stage frozen_install 900s pnpm install --frozen-lockfile
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Install modified source"
run_stage full_workspace_verify 900s pnpm urai-jobs:verify
run_stage full_workspace_typecheck 900s pnpm typecheck
run_stage full_workspace_build 900s pnpm build
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Build modified source"
[[ ! -e "functions/.env.$PROJECT" ]] || die "Build introduced forbidden emulator env file"

# Proxy agents must not intercept local Firebase emulator HTTP traffic.
for proxy_name in HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy; do
  unset "$proxy_name"
done

EMULATOR_TESTS="node scripts/life-movies-owner-rights.firebase-emulator.mjs && node scripts/life-movies-write-reservations.review-emulator.mjs && node scripts/life-movies-late-write-storage-boundary.firebase-emulator.mjs && node scripts/life-movies-derivative-revocation.firebase-emulator.mjs"
run_stage real_auth_firestore_storage_negative 1200s npx --yes firebase-tools@15.24.0 \
  --config firebase.json --project "$PROJECT" emulators:exec \
  --only auth,firestore,storage "$EMULATOR_TESTS"

for marker in R493_OWNER_RIGHTS_THREE_EMULATOR_PASS \
  R523_REVIEW_ONLY_FENCING_EMULATOR_PASS \
  R522_REAL_FIREBASE_LATE_WRITE_BOUNDARY_REPRODUCED \
  R503_REAL_PRIVATE_DERIVATIVE_REVOCATION_PASS; do
  grep -q "$marker" "$OUT/real_auth_firestore_storage_negative.log" || die "Missing actual original native marker: $marker"
done
grep -q 'privilegedBypassObserved=true' "$OUT/real_auth_firestore_storage_negative.log" || die "Late writer gap not observed"
grep -q 'storageLevelFenceVerified=false' "$OUT/real_auth_firestore_storage_negative.log" || die "False storage fence assertion"
grep -q 'productionAuthorized=false' "$OUT/real_auth_firestore_storage_negative.log" || die "Missing review-only boundary"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Native tests changed reviewed source"

echo "URAI_R854_PRIVATE_STORAGE_P0_NEGATIVE_REPRODUCED jobs=$EXPECTED privilegedBypassObserved=true storageLevelFenceVerified=false productionAuthorized=false deletionAck=false"
echo "URAI_R854_STAGE_REPORT $OUT/stages.tsv"
echo "URAI_R854_RELEASE_HOLD realSignedConsent=false privateRender=false protectedReplay=false effectiveIAM=false"
