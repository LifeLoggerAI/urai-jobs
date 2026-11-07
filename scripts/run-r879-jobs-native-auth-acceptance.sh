#!/usr/bin/env bash
# R879: original disposable four-emulator acceptance + real Auth/Firestore/Functions
# current role, deletion, owner and idempotency regression. Production HARD OFF.
# No deployment, live media, billable compute, or production credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT="demo-urai-jobs"
TOOLS_VERSION="15.24.0"

die() {
  printf 'URAI_FOUR_EMULATOR_HOLD: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null || die "git is required"
# The reviewed SHA must come from the independent release controller, never
# default to whatever branch happens to be checked out at execution time.
[[ -n "${URAI_ACCEPTANCE_SHA:-}" ]] || die "Externally reviewed URAI_ACCEPTANCE_SHA is required"
[[ "$URAI_ACCEPTANCE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Expected SHA must be a full 40-digit git commit"
CURRENT_SHA="$(git rev-parse --verify HEAD 2>/dev/null)" || die "Full Git checkout is required"
[[ "$CURRENT_SHA" == "$URAI_ACCEPTANCE_SHA" ]] || die "Checked-out HEAD differs from URAI_ACCEPTANCE_SHA"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Working tree must be clean"

command -v node >/dev/null || die "Node.js is required"
command -v pnpm >/dev/null || die "pnpm 8.15.9 is required"
[[ "$(pnpm --version)" == "8.15.9" ]] || die "Exact pnpm 8.15.9 required for frozen install"
[[ "$(node --version)" == v22.* ]] || die "Node.js 22 is required"
command -v java >/dev/null || die "Java 21 is required for Firestore"
command -v npx >/dev/null || die "npm/npx is required to run pinned Firebase Tools"

for variable in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID CLOUDSDK_CORE_PROJECT; do
  value="${!variable:-}"
  [[ -z "$value" || "$value" == "$PROJECT" ]] || die "$variable points outside disposable emulator project"
done
for variable in FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST STORAGE_EMULATOR_HOST FUNCTIONS_EMULATOR_HOST FIREBASE_FUNCTIONS_EMULATOR_HOST; do
  [[ -z "${!variable:-}" ]] || die "$variable must be unset before firebase emulators:exec"
done
for variable in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN FIREBASE_CLI_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN GOOGLE_CLOUD_ACCESS_TOKEN GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY STRIPE_SECRET_KEY OPENAI_API_KEY; do
  [[ -z "${!variable:-}" ]] || die "$variable must be absent from emulator-only acceptance"
done
# Reject ignored Functions environment files before any installation lifecycle
# or build script. The preexisting file may contain production credentials.
ENV_FILE="functions/.env.$PROJECT"
# Firebase Functions emulators load .env, project .env.*, .env.local and
# .secret.local; Gen1 may also load .runtimeconfig.json. Any ignored file
# here can silently override the disposable runner's no-provider policy.
# Reject files OR symlinks before dependency installation and again after
# build. A tracked functions/.env.example is documentation, not configuration.
assert_no_functions_local_configuration() {
  local found
  found="$(find functions -maxdepth 1 \( -name '.env' -o -name '.env.*' -o -name '.secret.local' -o -name '.runtimeconfig.json' \) ! -name '.env.example' -print -quit)"
  [[ -z "$found" ]] || die "Functions local environment/secret configuration forbidden: $found"
}
assert_no_functions_local_configuration
command -v ffmpeg >/dev/null || die "ffmpeg is required for original Life Movie worker smoke"
command -v ffprobe >/dev/null || die "ffprobe is required for original Life Movie worker smoke"

# Firebase Admin may read a preloaded project/bucket configuration independently
# of the CLI --project flag. Do not let inherited settings redirect any
# synthetic test traffic toward private or production Cloud Storage.
for variable in FIREBASE_CONFIG GCS_BUCKET_NAME FIREBASE_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_BUCKET; do
  [[ -z "${!variable:-}" ]] || die "$variable must be absent from emulator-only acceptance"
done
export GCLOUD_PROJECT="$PROJECT"
export GOOGLE_CLOUD_PROJECT="$PROJECT"

printf 'URAI_FOUR_EMULATOR_SOURCE %s\n' "$CURRENT_SHA"
node --test scripts/owner_authority_rules.static.test.mjs
pnpm install --frozen-lockfile
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Frozen install changed source"
pnpm --filter @urai-jobs/shared-types build
pnpm --filter urai-jobs-functions build
# A green Functions-only build is not full-source release acceptance.
pnpm typecheck
pnpm build
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Original build modified reviewed source"

# An install/build that creates the ignored Functions env file is unsafe.
assert_no_functions_local_configuration
cleanup() { rm -f -- "$ENV_FILE"; }
trap cleanup EXIT
printf '%s\n' \
  "URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT=urai-jobs-emulator@demo-urai-jobs.iam.gserviceaccount.com" \
  "URAI_JOBS_PRIVACY_EVENT_TOKEN=e2e-privacy-event-token" > "$ENV_FILE"

# Firebase emulators:exec exports the exact four host variables to the
# child process. The E2E rejects absent/remote Storage and non-demo projects.
timeout --kill-after=30s 10m npx --yes "firebase-tools@$TOOLS_VERSION" \
  --project "$PROJECT" emulators:exec \
  --only auth,firestore,functions,storage \
  "node scripts/life-movies-cancellation-smoke.mjs && node scripts/urai-jobs-e2e.mjs && node --test scripts/user_authority_rules.firebase-emulator.test.mjs && R879_JOBS_EMULATOR_APPROVED=1 node --test scripts/r879-jobs-current-authority.firebase-emulator.test.mjs"

printf 'R879_JOBS_NATIVE_AUTH_ACCEPTANCE_PASS source=%s project=%s\n' "$CURRENT_SHA" "$PROJECT"
