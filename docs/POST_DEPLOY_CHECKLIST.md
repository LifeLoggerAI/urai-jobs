# URAI Jobs Post-Deploy Checklist

Use this after every production deploy.

## 1. Local/repo checks

```bash
pnpm install
pnpm run urai-jobs:verify
pnpm run urai-jobs:smoke
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run urai-jobs:deploy-precheck
pnpm run prod:precheck
```

## 2. Firebase deploy

```bash
pnpm run deploy:firebase:prod
```

Expected:

- Firestore rules released.
- Firestore indexes deployed.
- Firebase Hosting release completed.
- Cloud Functions updated successfully.

## 3. Public hosting smoke

```bash
curl -I https://urai-jobs.web.app
curl -s https://urai-jobs.web.app | head
```

Expected:

- HTTP `200`.
- URAI Jobs app shell is served.

After custom domain connection, also run:

```bash
curl -I https://uraijobs.com
curl -I https://www.uraijobs.com
```

## 4. Authenticated callable smoke

Generate a short-lived ID token:

```bash
export FIREBASE_WEB_API_KEY=<real Firebase Web API key>
export SMOKE_EMAIL=smoke@urailabs.com
read -s -p "Password: " SMOKE_PASSWORD
echo
export SMOKE_PASSWORD
export PROD_SMOKE_ID_TOKEN="$(pnpm run --silent prod:smoke-token)"
echo "$PROD_SMOKE_ID_TOKEN" | cut -c1-30
```

Expected token prefix:

```text
eyJ
```

Run smoke:

```bash
export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
pnpm run prod:smoke
```

Expected:

- `createJob` returns a job ID.
- `getJob` returns the same job.
- Job starts as `PENDING`.

## 5. Worker processing smoke

For local production-connected validation only:

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

Expected worker logs:

```text
[WORKER] picked job <jobId>
[WORKER] executing job=<jobId> type=narrator.tts
[WORKER] completed job <jobId>
```

Expected Firestore lifecycle:

```text
PENDING -> RUNNING -> COMPLETED
```

## 6. Firestore verification

Check:

- `jobs/<jobId>`
- `jobQueue/<jobId>`
- `jobResults/<jobId>`
- `logs` filtered by `jobId`

Expected:

- job status `COMPLETED`
- queue status `COMPLETED`
- result document exists
- worker log exists

## 7. Security cleanup

- [ ] Rotate any password or token exposed during manual testing.
- [ ] Confirm smoke user is dedicated and low blast-radius.
- [ ] Confirm smoke user has only required admin/operator claims.
- [ ] Remove local shell history if secrets were pasted.
- [ ] Confirm no secrets were committed.

## 8. Production hardening follow-up

- [ ] Managed worker deployed to Cloud Run or equivalent.
- [ ] Custom domains connected and verified.
- [ ] External worker URLs verified.
- [ ] GCS artifact output verified.
- [ ] Monitoring/alerts configured.
- [ ] Marketplace UX routes completed.
- [ ] Legal/privacy/deletion/export flows completed.
- [ ] Analytics and notifications integrated.

## 9. Evidence capture

Record in `docs/PRODUCTION_VALIDATION_<date>.md`:

- deploy timestamp
- deployed commit SHA
- hosting URL
- smoke job IDs
- worker completed job IDs
- custom domain status
- known follow-ups
