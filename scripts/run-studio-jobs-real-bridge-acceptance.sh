#!/usr/bin/env bash
# R815 review-only exact-pinned Studio -> Jobs bridge against four emulators.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
die() { printf 'URAI_STUDIO_JOBS_R815_HOLD: %s\n' "$*" >&2; exit 1; }
PROJECT=demo-urai-jobs
STUDIO_SHA=153d6c35557c66a8b9f8629778ca796b83730464
command -v git >/dev/null || die 'git missing'
command -v pnpm >/dev/null || die 'pnpm missing'
command -v node >/dev/null || die 'node missing'
command -v java >/dev/null || die 'java missing'
command -v npx >/dev/null || die 'npx missing'
[[ "$(node --version)" == v22.* ]] || die 'Node 22 required'
[[ "$(pnpm --version)" == 8.15.9 ]] || die 'pnpm 8.15.9 required'
HEAD_SHA="$(git rev-parse HEAD)"
[[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'invalid HEAD'
[[ "$HEAD_SHA" == "${URAI_ACCEPTANCE_SHA:-}" ]] || die 'Jobs SHA mismatch'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die 'Jobs tree dirty'
for name in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID CLOUDSDK_CORE_PROJECT; do
  v="${!name:-}"
  [[ -z "$v" || "$v" == "$PROJECT" ]] || die "$name non-demo project"
done
# A separate Jobs acceptance runner already enforces these boundaries. The
# Studio -> Jobs emulator runner must enforce the same policy independently;
# the Firebase CLI's demo --project flag alone does not override Admin SDK or
# Storage configuration inherited from the launching shell.
for name in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN FIREBASE_CLI_TOKEN GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY GOOGLE_CLOUD_ACCESS_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN STRIPE_SECRET_KEY OPENAI_API_KEY; do
  [[ -z "${!name:-}" ]] || die "$name credential present"
done
for name in FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST STORAGE_EMULATOR_HOST FUNCTIONS_EMULATOR_HOST FIREBASE_FUNCTIONS_EMULATOR_HOST; do
  [[ -z "${!name:-}" ]] || die "$name must be unset"
done
for name in FIREBASE_CONFIG GCS_BUCKET_NAME FIREBASE_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_BUCKET URAI_STUDIO_JOBS_BRIDGE_TOKEN URAI_JOBS_BRIDGE_URL; do
  [[ -z "${!name:-}" ]] || die "$name must be absent from emulator-only acceptance"
done
# Refuse to install/build if an existing function env file could be loaded
# during package scripts, and never overwrite an unreviewed credential file.
ENV_FILE="functions/.env.$PROJECT"
[[ ! -e "$ENV_FILE" ]] || die 'Existing emulator environment file'
STUDIO_DIR="${URAI_STUDIO_SOURCE_DIR:-}"
[[ -n "$STUDIO_DIR" && -d "$STUDIO_DIR/.git" ]] || die 'external Studio checkout missing'
[[ "$(git -C "$STUDIO_DIR" rev-parse HEAD)" == "$STUDIO_SHA" ]] || die 'Studio SHA drift'
[[ -z "$(git -C "$STUDIO_DIR" status --porcelain --untracked-files=all)" ]] || die 'Studio dirty'
export URAI_EXPECTED_STUDIO_SHA="$STUDIO_SHA" URAI_STUDIO_SOURCE_DIR="$STUDIO_DIR"
export GCLOUD_PROJECT="$PROJECT" GOOGLE_CLOUD_PROJECT="$PROJECT"
printf 'URAI_STUDIO_JOBS_R815_SOURCE jobs=%s studio=%s\n' "$HEAD_SHA" "$STUDIO_SHA"
pnpm install --frozen-lockfile
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die 'Install changed Jobs source'
pnpm --filter @urai-jobs/shared-types build
pnpm --filter urai-jobs-functions build
# The Studio bridge must not advertise a real four-emulator result after
# Functions-only builds when the actual workspace fails typechecking/building.
pnpm typecheck
pnpm build
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die 'Original build changed Jobs source'
cleanup() { rm -f "$ENV_FILE"; }
trap cleanup EXIT
printf '%s\n' \
  'URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT=urai-jobs-emulator@demo-urai-jobs.iam.gserviceaccount.com' \
  'URAI_JOBS_PRIVACY_EVENT_TOKEN=e2e-privacy-event-token' \
  'URAI_STUDIO_JOBS_BRIDGE_TOKEN=r815-synthetic-bridge-token-no-prod' > "$ENV_FILE"
export URAI_STUDIO_JOBS_BRIDGE_TOKEN=r815-synthetic-bridge-token-no-prod
# Original FFmpeg cancellation/cleanup proof must pass on the actual source
# before a real Studio->Jobs HTTP emulator receipt can be emitted.
command -v ffmpeg >/dev/null || die 'ffmpeg missing'
command -v ffprobe >/dev/null || die 'ffprobe missing'
node scripts/life-movies-cancellation-smoke.mjs
timeout --kill-after=30s 11m npx --yes firebase-tools@15.24.0 \
  --project "$PROJECT" emulators:exec --only auth,firestore,functions,storage \
  'node scripts/urai-jobs-e2e.mjs && node scripts/studio-jobs-real-bridge-emulator.mjs'
printf 'URAI_STUDIO_JOBS_REAL_HTTP_R815_PASS jobs=%s studio=%s positiveConsent=false movieRendered=false\n' "$HEAD_SHA" "$STUDIO_SHA"
