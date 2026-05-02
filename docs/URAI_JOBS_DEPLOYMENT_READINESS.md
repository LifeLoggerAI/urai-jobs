# URAI Jobs Deployment Readiness

## Current Verified Status

The following local proof set has passed:

- `npm run typecheck`
- `npm run build`
- `npm run urai-jobs:verify`
- `npm run urai-jobs:smoke`
- `npm run urai-jobs:e2e` using Firebase emulators

Emulator E2E validated:

- Auth/Firestore emulator startup using IPv4 host binding
- Test users seeded
- Test job created
- Job document verified
- jobQueue entry verified
- Cancel job path verified

## Firebase Resources

- Project: `urai-jobs-dev`
- Hosting: configured through `firebase.json`
- Functions source: `functions`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Auth: used for admin/user role validation
- Emulator config: Firestore/Auth pinned to `127.0.0.1` for this workspace

## Required Environment Variables

Local emulator only:

- `GOOGLE_CLOUD_PROJECT=urai-jobs-dev`
- `GCLOUD_PROJECT=urai-jobs-dev`
- `FIREBASE_CONFIG={"projectId":"urai-jobs-dev"}`
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`

Production deploy should not set emulator host variables.

## Predeploy Commands

```bash
npm run typecheck
npm run build
npm run urai-jobs:verify
npm run urai-jobs:smoke
npm run urai-jobs:deploy-precheck
```

## Deploy Commands

```bash
firebase use urai-jobs-dev
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only functions,hosting,firestore:rules,firestore:indexes
```

## Rollback Notes

Hosting:

```bash
firebase hosting:rollback
```

Functions rollback depends on Firebase release history and should be handled by redeploying the last known good build artifact or reverting the commit and redeploying functions.

Firestore rules/index recovery should be handled by reverting `firestore.rules` and `firestore.indexes.json`, then redeploying:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Known Production Risks

- Real Firebase Auth admin/operator claims must be seeded before production admin use.
- Live create/list/get/retry/cancel paths must be validated against real Firebase permissions after deploy.
- Worker runtime credentials and provider credentials must exist for real execution jobs.
- Emulator E2E validates persistence, queue entry, and cancel path; it does not validate every external provider.
- Production logs, alerting, and monitoring policy still need final operator setup.
