# URAI Jobs Live Deployment Blockers and Final Release Actions

Status: repository implementation and release automation prepared; production remains fail-closed
Default branch: `main`

This document records what remains before anyone can truthfully mark URAI-Jobs V1-V5 as live in production.

## What is complete in the repo

- V1-V5 career surfaces, worker/runtime hooks, local verification, smoke and release-evidence tooling exist.
- Firebase Hosting direct-route rewrites exist.
- Production deploy/verify workflows use GitHub OIDC + Google Workload Identity Federation rather than long-lived service-account JSON or Firebase CLI tokens.
- `pnpm urai-jobs:verify` includes a static WIF deploy-auth contract that rejects legacy JSON/token auth in governed deploy workflows.

## What is not yet proven live

These items require external runtime execution, protected variables/secrets, or cloud control-plane evidence.

| Blocker | Why it matters | Required action |
| --- | --- | --- |
| WIF provider/trust binding not verified | GitHub Actions must exchange OIDC for short-lived Google credentials | Configure and validate `GCP_WIF_PROVIDER` for `LifeLoggerAI/urai-jobs` |
| Deploy service account binding not verified | Workflows require an explicitly impersonated least-privilege deploy identity | Configure and validate `GCP_DEPLOY_SERVICE_ACCOUNT` and required IAM only |
| Production project variable not verified | Deploy workflows must target the intended project | Configure `URAI_JOBS_FIREBASE_PROJECT_ID` or `FIREBASE_PROJECT_ID` |
| Production environment approval not verified | Workflows use protected GitHub environments | Ensure `production` / `prod` environment protection is configured as intended |
| Firebase/GCP deployment not executed | Repository readiness is not live-runtime proof | Dispatch the governed release workflow after WIF is validated |
| `CAREER_WORKER_URL` not proven configured | Career jobs need the deployed worker endpoint | Configure runtime environment with the verified worker URL |
| Worker health and terminal artifacts not proven | Release evidence requires real terminal processing | Run worker verification and career production smoke |
| Public domain/live URL not verified | User-facing live status depends on correct Hosting/DNS | Verify Firebase Hosting and custom domains after deploy |

## WIF-only authentication boundary

Do **not** create, download, upload, or restore a service-account JSON key for GitHub Actions. Do not use `FIREBASE_TOKEN`, `GCP_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_URAI_JOBS`, or `GCP_SA_KEY` as deploy credentials.

The governed GitHub Actions path requires non-secret variables:

```text
GCP_WIF_PROVIDER
GCP_DEPLOY_SERVICE_ACCOUNT
URAI_JOBS_FIREBASE_PROJECT_ID
```

Provider-side workload identity trust and IAM bindings must be established in Google Cloud and validated before any production dispatch. Repository configuration alone does not prove those bindings exist.

## Final release sequence

1. Configure the Google Workload Identity Provider trust for `LifeLoggerAI/urai-jobs`.
2. Bind the dedicated deploy service account with least privilege.
3. Set `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, and the production project variable in GitHub.
4. Confirm protected production environment rules.
5. Run `pnpm urai-jobs:verify` and required CI on the exact release head.
6. Dispatch `Career Production Release` or the governed production deploy workflow with its exact confirmation string.
7. Download and retain the release evidence artifact.
8. Verify worker health, terminal job states, artifacts, Hosting URLs, and rollback path.

## Equivalent authenticated command sequence

For an operator already authenticated through short-lived Google credentials / ADC:

```bash
pnpm install --no-frozen-lockfile
pnpm activation:verify
pnpm career:verify
pnpm urai-jobs:verify
pnpm --dir web typecheck
pnpm --dir web build
pnpm career-worker:typecheck
pnpm career-worker:build
pnpm prod:precheck
pnpm deploy:firebase:prod
pnpm deploy:workers
pnpm prod:verify-workers
pnpm prod:smoke
FIREBASE_PROJECT_ID=<project> GCP_REGION=us-central1 pnpm prod:career-smoke
pnpm prod:career-release-evidence
```

## Definition of live complete

URAI-Jobs V1-V5 can be marked live only when all are true:

- Exact-head CI/workflow evidence is green and recorded.
- WIF exchange succeeds for the intended repository and deploy service account.
- No long-lived GitHub deploy credential is required.
- Firebase Hosting deploy completed and intended URLs are reachable.
- Career worker is deployed, healthy, and correctly configured.
- Generic and V1-V5 production smoke passes.
- Career evidence validates and terminal states/artifacts are verified.
- Rollback path and protected environment ownership are documented.

## Current verdict

Repository-side deployment authentication is being hardened to WIF-only. Production remains **NO-GO** until provider-side WIF/IAM configuration and live deployment evidence are independently verified.
