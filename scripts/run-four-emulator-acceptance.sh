#!/usr/bin/env bash
# Real, disposable Firebase four-emulator acceptance for the exact Jobs head.
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
command -v node >/dev/null || die "Node.js is required"
command -v pnpm >/dev/null || die "pnpm 8.15.9 is required"
command -v java >/dev/null || die "Java 21 is required for Firestore"
command -v npx >/dev/null || die "npm/npx is required to run pinned Firebase Tools"

CURRENT_SHA="$(git rev-parse HEAD)"
EXPECTED_SHA="${URAI_ACCEPTANCE_SHA:-$CURRENT_SHA}"
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Expected SHA must be a full 40-digit git commit"
[[ "$CURRENT_SHA" == "$EXPECTED_SHA" ]] || die "Checked-out HEAD differs from URAI_ACCEPTANCE_SHA"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Working tree must be clean"

for variable in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID CLOUDSDK_CORE_PROJECT; do
  value="${!variable:-}"
  [[ -z "$value" || "$value" == "$PROJECT" ]] || die "$variable points outside disposable emulator project"
done
for variable in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY; do
  [[ -z "${!variable:-}" ]] || die "$variable must be absent from emulator-only acceptance"
done
export GCLOUD_PROJECT="$PROJECT"
export GOOGLE_CLOUD_PROJECT="$PROJECT"

printf 'URAI_FOUR_EMULATOR_SOURCE %s\n' "$CURRENT_SHA"
pnpm install --frozen-lockfile
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Frozen install changed source"
pnpm --filter @urai-jobs/shared-types build
pnpm --filter urai-jobs-functions build

ENV_FILE="functions/.env.$PROJECT"
[[ ! -e "$ENV_FILE" ]] || die "Refusing to overwrite existing local emulator function configuration"
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
  "node scripts/urai-jobs-e2e.mjs"

printf 'URAI_FOUR_EMULATOR_ACCEPTANCE_PASS source=%s project=%s\n' "$CURRENT_SHA" "$PROJECT"
