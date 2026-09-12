#!/usr/bin/env bash
set -euo pipefail

: "${GCLOUD_PROJECT:?GCLOUD_PROJECT is required}"
: "${URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT:?URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT is required}"

command -v gcloud >/dev/null 2>&1 || {
  echo "[FAIL] gcloud CLI is required" >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "[FAIL] node is required" >&2
  exit 1
}

runtime_member="serviceAccount:${URAI_JOBS_FUNCTIONS_RUNTIME_SERVICE_ACCOUNT}"
project_policy="$(gcloud projects get-iam-policy "$GCLOUD_PROJECT" --format=json)"

PROJECT_POLICY_JSON="$project_policy" EXPECTED_MEMBER="$runtime_member" node <<'NODE'
const policy = JSON.parse(process.env.PROJECT_POLICY_JSON || '{}');
const expectedMember = process.env.EXPECTED_MEMBER;

const binding = (policy.bindings || []).find((entry) =>
  entry?.role === 'roles/datastore.user'
  && !entry.condition
  && Array.isArray(entry.members)
  && entry.members.includes(expectedMember));

if (!binding) {
  console.error(`Functions runtime service account lacks an unconditional project-level roles/datastore.user grant: ${expectedMember}`);
  process.exit(1);
}
NODE

echo "[PASS] Functions runtime Firestore IAM verified: ${runtime_member} has unconditional roles/datastore.user"
