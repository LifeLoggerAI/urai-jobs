# URAI-Jobs

A production-grade job runner and queueing system built on Firebase.

## Prerequisites

- Node.js (v20)
- pnpm
- Firebase CLI

## Installation

```bash
pnpm install
```

## Local Development

To start the local development environment, which includes the Firebase emulators and the web app, run:

```bash
./scripts/urai-jobs_golden.sh
```

## Running Tests

To run the unit and integration tests, run:

```bash
pnpm test
```

To run the smoke test, which enqueues and processes a job, run:

```bash
pnpm smoke
```

## Deployment

To deploy the project to Firebase, run:

```bash
firebase deploy
```

## Adding a New Job

1.  Add a new job definition to `functions/src/jobs/registry.ts`.
2.  Implement the job handler in the same file.
3.  (Optional) Add a new smoke test to `test/smoke.test.ts` to test the new job.

## Troubleshooting

- If you have issues with the emulators, try restarting them with `firebase emulators:start --only functions,firestore`.
- If you have issues with dependencies, try running `pnpm install` again.
