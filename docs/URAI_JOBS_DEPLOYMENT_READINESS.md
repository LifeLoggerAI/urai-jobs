# URAI Jobs Deployment Readiness

## Current verified repository status

The exact PR #63 head before the deployment-authority repair passed:

- `npm run typecheck`
- `npm run build`
- `npm run urai-jobs:verify`
- `npm run urai-jobs:smoke`
- `npm run urai-jobs:e2e` using Firebase emulators
- all associated GitHub Actions workflows for that exact commit

A new exact head must pass again after any deployment-authority change. Repository validation is not production deployment evidence.

Emulator E2E validates Auth/Firestore startup, seeded users, job creation, queue creation, and cancellation. It does not validate Cloud Run IAM, Secret Manager, external providers, asynchronous callbacks, live retries, monitoring, or rollback.

## Canonical deployment authority

### Firebase runtime

- Repository: `LifeLoggerAI/urai-jobs`
- Branch: `main`
- Firebase alias: `urai-jobs`
- Functions source: `functions`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Storage rules: `storage.rules`
- Production Firebase deployment remains a separate authorized action with exact tested, deployed, and rollback SHAs.

### Cloud Run workers

`scripts/deploy-workers.sh` is the canonical general worker deployment path.

It currently permits only:

- `narrator-worker`

It deliberately refuses to deploy:

- `asset-worker`, which has a separate callback-facing workflow and is blocked until dispatch authentication, callback replay protection, and the shared Asset Factory contract are certified;
- `spatial-worker`, which remains a placeholder;
- `studio-worker`, which remains a placeholder;
- `career-worker`, which remains scaffold-only outside local/test use.

The narrator deployment requires:

- a dedicated runtime service account;
- a Secret Manager-backed `URAI_JOBS_WORKER_TOKEN`;
- application-level bearer authorization enforced by the worker;
- a production environment value;
- an explicit bucket;
- successful Cloud Build completion before Cloud Run deployment.

Cloud Run ingress is technically public for the current token-authenticated compatibility mode. This must not be described as unauthenticated application access: `/execute-job` rejects requests without the Secret Manager-backed token. IAM/OIDC migration remains a future hardening item.

### Asset worker

`.github/workflows/deploy-asset-worker.yml` is manual-only and protected by:

- typed `DEPLOY` confirmation;
- the GitHub `production` environment;
- workload-identity deployment credentials;
- a dedicated runtime service account;
- separate GitHub dispatch, worker-dispatch, and callback secrets;
- source checks that require dispatch and callback authorization markers before deployment.

The workflow currently remains blocked because the Asset worker source does not yet contain the required dispatch-authentication marker. This is intentional. Do not remove the check to make deployment pass.

## Required deployment configuration

Local emulator only:

- `GOOGLE_CLOUD_PROJECT=urai-jobs-dev`
- `GCLOUD_PROJECT=urai-jobs-dev`
- `FIREBASE_CONFIG={"projectId":"urai-jobs-dev"}`
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`

Canonical narrator worker deployment:

- `GCLOUD_PROJECT`
- `GCP_REGION`
- `GCS_BUCKET_NAME`
- `WORKER_RUNTIME_SERVICE_ACCOUNT`
- `URAI_JOBS_WORKER_TOKEN_SECRET`

Production must not set emulator host variables.

## Predeployment commands

```bash
npm ci
npm run typecheck
npm run build
npm run test
npm run urai-jobs:deploy-precheck
```

The precheck verifies that placeholder workers cannot enter the canonical deploy set and that the Asset workflow remains manual and fail-closed.

## Deployment commands

No production command is authorized merely because it appears below. First record current deployed SHA, target SHA, rollback SHA, project, service accounts, secret versions, affected services, and operator approval.

```bash
# Repository verification only
npm run urai-jobs:deploy-precheck

# Canonical approved-worker deployment after authorization
GCLOUD_PROJECT=<project> \
GCS_BUCKET_NAME=<bucket> \
WORKER_RUNTIME_SERVICE_ACCOUNT=<service-account> \
URAI_JOBS_WORKER_TOKEN_SECRET=<secret-name> \
npm run deploy:workers
```

Asset worker deployment must use the manual GitHub Actions workflow and cannot be invoked successfully until its source authorization gate passes.

## Rollback requirements

Before any worker deployment, record the current Cloud Run revision and image digest. Rollback must target the exact previous revision, not an assumed branch name.

```bash
gcloud run revisions list --service <service> --region <region> --project <project>
gcloud run services update-traffic <service> --to-revisions <known-good-revision>=100 --region <region> --project <project>
```

Firebase Hosting, Functions, and rules rollback remain separate operations. Revert to the exact known-good source commit and redeploy only after the affected component and data compatibility are reviewed.

## Known production blockers

- Exact current deployed SHA and rollback SHA are not established.
- Asset dispatch authentication and callback replay protection are incomplete.
- Live create, lease, execute, async callback, retry, cancellation, dead-letter, artifact access, and rollback evidence is absent for the current head.
- Spatial, Studio, and Career workers are not production implementations.
- Cross-repository privacy export/deletion and retention are incomplete.
- Monitoring alerts, backup, restore, and disaster-recovery exercises are not certified.
