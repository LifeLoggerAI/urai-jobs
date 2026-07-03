# URAI Jobs Runtime

URAI Jobs Runtime is the internal production job-execution fabric for the URAI system-of-systems. It is not the public jobs marketplace or careers application surface.

This repository owns asynchronous, long-running work across URAI subsystems using Firebase Functions, Firestore, Firebase Auth, Firebase Hosting, Google Cloud Run workers, Pub/Sub-compatible orchestration, and Google Cloud Storage artifacts.

## Product decision

Canonical positioning: **internal execution infrastructure**.

Use this repo for:

- queueing controlled runtime work
- executing subsystem jobs through Cloud Run workers
- monitoring, retrying, cancelling, and reconciling jobs
- operator/admin visibility into job state and logs
- system-of-systems integration across URAI Admin, Studio, Spatial, Analytics, Communications, Privacy, and related services

Do not use this repo as the public candidate/employer marketplace unless a future product decision explicitly expands it.

## Worker proof boundary

A job is worker-proven only when it is created through an authorized callable, queued in Firestore, leased, published to Pub/Sub, received by `executeJob`, sent to a configured worker URL, processed by an authenticated worker, persisted with a real result/artifact, visible in logs, and observable in the operator dashboard.

Inline fallback is local/emulator-only. It is disabled for `URAI_ENV=staging`, `URAI_ENV=prod`, and `URAI_ENV=production`. Inline fallback output must not be used as live worker proof.

## Architecture

The runtime follows a distributed architecture centered on Firestore as the state source of truth and Firebase Functions as the orchestration/control layer.

1. **Client / Operator UI**: Authenticated users or operators initiate jobs through Firebase callable functions.
2. **Firebase Functions**: Validate requests, create job documents, enqueue work, lease jobs, call workers, retry expired leases, clean terminal queue entries, and reconcile stale system state.
3. **Cloud Run Workers**: Execute subsystem-specific work such as narrator TTS, asset rendering, spatial indexing, or studio processing.
4. **Firestore**: Stores job state, queue entries, results, logs, leases, ownership, and permissions.
5. **Google Cloud Storage**: Stores job artifacts such as rendered media or generated audio.
6. **Firebase Hosting**: Hosts the internal runtime/operator UI.

## Job lifecycle

A normal job moves through canonical runtime states:

```text
PENDING -> LEASED -> RUNNING -> SUCCESS
PENDING -> LEASED -> RUNNING -> FAILED -> PENDING/SUCCESS/DEAD
PENDING/LEASED/RUNNING -> CANCELLED
```

Canonical statuses are:

```text
PENDING, LEASED, RUNNING, SUCCESS, FAILED, DEAD, CANCELLED
```

## Core Firebase Functions

The exported runtime function surface includes:

- `createJob`
- `getJobStatus`
- `getJob`
- `cancelJob`
- `executeJob`
- `processQueueTick`
- `processQueueNow`
- `retryExpiredLeases`
- `cleanupTerminalJobs`
- `systemReconcile`
- `onJobTerminalEvent`
- `listJobs`, `listJobLogs`, `retryJob`
- `listJobsV2`, `listJobLogsV2`, `retryJobV2`

## First real job type: `narrator.tts`

Example payload contract:

```ts
interface NarratorTtsPayload {
  text: string;
  voice?: string;
  voiceId?: string;
  locale?: string;
  speed?: number;
  format?: "MP3" | "OGG_OPUS" | string;
  outputPrefix?: string;
}
```

## Environment variables

See `.env.example` for the canonical runtime environment surface. Required deployed values include Firebase/GCP project IDs, worker URLs, allowed API origins, worker auth token or Cloud Run IAM, Pub/Sub topic, webhook secrets, and GCS bucket configuration.

## Local validation

Run these checks before merging runtime changes:

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
pnpm test
pnpm urai-jobs:smoke
```

Callable E2E requires Firebase emulators:

```bash
firebase emulators:start --only firestore,auth,functions,pubsub --project demo-urai-jobs
```

In another terminal:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FUNCTIONS_EMULATOR_ORIGIN=http://127.0.0.1:5001 \
FIREBASE_PROJECT_ID=demo-urai-jobs \
GCLOUD_PROJECT=demo-urai-jobs \
URAI_ENV=local \
URAI_JOBS_ALLOW_INLINE_FALLBACK=true \
pnpm urai-jobs:e2e
```

## CI

The GitHub Actions workflow `.github/workflows/urai-jobs-runtime-ci.yml` runs install, repository invariant checks, typecheck, build, tests, smoke checks, and callable emulator E2E.

## Deployment sequence

1. Build and deploy Cloud Run workers.
2. Configure worker URLs and runtime secrets.
3. Deploy Firebase Functions, Firestore rules/indexes, and Hosting.
4. Run staging worker health and staging lifecycle smoke before any production smoke.

```bash
pnpm build
firebase use prod
firebase deploy
```

## Runtime boundaries

This repo should remain admin/operator-only unless public marketplace features are intentionally added. Public hiring-marketplace flows should not be mixed into the runtime without a separate product decision and security review.
