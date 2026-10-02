# URAI Jobs Launch Runbook

This runbook is the final operator checklist for launching the standalone `LifeLoggerAI/urai-jobs` system.

## 1. Required GitHub secrets

Confirm these exist in GitHub Actions secrets:

- `FIREBASE_SERVICE_ACCOUNT_URAI_JOBS`
- `URAI_JOBS_FIREBASE_PROJECT_ID`

Optional production variable:

- `URAI_JOBS_PRODUCTION_URL`

## 2. SceneTruth receipt authority

Before any Life Movie render admission is enabled:

- Create `URAI_SCENE_TRUTH_RECEIPT_HMAC` in Secret Manager for both UrAi Studio and UrAi Jobs using the same high-entropy value.
- Record and approve the exact numeric Secret Manager version for Jobs as `APPROVED_SCENE_TRUTH_HMAC_VERSION`.
- Confirm the approved version is ENABLED and is the latest enabled version before Firebase deploy.
- Never expose the secret value in GitHub, build output, receipts, or client configuration.
- Retain only the secret name plus approved/resolved numeric versions in deployment evidence.

## 3. Firebase project setup

In Firebase Console:

- Confirm the Firebase project matches `URAI_JOBS_FIREBASE_PROJECT_ID`.
- Confirm Firebase Hosting site is connected.
- Confirm Firestore rules and indexes are deployable.
- Confirm Functions deploy with Node.js 22 runtime.
- Confirm Cloud Run worker URLs and required worker environment variables are configured.

## 4. Auth and operator access

If the deployed UI uses Firebase Auth:

- Enable the intended sign-in provider.
- Add the production domain to authorized domains.
- Add `www` domain if used.
- Assign operator/admin custom claims only to trusted URAI operators.
- Confirm non-operator users cannot access operator-only controls.

## 5. CI gate

Before production deploy, verify these checks pass:

- workspace install
- root verify script
- web typecheck and build
- functions build and tests
- smoke script
- e2e script, if enabled
- Firebase config smoke
- launch-lock preflight

## 6. Signoff ledger

Complete every section in:

```text
verification/signoffs.md
```

No `Status: PENDING` lines may remain before production deploy.

Required approvals:

- Engineering
- Security / Privacy
- Domain / DNS / SSL
- Product Launch

## 7. Production deploy

Run the manual workflow:

```text
URAI Jobs Production Deploy
```

Use input:

```text
LAUNCH-UNLOCK
```

## 8. Production smoke

The production workflow should verify:

- production homepage loads
- admin route loads for the deployed app shell
- create route loads for the deployed app shell
- Firebase callable functions are deployed
- queue and job status flows pass controlled smoke tests

Manual checks after deploy:

- Landing page loads on mobile and desktop.
- `/create` loads.
- `/admin` loads.
- `/privacy`, `/terms`, and `/trust` load.
- Smoke job can be submitted in a controlled environment.
- Queue status transitions are observable.
- Retry/cancel/admin controls behave according to operator permissions.

## 9. Rollback

If production fails:

- Roll back Firebase Hosting release in Firebase Console.
- Redeploy the prior known-good Functions commit.
- Pause or disable worker execution if needed.
- Inspect job queue, dead-letter records, logs, and workflow output.
- Record the incident and required follow-up before re-launch.
