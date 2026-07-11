#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_SOURCE_SHA:?DEPLOY_SOURCE_SHA is required}"
: "${DEPLOY_ROLLBACK_SHA:?DEPLOY_ROLLBACK_SHA is required}"
: "${URAI_DEPLOY_CONFIRM:?URAI_DEPLOY_CONFIRM is required}"
: "${URAI_ENV:?URAI_ENV is required}"

sha_pattern='^[0-9a-f]{40}$'
[[ "$DEPLOY_SOURCE_SHA" =~ $sha_pattern ]] || {
  echo "[FAIL] DEPLOY_SOURCE_SHA must be a full lowercase 40-character SHA" >&2
  exit 1
}
[[ "$DEPLOY_ROLLBACK_SHA" =~ $sha_pattern ]] || {
  echo "[FAIL] DEPLOY_ROLLBACK_SHA must be a full lowercase 40-character SHA" >&2
  exit 1
}

case "$URAI_ENV" in
  staging)
    expected_confirmation="DEPLOY-URAI-JOBS-STAGING"
    ;;
  prod|production)
    expected_confirmation="DEPLOY-URAI-JOBS-PRODUCTION"
    ;;
  *)
    echo "[FAIL] URAI_ENV must be staging, prod, or production" >&2
    exit 1
    ;;
esac

if [ "$URAI_DEPLOY_CONFIRM" != "$expected_confirmation" ]; then
  echo "[FAIL] URAI_DEPLOY_CONFIRM must equal $expected_confirmation" >&2
  exit 1
fi

actual_sha="$(git rev-parse HEAD)"
[ "$actual_sha" = "$DEPLOY_SOURCE_SHA" ] || {
  echo "[FAIL] Checked-out SHA $actual_sha does not match DEPLOY_SOURCE_SHA $DEPLOY_SOURCE_SHA" >&2
  exit 1
}

if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  echo "[FAIL] Deployment requires a clean worktree" >&2
  git status --short >&2
  exit 1
fi

git cat-file -e "${DEPLOY_SOURCE_SHA}^{commit}" || {
  echo "[FAIL] DEPLOY_SOURCE_SHA is not a repository commit" >&2
  exit 1
}
git cat-file -e "${DEPLOY_ROLLBACK_SHA}^{commit}" || {
  echo "[FAIL] DEPLOY_ROLLBACK_SHA is not a repository commit" >&2
  exit 1
}
[ "$DEPLOY_SOURCE_SHA" != "$DEPLOY_ROLLBACK_SHA" ] || {
  echo "[FAIL] Rollback SHA must differ from deployment SHA" >&2
  exit 1
}
git merge-base --is-ancestor "$DEPLOY_ROLLBACK_SHA" "$DEPLOY_SOURCE_SHA" || {
  echo "[FAIL] Rollback SHA must be an ancestor of the deployment SHA" >&2
  exit 1
}

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  [ "${GITHUB_REPOSITORY:-}" = "LifeLoggerAI/urai-jobs" ] || {
    echo "[FAIL] Deployment workflow is running from an unexpected repository" >&2
    exit 1
  }
  [ -n "${GITHUB_RUN_ID:-}" ] || {
    echo "[FAIL] GITHUB_RUN_ID is required in GitHub Actions" >&2
    exit 1
  }
fi

echo "[PASS] Deployment authority verified"
echo "[PASS] source=$DEPLOY_SOURCE_SHA rollback=$DEPLOY_ROLLBACK_SHA environment=$URAI_ENV"
