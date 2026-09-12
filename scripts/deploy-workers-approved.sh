#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_TARGET_SECRET_VERSIONS_JSON:?DEPLOY_TARGET_SECRET_VERSIONS_JSON is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required for exact worker source provenance}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required for exact worker source provenance}"

REAL_GCLOUD="$(command -v gcloud)"
[ -n "$REAL_GCLOUD" ] || { echo "[FAIL] gcloud is required" >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "[FAIL] tar is required" >&2; exit 1; }
command -v gzip >/dev/null 2>&1 || { echo "[FAIL] gzip is required" >&2; exit 1; }

WORKERS_CSV="${URAI_JOBS_DEPLOY_WORKERS:-narrator-worker,asset-worker}"
URAI_JOBS_WORKER_TOKEN_SECRET="${URAI_JOBS_WORKER_TOKEN_SECRET:-urai-jobs-worker-token}"
URAI_WHEEL_GITHUB_TOKEN_SECRET="${URAI_WHEEL_GITHUB_TOKEN_SECRET:-urai-wheel-github-token}"
URAI_JOBS_CALLBACK_SECRET_NAME="${URAI_JOBS_CALLBACK_SECRET_NAME:-urai-jobs-callback-secret}"
DEPLOY_RECEIPT_PATH="${DEPLOY_RECEIPT_PATH:-docs/release-evidence/worker-deploy-receipt.json}"
WORKER_BUILD_PROVENANCE_PATH="${WORKER_BUILD_PROVENANCE_PATH:-docs/release-evidence/worker-build-provenance.json}"

if [ -n "${RUNNER_TEMP:-}" ]; then
  WORKER_BUILD_SOURCE_ROOT="$RUNNER_TEMP/urai-jobs-worker-build-source-$GITHUB_RUN_ID"
else
  WORKER_BUILD_SOURCE_ROOT="$(mktemp -d)"
fi
rm -rf "$WORKER_BUILD_SOURCE_ROOT"
mkdir -p "$WORKER_BUILD_SOURCE_ROOT"
WORKER_BUILD_SOURCE_LEDGER="$WORKER_BUILD_SOURCE_ROOT/source-ledger.json"

cleanup_worker_build_source() {
  rm -rf "$WORKER_BUILD_SOURCE_ROOT"
}
trap cleanup_worker_build_source EXIT

export REAL_GCLOUD WORKERS_CSV URAI_JOBS_WORKER_TOKEN_SECRET URAI_WHEEL_GITHUB_TOKEN_SECRET URAI_JOBS_CALLBACK_SECRET_NAME
export DEPLOY_RECEIPT_PATH WORKER_BUILD_PROVENANCE_PATH WORKER_BUILD_SOURCE_ROOT WORKER_BUILD_SOURCE_LEDGER

SOURCE_SHA="$GITHUB_SHA" LEDGER_PATH="$WORKER_BUILD_SOURCE_LEDGER" node <<'NODE'
const fs = require('node:fs');
const sha = String(process.env.SOURCE_SHA || '');
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('GITHUB_SHA must be a full lowercase source SHA.');
fs.writeFileSync(process.env.LEDGER_PATH, `${JSON.stringify({
  schemaVersion: 'urai-jobs-worker-build-source-ledger-1',
  sourceSha: sha,
  entries: [],
}, null, 2)}\n`);
NODE

required_bindings_json="$(WORKERS_CSV="$WORKERS_CSV" node <<'NODE'
const workers = String(process.env.WORKERS_CSV || '').split(',').map((value) => value.trim()).filter(Boolean);
const allowed = new Set(['narrator-worker', 'asset-worker']);
if (!workers.length || workers.some((worker) => !allowed.has(worker)) || new Set(workers).size !== workers.length) {
  throw new Error('URAI_JOBS_DEPLOY_WORKERS must contain unique approved workers only.');
}
const bindings = new Set(['URAI_JOBS_WORKER_TOKEN']);
if (workers.includes('asset-worker')) {
  bindings.add('URAI_WHEEL_GITHUB_TOKEN');
  bindings.add('URAI_JOBS_CALLBACK_SECRET');
}
process.stdout.write(JSON.stringify([...bindings].sort()));
NODE
)"

APPROVAL_JSON="$DEPLOY_TARGET_SECRET_VERSIONS_JSON" REQUIRED_BINDINGS_JSON="$required_bindings_json" node <<'NODE'
const approval = JSON.parse(process.env.APPROVAL_JSON || 'null');
const required = JSON.parse(process.env.REQUIRED_BINDINGS_JSON || '[]');
if (!approval || Array.isArray(approval) || typeof approval !== 'object') {
  throw new Error('DEPLOY_TARGET_SECRET_VERSIONS_JSON must be a JSON object.');
}
const keys = Object.keys(approval).sort();
if (JSON.stringify(keys) !== JSON.stringify(required)) {
  throw new Error(`Target secret approvals must contain exactly: ${required.join(', ')}`);
}
for (const [name, version] of Object.entries(approval)) {
  if (!/^[1-9][0-9]*$/.test(String(version))) {
    throw new Error(`${name} must use an exact numeric Secret Manager version.`);
  }
}
NODE

logical_binding_for_secret() {
  case "$1" in
    "$URAI_JOBS_WORKER_TOKEN_SECRET") printf '%s' 'URAI_JOBS_WORKER_TOKEN' ;;
    "$URAI_WHEEL_GITHUB_TOKEN_SECRET") printf '%s' 'URAI_WHEEL_GITHUB_TOKEN' ;;
    "$URAI_JOBS_CALLBACK_SECRET_NAME") printf '%s' 'URAI_JOBS_CALLBACK_SECRET' ;;
    *) return 1 ;;
  esac
}

approved_version_for_binding() {
  local binding="$1"
  BINDING="$binding" node <<'NODE'
const approval = JSON.parse(process.env.DEPLOY_TARGET_SECRET_VERSIONS_JSON || '{}');
const value = String(approval[process.env.BINDING] || '');
if (!/^[1-9][0-9]*$/.test(value)) process.exit(1);
process.stdout.write(value);
NODE
}

for secret_name in "$URAI_JOBS_WORKER_TOKEN_SECRET"; do
  binding="$(logical_binding_for_secret "$secret_name")"
  version="$(approved_version_for_binding "$binding")"
  state="$($REAL_GCLOUD secrets versions describe "$version" --secret "$secret_name" --project "$GCLOUD_PROJECT" --format='value(state)')"
  [ "$state" = "ENABLED" ] || { echo "[FAIL] Approved version $version for $secret_name is not ENABLED" >&2; exit 1; }
done

if [[ ",$WORKERS_CSV," == *",asset-worker,"* ]]; then
  for secret_name in "$URAI_WHEEL_GITHUB_TOKEN_SECRET" "$URAI_JOBS_CALLBACK_SECRET_NAME"; do
    binding="$(logical_binding_for_secret "$secret_name")"
    version="$(approved_version_for_binding "$binding")"
    state="$($REAL_GCLOUD secrets versions describe "$version" --secret "$secret_name" --project "$GCLOUD_PROJECT" --format='value(state)')"
    [ "$state" = "ENABLED" ] || { echo "[FAIL] Approved version $version for $secret_name is not ENABLED" >&2; exit 1; }
  done
fi

prepare_worker_build_source() {
  local source_dir="$1"
  local worker="${source_dir##*/}"
  local canonical_dir="workers/$worker"
  local manifest_path="$WORKER_BUILD_SOURCE_ROOT/$worker-source-manifest.json"
  local archive_path="$WORKER_BUILD_SOURCE_ROOT/$worker-$GITHUB_SHA.tgz"

  case "$worker" in
    narrator-worker|asset-worker) ;;
    *) echo "[FAIL] Unapproved worker source directory: $source_dir" >&2; return 1 ;;
  esac
  [ "$source_dir" = "$canonical_dir" ] || {
    echo "[FAIL] Worker build source must equal $canonical_dir, received $source_dir" >&2
    return 1
  }
  [ -d "$source_dir" ] || { echo "[FAIL] Missing worker source directory: $source_dir" >&2; return 1; }

  SOURCE_DIR="$source_dir" WORKER="$worker" SOURCE_SHA="$GITHUB_SHA" MANIFEST_PATH="$manifest_path" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.SOURCE_DIR);
const files = [];
function walk(directory) {
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Worker build source contains a symlink: ${path.relative(root, absolute)}`);
    if (stat.isDirectory()) walk(absolute);
    else if (stat.isFile()) {
      const bytes = fs.readFileSync(absolute);
      files.push({
        path: path.relative(root, absolute).split(path.sep).join('/'),
        size: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      });
    } else throw new Error(`Worker build source contains an unsupported entry: ${path.relative(root, absolute)}`);
  }
}
walk(root);
if (!files.length) throw new Error('Worker build source must contain files.');
const manifest = {
  schemaVersion: 'urai-jobs-worker-source-manifest-1',
  worker: process.env.WORKER,
  sourceDirectory: `workers/${process.env.WORKER}`,
  sourceSha: process.env.SOURCE_SHA,
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.size, 0),
  files,
};
fs.writeFileSync(process.env.MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

  tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner --format=ustar \
    -cf - -C "$source_dir" . | gzip -n > "$archive_path"
  [ -s "$archive_path" ] || { echo "[FAIL] Worker build source archive is empty: $archive_path" >&2; return 1; }

  WORKER="$worker" SOURCE_DIR="$canonical_dir" SOURCE_SHA="$GITHUB_SHA" MANIFEST_PATH="$manifest_path" \
  ARCHIVE_PATH="$archive_path" LEDGER_PATH="$WORKER_BUILD_SOURCE_LEDGER" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const ledger = JSON.parse(fs.readFileSync(process.env.LEDGER_PATH, 'utf8'));
const manifestBytes = fs.readFileSync(process.env.MANIFEST_PATH);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const archiveBytes = fs.readFileSync(process.env.ARCHIVE_PATH);
if (manifest.schemaVersion !== 'urai-jobs-worker-source-manifest-1') throw new Error('Worker source manifest schema mismatch.');
if (manifest.worker !== process.env.WORKER || manifest.sourceSha !== process.env.SOURCE_SHA) throw new Error('Worker source manifest identity mismatch.');
if (ledger.entries.some((entry) => entry.worker === process.env.WORKER)) throw new Error(`Duplicate worker source ledger entry: ${process.env.WORKER}`);
ledger.entries.push({
  worker: process.env.WORKER,
  sourceDirectory: process.env.SOURCE_DIR,
  sourceManifestPath: process.env.MANIFEST_PATH,
  sourceManifestSha256: hash(manifestBytes),
  sourceArchiveSha256: hash(archiveBytes),
  sourceArchiveBytes: archiveBytes.length,
  sourceFileCount: manifest.fileCount,
  sourceTotalBytes: manifest.totalBytes,
});
ledger.entries.sort((left, right) => left.worker.localeCompare(right.worker));
fs.writeFileSync(process.env.LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
NODE

  printf '%s' "$archive_path"
}

gcloud() {
  if [ "${1:-}" = "secrets" ] && [ "${2:-}" = "versions" ] && [ "${3:-}" = "list" ]; then
    local secret_name="${4:-}"
    local binding version
    binding="$(logical_binding_for_secret "$secret_name")" || {
      echo "[FAIL] No approved logical binding exists for secret $secret_name" >&2
      return 1
    }
    version="$(approved_version_for_binding "$binding")" || {
      echo "[FAIL] Approved numeric version is missing for $binding" >&2
      return 1
    }
    printf 'projects/%s/secrets/%s/versions/%s\n' "$GCLOUD_PROJECT" "$secret_name" "$version"
    return 0
  fi

  if [ "${1:-}" = "builds" ] && [ "${2:-}" = "submit" ]; then
    local source_dir="${3:-}"
    local archive_path
    [ -n "$source_dir" ] || { echo "[FAIL] gcloud builds submit requires a worker source directory" >&2; return 1; }
    shift 3
    archive_path="$(prepare_worker_build_source "$source_dir")"
    "$REAL_GCLOUD" builds submit "$archive_path" "$@"
    return
  fi

  "$REAL_GCLOUD" "$@"
}

export -f gcloud logical_binding_for_secret approved_version_for_binding prepare_worker_build_source

echo "[PASS] Exact target Secret Manager versions approved before mutation."
bash scripts/deploy-workers.sh

node scripts/capture-worker-build-provenance.mjs

node <<'NODE'
const fs = require('fs');
const approval = JSON.parse(process.env.DEPLOY_TARGET_SECRET_VERSIONS_JSON || '{}');
const workers = String(process.env.WORKERS_CSV || '').split(',').map((value) => value.trim()).filter(Boolean).sort();
const receipt = JSON.parse(fs.readFileSync(process.env.DEPLOY_RECEIPT_PATH, 'utf8'));
if (receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3') throw new Error('Unexpected worker deploy receipt schema.');
const services = Array.isArray(receipt.services) ? receipt.services : [];
if (JSON.stringify(services.map((service) => service.worker).sort()) !== JSON.stringify(workers)) {
  throw new Error('Worker deploy receipt service set does not match the approved worker set.');
}
for (const service of services) {
  const expected = service.worker === 'asset-worker'
    ? {
        URAI_JOBS_WORKER_TOKEN: String(approval.URAI_JOBS_WORKER_TOKEN),
        URAI_WHEEL_GITHUB_TOKEN: String(approval.URAI_WHEEL_GITHUB_TOKEN),
        URAI_JOBS_CALLBACK_SECRET: String(approval.URAI_JOBS_CALLBACK_SECRET),
      }
    : { URAI_JOBS_WORKER_TOKEN: String(approval.URAI_JOBS_WORKER_TOKEN) };
  if (JSON.stringify(service.secretVersions) !== JSON.stringify(expected)) {
    throw new Error(`${service.worker} deployed secret versions do not equal the explicit target approval.`);
  }
}
console.log('[PASS] Deployed worker receipt secret versions equal the explicit target approval.');
NODE
