# URAI Jobs Managed Worker Runbook

## Purpose

URAI Jobs production has been validated with a production-connected local worker. The next production-hardening step is to move the worker from a terminal session into a managed runtime so queue processing continues without a developer shell.

## Current verified worker behavior

A production-connected worker was started with Application Default Credentials and processed `narrator.tts` jobs from the `urai-jobs` Firebase project.

Observed lifecycle:

```text
PENDING -> RUNNING -> COMPLETED
```

Verified smoke jobs completed by the worker include:

- `01KR9ZDD23PW3B2410PN12CN4X`
- `01KR9ZG6DBGEJ22VQQ3GG0C4QF`
- `01KRA00VP0TSR8FAAAFWM77VS9`
- `01KRA0JE51QZRW6JAGP89E4GN8`

## Recommended managed runtime

Use one of these, in order of preference:

1. Cloud Run service with min instances `1` for continuous polling.
2. Cloud Run Job triggered by Cloud Scheduler every minute for batch polling.
3. Dedicated VM/systemd worker only if Cloud Run is not suitable.

For most URAI Jobs workloads, Cloud Run service with min instances `1` is simplest because `scripts/run-worker.mjs` is a long-running polling process.

## Required environment

```bash
URAI_ENV=prod
FIREBASE_PROJECT_ID=urai-jobs
GCLOUD_PROJECT=urai-jobs
GOOGLE_CLOUD_PROJECT=urai-jobs
GCP_REGION=us-central1
URAI_WORKER_NAME=urai-jobs-worker-prod
URAI_JOB_TYPE=narrator.tts
URAI_WORKER_POLL_MS=2000
URAI_LEASE_MS=60000
URAI_MAX_ATTEMPTS=3
GCS_BUCKET_NAME=<real bucket>
NARRATOR_WORKER_URL=<real narrator worker endpoint>
ASSET_WORKER_URL=<real asset worker endpoint>
SPATIAL_WORKER_URL=<real spatial worker endpoint>
STUDIO_WORKER_URL=<real studio worker endpoint>
```

Do not deploy with placeholder values such as `replace-with-*`, `YOUR_*`, `fake`, or `dummy`.

## Service account permissions

The managed worker service account needs least-privilege access to:

- Read/write Firestore `jobs`, `jobQueue`, `jobResults`, and `logs`.
- Read any required runtime configuration documents.
- Write GCS artifacts when real worker execution writes files.
- Call downstream worker URLs when real execution is enabled.

Minimum practical roles during early launch:

- Cloud Datastore User
- Storage Object Admin, limited to the configured artifact bucket where possible
- Logs Writer

Tighten these after the first managed-worker launch.

## Local production worker command

Use only for manual validation:

```bash
gcloud auth application-default login
gcloud config set project urai-jobs

export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GOOGLE_CLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
export URAI_WORKER_NAME=prod-local-worker
export URAI_JOB_TYPE=narrator.tts

pnpm run worker:run
```

## Cloud Run container shape

The service should run:

```bash
pnpm install --frozen-lockfile
pnpm run worker:run
```

If packaged as a container, build from the repository root and ensure `scripts/run-worker.mjs`, `package.json`, and workspace dependencies are present.

## Health and monitoring

Monitor:

- Count of `jobQueue` documents in `PENDING` older than 5 minutes.
- Count of `jobQueue` documents in `RUNNING` older than `URAI_LEASE_MS`.
- Count of `jobs` with `DEAD` or repeated `FAILED` states.
- Cloud Run restarts/errors.
- Worker log lines containing `[WORKER] failed` or `[WORKER] loop error`.

Recommended alert thresholds:

- PENDING backlog older than 10 minutes: warning.
- PENDING backlog older than 30 minutes: critical.
- DEAD jobs > 0 in 15 minutes: warning.
- Worker instance count 0 for more than 2 minutes: critical.

## Validation after managed deployment

1. Generate a production smoke token:

```bash
export FIREBASE_WEB_API_KEY=<real Firebase Web API key>
export SMOKE_EMAIL=smoke@urailabs.com
read -s -p "Password: " SMOKE_PASSWORD
echo
export SMOKE_PASSWORD
export PROD_SMOKE_ID_TOKEN="$(pnpm run --silent prod:smoke-token)"
```

2. Submit a smoke job:

```bash
export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
pnpm run prod:smoke
```

3. Confirm worker logs show:

```text
[WORKER] picked job <jobId>
[WORKER] executing job=<jobId>
[WORKER] completed job <jobId>
```

4. Confirm Firestore status is `COMPLETED` for both `jobs/<jobId>` and `jobQueue/<jobId>`.

## Rollback

If managed worker deployment causes errors:

1. Set Cloud Run min instances to `0` or pause Cloud Scheduler.
2. Revert the worker deployment image/configuration.
3. Re-run `pnpm run worker:run` locally only if queue processing must continue during rollback.
4. Requeue or inspect affected `FAILED`/`DEAD` jobs using:

```bash
pnpm run dead:requeue
pnpm run leases:reclaim
```

## Open follow-up

Create a dedicated deployment artifact for the managed worker:

- `Dockerfile.worker` or Cloud Build config
- Cloud Run service definition
- service account IAM bootstrap
- monitoring alert policy templates
