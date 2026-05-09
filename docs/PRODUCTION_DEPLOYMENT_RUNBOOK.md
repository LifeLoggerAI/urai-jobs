# URAI Jobs Runtime Production Deployment Runbook

This runbook covers production environment setup, worker deployment, Firebase deployment, and production smoke testing for `urai-jobs` as the internal **URAI Jobs Runtime**.

## Scope

This repo is the internal job execution fabric. It is not the public jobs marketplace.

Production deployment includes:

1. Environment and secret setup.
2. Cloud Run worker deployment.
3. Firebase Functions, Firestore, indexes, and Hosting deployment.
4. Production callable smoke testing.
5. Manual verification of worker terminal state and artifacts.

## Required GitHub environment

Create GitHub Environments matching deployment targets:

- `prod`
- `staging`
- `dev`

The production workflow uses `environment: ${{ inputs.target }}` so environment protection rules can block accidental deploys.

## Required GitHub Actions secrets

Add these to the relevant GitHub Environment or repository secrets:

```text
GCP_SERVICE_ACCOUNT_JSON
FIREBASE_PROJECT_ID
GCLOUD_PROJECT
GOOGLE_CLOUD_PROJECT
GCP_REGION
API_ALLOWED_ORIGINS
WEBHOOK_SIGNING_SECRET
GCS_BUCKET_NAME
NARRATOR_WORKER_URL
ASSET_WORKER_URL
SPATIAL_WORKER_URL
STUDIO_WORKER_URL
```

Optional but recommended:

```text
MAILGUN_KEY
MAILGUN_DOMAIN
WORKER_SERVICE_ACCOUNT_EMAIL
PROD_SMOKE_ID_TOKEN
```

## Service account permissions

The deploy service account behind `GCP_SERVICE_ACCOUNT_JSON` needs enough permission for:

- Cloud Build submit
- Cloud Run deploy
- Artifact/Container Registry image push, depending on project setup
- Firebase deploy
- Cloud Functions deploy
- Firestore rules/indexes deploy
- Firebase Hosting deploy
- Service account user/act-as if workers use a runtime service account

Use least privilege in production where possible.

## Local precheck

Run this before deploying:

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
pnpm prod:precheck
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
pnpm test
pnpm urai-jobs:smoke
```

## Worker deployment

Deploy all runtime workers:

```bash
export URAI_ENV=prod
export GCLOUD_PROJECT=<project-id>
export GCP_REGION=us-central1
export GCS_BUCKET_NAME=<bucket-name>

pnpm deploy:workers
```

The script deploys:

- `narrator-worker`
- `asset-worker`
- `spatial-worker`
- `studio-worker`

After deployment, copy the Cloud Run service URLs into the relevant environment/secrets:

```text
NARRATOR_WORKER_URL
ASSET_WORKER_URL
SPATIAL_WORKER_URL
STUDIO_WORKER_URL
```

## Firebase deployment

Deploy Firebase runtime resources:

```bash
export URAI_ENV=prod
export FIREBASE_PROJECT_ID=<firebase-project-id>
export GCLOUD_PROJECT=<gcp-project-id>
export GOOGLE_CLOUD_PROJECT=<gcp-project-id>
export GCP_REGION=us-central1
export API_ALLOWED_ORIGINS=https://urai.app,https://admin.urai.app,https://analytics.urai.app
export WEBHOOK_SIGNING_SECRET=<secret>
export GCS_BUCKET_NAME=<bucket-name>
export NARRATOR_WORKER_URL=<cloud-run-url>
export ASSET_WORKER_URL=<cloud-run-url>
export SPATIAL_WORKER_URL=<cloud-run-url>
export STUDIO_WORKER_URL=<cloud-run-url>

pnpm deploy:firebase:prod -- prod
```

## Manual GitHub Actions deployment

Use workflow:

```text
URAI Jobs Production Deploy
```

Inputs:

```text
confirm_launch_unlock = LAUNCH-UNLOCK
target = prod
deploy_workers = true
run_smoke = true only when PROD_SMOKE_ID_TOKEN is configured
```

## Production smoke test

Set a short-lived Firebase Auth ID token in the environment:

```bash
export FIREBASE_PROJECT_ID=<firebase-project-id>
export GCLOUD_PROJECT=<gcp-project-id>
export GCP_REGION=us-central1
export PROD_SMOKE_ID_TOKEN=<short-lived-id-token>
export PROD_SMOKE_JOB_TYPE=narrator.tts
export PROD_SMOKE_TEXT="URAI Jobs Runtime production smoke test"

pnpm prod:smoke
```

Smoke pass criteria:

1. `createJob` callable returns a `jobId`.
2. `getJobStatus` callable responds for that job.
3. Firestore contains `jobs/{jobId}`.
4. Firestore contains `jobQueue/{jobId}`.
5. Worker moves the job to terminal state.
6. Logs/results/artifacts are visible where expected.

The script validates callable submission/status. A human operator must still verify terminal worker processing and GCS artifacts after the smoke job.

## Do not launch if any of these are true

- CI is red on `main`.
- Required secrets are missing.
- Worker URLs are empty or point to staging/dev by mistake.
- Firestore rules/index deploy fails.
- Any worker fails health/startup.
- `prod:smoke` fails.
- Smoke job never reaches terminal state.
- Artifacts are missing from GCS for artifact-producing jobs.
- Admin/operator auth is not enforced.

## Rollback

1. Revert the Firebase deployment to the last known good commit and redeploy.
2. Roll Cloud Run services back to the previous revision in the Cloud Run console or via `gcloud run services update-traffic`.
3. Disable scheduled queue processors if jobs are failing dangerously.
4. Requeue or dead-letter affected jobs only after the failure cause is understood.

## Final launch checklist

- [ ] Main branch CI green.
- [ ] GitHub production environment exists.
- [ ] Required secrets configured.
- [ ] Cloud Run workers deployed.
- [ ] Worker URLs stored in secrets/env.
- [ ] Firebase Functions deployed.
- [ ] Firestore rules deployed.
- [ ] Firestore indexes deployed.
- [ ] Hosting deployed.
- [ ] Production smoke submitted.
- [ ] Smoke job reached terminal state.
- [ ] Logs and artifacts verified.
- [ ] Admin/operator access confirmed.
