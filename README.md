# URAI Jobs Runtime

URAI Jobs Runtime is the internal worker-infrastructure preview for the URAI system-of-systems. It is not the public jobs marketplace or careers application surface, and it must not be described as production worker ready until lifecycle proof exists.

This repository owns the code paths for asynchronous URAI work using Firebase Functions, Firestore, Firebase Auth, Firebase Hosting, Google Cloud Run worker services, Pub/Sub-compatible orchestration, and Google Cloud Storage artifacts. Some worker families are still gated, scaffolded, or unverified.

## Product decision

Canonical positioning: **internal execution infrastructure preview**.

Use this repo for:

- queueing allowlisted work through guarded callables
- proving worker lifecycle behavior before production claims
- monitoring, retrying, cancelling, and reconciling jobs
- operator/admin visibility into job state and logs
- system-of-systems integration across URAI Admin, Studio, Spatial, Analytics, Communications, Privacy, and related services after each integration is proven

Do not use this repo as the public candidate/employer marketplace unless a future product decision explicitly expands it. Marketplace flows such as public job search, job detail pages, candidate applications, employer dashboards, resumes, and applicant tracking should live in a separate public app or a clearly separated future module.

## Current readiness boundary

Current status on this branch:

- local lifecycle proof harness: implemented
- job type allowlist: implemented for `narrator.tts`
- createJob idempotency: implemented
- dispatcher lease and duplicate-delivery guards: implemented
- production inline fallback: disabled by default
- narrator worker: implemented code path, requires worker auth configuration before execution
- career worker: intentionally returns NOT_IMPLEMENTED until real execution exists
- asset, spatial, and studio workers: gated or placeholder; not counted as production execution
- production lifecycle smoke: not run in this branch pass

Do not claim URAI Jobs is production worker ready until a real deployed job is created, queued, leased, executed by a real worker, status-updated, logged, and inspected end-to-end with proof artifacts.

## Architecture

The runtime follows a distributed architecture centered on Firestore as the state source of truth and Firebase Functions as the orchestration/control layer.

1. **Client / Operator UI**: Authenticated users or operators initiate allowlisted jobs through Firebase callable functions.
2. **Firebase Functions**: Validate requests, create job documents, enqueue work, lease jobs, call workers, retry expired leases, clean terminal queue entries, and reconcile stale system state.
3. **Cloud Run Workers**: Intended execution layer for subsystem-specific work. Only implemented and lifecycle-proven workers should be treated as production execution.
4. **Firestore**: Stores job state, queue entries, results, logs, leases, ownership, and permissions.
5. **Google Cloud Storage**: Stores job artifacts such as rendered media or generated audio when a real worker path writes them.
6. **Firebase Hosting**: Hosts the internal runtime/operator UI.

## Job lifecycle

A normal job moves through canonical runtime states:

```text
PENDING -> LEASED -> RUNNING -> SUCCESS
PENDING -> LEASED -> RUNNING -> FAILED -> PENDING/SUCCESS/DEAD
PENDING/LEASED/RUNNING -> CANCELLED
```

Canonical job statuses are:

```text
PENDING, LEASED, RUNNING, SUCCESS, FAILED, DEAD, CANCELLED
```

Queue entries may be cleaned up or marked terminal by backend maintenance paths, but public/admin job state should use the canonical job statuses above.

## Core Firebase Functions

The exported runtime function surface includes:

- `createJob`
- `getJobStatus`
- `getJob`
- `cancelJob`
- `executeJob`
- `processQueueTick`
- `retryExpiredLeases`
- `cleanupTerminalJobs`
- `systemReconcile`
- `onJobTerminalEvent`
- `listJobs`, `listJobLogs`, `retryJob`
- `listJobsV2`, `listJobLogsV2`, `retryJobV2`

## First supported job type: `narrator.tts`

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

Example request:

```js
const createJob = firebase.functions().httpsCallable("createJob");

const result = await createJob({
  jobType: "narrator.tts",
  payload: {
    text: "Hello from URAI Jobs Runtime.",
    voice: "en-US-Wavenet-D",
    locale: "en-US",
    format: "MP3",
    outputPrefix: "tts-outputs/smoke-test"
  }
});

console.log(result.data.jobId);
```

## Environment variables

See `.env.example` for the canonical runtime environment surface. Required production values include Firebase/GCP project IDs, worker URLs, allowed API origins, webhook secrets, worker auth tokens, and GCS bucket configuration. Do not print secret values in logs or proof artifacts.

## Local validation

Run these checks before merging runtime changes:

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile

pnpm jobs:lifecycle
pnpm check:production-lock
pnpm check:production-claims
pnpm verify:routes
pnpm jobs:verify
pnpm check:types
pnpm build
pnpm test
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
pnpm urai-jobs:e2e
```

## CI

The GitHub Actions workflow `.github/workflows/urai-jobs-runtime-ci.yml` should run install, repository invariant checks, typecheck, build, tests, smoke checks, and callable emulator E2E where configured.

## Deployment sequence

Deployment requires explicit operator approval. Do not deploy as part of an audit/fix pass unless the operator explicitly says to deploy.

1. Build and deploy Cloud Run workers.
2. Configure worker URLs and runtime secrets.
3. Deploy Firebase Functions, Firestore rules/indexes, and Hosting.
4. Run operator-approved production lifecycle smoke.
5. Store proof artifact showing job creation, queue document, lease, worker execution, terminal state, logs, and result/error.

## Runtime boundaries

This repo should remain admin/operator-only unless public marketplace features are intentionally added. Public hiring-marketplace flows should not be mixed into the runtime without a separate product decision and security review.
