#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_TARGET_SECRET_VERSIONS_JSON:?DEPLOY_TARGET_SECRET_VERSIONS_JSON is required}"
: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"

REAL_GCLOUD="$(command -v gcloud)"
[ -n "$REAL_GCLOUD" ] || { echo "[FAIL] gcloud is required" >&2; exit 1; }

WORKERS_CSV="${URAI_JOBS_DEPLOY_WORKERS:-narrator-worker,asset-worker}"
URAI_JOBS_WORKER_TOKEN_SECRET="${URAI_JOBS_WORKER_TOKEN_SECRET:-urai-jobs-worker-token}"
URAI_WHEEL_GITHUB_TOKEN_SECRET="${URAI_WHEEL_GITHUB_TOKEN_SECRET:-urai-wheel-github-token}"
URAI_JOBS_CALLBACK_SECRET_NAME="${URAI_JOBS_CALLBACK_SECRET_NAME:-urai-jobs-callback-secret}"
DEPLOY_RECEIPT_PATH="${DEPLOY_RECEIPT_PATH:-docs/release-evidence/worker-deploy-receipt.json}"
export REAL_GCLOUD WORKERS_CSV URAI_JOBS_WORKER_TOKEN_SECRET URAI_WHEEL_GITHUB_TOKEN_SECRET URAI_JOBS_CALLBACK_SECRET_NAME DEPLOY_RECEIPT_PATH

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
  "$REAL_GCLOUD" "$@"
}

export -f gcloud logical_binding_for_secret approved_version_for_binding

echo "[PASS] Exact target Secret Manager versions approved before mutation."
bash scripts/deploy-workers.sh

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
