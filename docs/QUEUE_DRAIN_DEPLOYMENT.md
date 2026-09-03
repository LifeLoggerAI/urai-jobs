# URAI Jobs Queue Drain Deployment Handoff

Last updated: 2026-05-20

## Context

The production Admin UI is live and reading real job state. A live screenshot showed queued jobs with no active leased or running jobs. That means the deployment is live, but the next production validation target is queue drainage.

## Queue-drain fixes on main

The following fixes are committed on main and should be included in the next production deploy:

- Route `asset-render` and `asset*` jobs to `ASSET_WORKER_URL`.
- Route `spatial-index` and `spatial*` jobs to `SPATIAL_WORKER_URL`.
- Route `studio-render` and `studio*` jobs to `STUDIO_WORKER_URL`.
- Route narrator jobs to `NARRATOR_WORKER_URL` at `/execute-job`.
- Mirror the lease token to `execution.leaseToken` for compatibility with currently deployed subsystem workers.
- Add `processQueueNow` callable for operator-triggered queue dispatch.
- Export `processQueueNow` from `functions/src/index.ts`.
- Add the `processQueueNow` frontend API client.
- Add queue runtime wiring verifier.
- Add smoke coverage for subsystem routing and lease-token compatibility.

Relevant latest commits:

- `b5e0c6d` — route deployed workers by subsystem.
- `25701b2` — add operator callable to process queue now.
- `6ba3034` — export operator queue drain callable.
- `abc1979` — add process queue now API client.
- `ab6d933` — mirror lease token for deployed subsystem workers.
- `6b416d4` — smoke coverage for lease-token compatibility.
- `79ee3ff` — queue runtime wiring verifier.

## Pre-deploy local verification

Run from the repo root:

```bash
git fetch origin main
git reset --hard origin/main
node scripts/queue-runtime-verify.mjs
node scripts/urai-jobs-smoke.mjs
npm run typecheck
```

## Production deploy

Run the production deploy workflow from latest main:

```bash
git fetch origin main
git reset --hard origin/main
bash scripts/run-deploy-publish-workflow.sh
```

Recommended workflow inputs:

- `confirm_launch_unlock`: `LAUNCH-UNLOCK`
- `deploy_workers`: `true`
- `run_smoke`: `false`
- `require_custom_domains`: `false`

## Post-deploy verification

After deployment completes:

1. Open the Admin UI.
2. Refresh the queue state.
3. Wait one scheduler tick or invoke `processQueueNow` from an authenticated operator client.
4. Confirm queued jobs move from `PENDING` to `LEASED`, then `RUNNING`, then either `SUCCESS` or `FAILED`.
5. For failures, open Details and confirm logs identify the worker route, job type, and error.

Expected healthy progression:

```text
PENDING -> LEASED -> RUNNING -> SUCCESS
```

Expected invalid-payload progression:

```text
PENDING -> LEASED -> RUNNING -> FAILED
```

## Failure diagnosis

If jobs remain `PENDING`:

- Check `processQueueTick` scheduler logs.
- Check Firestore `jobQueue.availableAt` values.
- Check Firestore indexes for `status` plus `availableAt` query support.
- Run or invoke `processQueueNow` once as an operator.

If jobs become `LEASED` but not `RUNNING`:

- Check Pub/Sub topic `job-execution`.
- Check Cloud Function `executeJob` logs.
- Check function env vars for worker URLs.

If jobs become `RUNNING` then `FAILED`:

- Open job Details in Admin.
- Check job logs for `executeJob` entries.
- Confirm job type maps to the correct worker URL and route.
- Confirm worker accepted the lease token.

If non-narrator jobs fail with lease validation:

- Confirm the deployed `executeJob` includes `execution.leaseToken` in the RUNNING update.

## Rollback

If the deploy introduces a regression:

1. Use Firebase Hosting rollback for the web app if only the UI regressed.
2. Use Cloud Functions rollback/redeploy from the previous known-good commit if queue execution regressed.
3. Use Cloud Run rollback helpers for individual worker regressions.
4. Leave failed jobs in `FAILED` for inspection unless the failure is known transient, then retry through Admin.

## Tracking

Queue-drain deployment and verification is tracked in GitHub issue #51.
