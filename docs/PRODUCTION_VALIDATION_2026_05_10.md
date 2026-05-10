# URAI Jobs Production Validation - 2026-05-10

## Summary

URAI Jobs was deployed to Firebase production project `urai-jobs` and validated through the public hosting surface, authenticated production callables, Firestore queue writes, and a production-connected worker run.

## Verified deployment surface

- Firebase project: `urai-jobs`
- Hosting URL: `https://urai-jobs.web.app`
- Firebase Console: `https://console.firebase.google.com/project/urai-jobs/overview`
- Region: `us-central1`

## Completed proof set

- `pnpm install`
- `pnpm run urai-jobs:verify`
- `pnpm run urai-jobs:smoke`
- Firebase emulator E2E via `pnpm run urai-jobs:e2e`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run prod:precheck`
- `pnpm run urai-jobs:deploy-precheck`
- `pnpm run deploy:firebase:prod`
- `pnpm run prod:smoke`
- `pnpm run worker:run` with production ADC/project settings

## Production deploy evidence

Firebase deploy completed successfully for:

- Firestore rules
- Firestore indexes
- Firebase Hosting
- Cloud Functions

Functions updated successfully included:

- `cancelJob`
- `createJob`
- `executeJob`
- `getJob`
- `listJobLogs`
- `listJobLogsV2`
- `listJobs`
- `listJobsV2`
- `processQueueTick`
- `retryExpiredLeases`
- `retryJob`
- `retryJobV2`
- `cleanupTerminalJobs`
- `onJobTerminalEvent`
- `systemReconcile`

## Public hosting evidence

`https://urai-jobs.web.app` returned HTTP 200 and served the Vite app shell.

## Authenticated production smoke evidence

Production smoke successfully authenticated with a Firebase Auth ID token and validated:

- `createJob` callable
- `getJob` callable
- Firestore `jobs` write/read path
- Firestore `jobQueue` enqueue path

Smoke job IDs observed:

- `01KR9ZDD23PW3B2410PN12CN4X`
- `01KR9ZG6DBGEJ22VQQ3GG0C4QF`
- `01KRA00VP0TSR8FAAAFWM77VS9`
- `01KRA0JE51QZRW6JAGP89E4GN8`

## Worker processing evidence

A production-connected worker was started with:

```bash
export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GOOGLE_CLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
export URAI_WORKER_NAME=prod-local-worker
export URAI_JOB_TYPE=narrator.tts
pnpm run worker:run
```

The worker picked up and completed queued production jobs, including the smoke jobs:

- `01KR9ZDD23PW3B2410PN12CN4X`
- `01KR9ZG6DBGEJ22VQQ3GG0C4QF`
- `01KRA00VP0TSR8FAAAFWM77VS9`
- `01KRA0JE51QZRW6JAGP89E4GN8`

Expected lifecycle observed:

```text
PENDING -> RUNNING -> COMPLETED
```

## Current status

URAI Jobs is production-deployed and runtime validated for the Firebase-hosted app, authenticated callables, Firestore queue, and worker completion loop.

## Remaining release hardening

- Rotate any credentials exposed during manual validation.
- Move the local production-connected worker into a managed runtime such as Cloud Run, Cloud Run Jobs, or a scheduled worker process.
- Replace any placeholder production env values with real service endpoints and secrets.
- Connect and verify `uraijobs.com` and `www.uraijobs.com` custom domains.
- Verify real external worker/service integrations for narrator, asset, spatial, and studio workers.
- Verify GCS artifact output for non-simulated worker executions.
- Add long-running production monitoring, alerting, and runbook ownership.
- Complete public marketplace UX routes, legal/privacy pages, deletion/export flows, analytics, and notification delivery.
