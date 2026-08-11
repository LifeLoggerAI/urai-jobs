# URAI Jobs Runtime Production Deployment Runbook

This runbook covers protected production environment setup, worker deployment, Firebase deployment, and production smoke testing for `urai-jobs` as the internal **URAI Jobs Runtime**.

## Scope

This repo is the internal job execution fabric. It is not the public jobs marketplace.

Production deployment includes environment setup, short-lived Google authentication, Cloud Run worker deployment, Firebase runtime deployment, smoke testing, and manual terminal-state/artifact verification.

## Required GitHub environments

Maintain protected environments matching deployment targets:

- `prod`
- `staging`
- `dev`

Production workflows use protected environments so repository/environment rules can block accidental dispatches.

## WIF-only Google deploy identity

Deployment must use GitHub OIDC + Google Workload Identity Federation. Long-lived deploy credentials are prohibited.

Configure these non-secret GitHub variables:

```text
GCP_WIF_PROVIDER
GCP_DEPLOY_SERVICE_ACCOUNT
URAI_JOBS_FIREBASE_PROJECT_ID
```

Do not configure or restore these as deploy credentials:

```text
GCP_SERVICE_ACCOUNT_JSON
FIREBASE_SERVICE_ACCOUNT_URAI_JOBS
GCP_SA_KEY
FIREBASE_TOKEN
```

The Google Cloud Workload Identity Provider must trust the intended GitHub repository/subject, and the dedicated deploy service account must have least-privilege IAM. Validate provider-side trust and account impersonation before any production dispatch.

## Runtime/provider configuration

Application/runtime secrets and configuration are separate from deploy identity. Configure only values actually required for the release, such as:

```text
GCP_REGION
API_ALLOWED_ORIGINS
WEBHOOK_SIGNING_SECRET
GCS_BUCKET_NAME
NARRATOR_WORKER_URL
ASSET_WORKER_URL
SPATIAL_WORKER_URL
STUDIO_WORKER_URL
```

Optional where used:

```text
MAILGUN_KEY
MAILGUN_DOMAIN
WORKER_SERVICE_ACCOUNT_EMAIL
PROD_SMOKE_ID_TOKEN
```

## Deploy service-account permissions

The WIF-impersonated deploy service account needs only the permissions required for the approved operations, which may include Cloud Build submit, Cloud Run deploy, image push, Firebase/Cloud Functions deploy, Firestore rules/indexes, Hosting, and service-account act-as for approved runtime identities. Avoid broad project-level roles where narrower roles work.

## Local precheck

Run before deployment:

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm prod:precheck
pnpm typecheck
pnpm build
pnpm test
pnpm urai-jobs:smoke
```

`pnpm urai-jobs:verify` includes the WIF deployment-auth regression contract and must remain green.

## Worker deployment

After obtaining approved short-lived Google credentials / ADC:

```bash
export URAI_ENV=prod
export GCLOUD_PROJECT=<project-id>
export GCP_REGION=us-central1
export GCS_BUCKET_NAME=<bucket-name>
pnpm deploy:workers
```

Verify the expected worker services are healthy and then record their current Cloud Run URLs in protected runtime configuration.

## Firebase deployment

With the same short-lived authenticated context:

```bash
export URAI_ENV=prod
export FIREBASE_PROJECT_ID=<firebase-project-id>
export GCLOUD_PROJECT=<gcp-project-id>
export GOOGLE_CLOUD_PROJECT=<gcp-project-id>
export GCP_REGION=us-central1
pnpm deploy:firebase:prod -- prod
```

Use protected environment variables/secrets for application configuration; do not export or paste private deploy keys.

## Manual GitHub Actions deployment

Use `URAI Jobs Production Deploy` and its explicit launch confirmation. The workflow fails closed if `GCP_WIF_PROVIDER` or `GCP_DEPLOY_SERVICE_ACCOUNT` is absent.

## Production smoke test

Use a short-lived Firebase Auth ID token only for the callable smoke path when required:

```bash
export FIREBASE_PROJECT_ID=<firebase-project-id>
export GCLOUD_PROJECT=<gcp-project-id>
export GCP_REGION=us-central1
export PROD_SMOKE_ID_TOKEN=<short-lived-id-token>
export PROD_SMOKE_JOB_TYPE=narrator.tts
export PROD_SMOKE_TEXT="URAI Jobs Runtime production smoke test"
pnpm prod:smoke
```

A human operator must still verify terminal worker processing and expected artifacts after the smoke job.

## Do not launch if any of these are true

- Exact-head CI is red.
- WIF provider/repository trust has not been validated.
- The intended deploy service account cannot be impersonated through OIDC.
- A long-lived JSON/token deploy credential is required.
- Required runtime/provider secrets are missing.
- Worker URLs are empty or point to the wrong environment.
- Firestore/Functions/Hosting deploy fails.
- Any worker fails health/startup.
- Production smoke fails or never reaches terminal state.
- Required artifacts are missing.
- Admin/operator auth or rollback ownership is unclear.

## Rollback

1. Revert to the last known-good exact commit and redeploy through the same WIF-authenticated workflow.
2. Roll Cloud Run services back to the previous verified revision.
3. Disable scheduled queue processors if jobs are failing dangerously.
4. Requeue/dead-letter jobs only after the failure cause is understood.

## Final launch checklist

- [ ] Exact-head main CI green.
- [ ] Protected production environment exists.
- [ ] WIF provider trust verified for `LifeLoggerAI/urai-jobs`.
- [ ] Dedicated deploy service account and least-privilege IAM verified.
- [ ] No long-lived deploy key/token required.
- [ ] Required runtime/provider configuration installed.
- [ ] Workers deployed and healthy.
- [ ] Firebase Functions, Firestore rules/indexes, and Hosting deployed.
- [ ] Production smoke passed and terminal state verified.
- [ ] Logs/artifacts and rollback path verified.

Until all applicable checks are evidenced, production remains **NO-GO**.
