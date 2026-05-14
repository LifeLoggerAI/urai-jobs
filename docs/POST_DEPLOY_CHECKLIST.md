# URAI Jobs Post-Deploy Checklist

Use this checklist after production deployment to verify the runtime can accept, execute, observe, and recover jobs.

## 1. Environment confirmation

```bash
gcloud auth application-default login
gcloud config set project urai-jobs
export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GOOGLE_CLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
```

Confirm:

- Firebase project is correct.
- Firestore is reachable.
- Cloud Functions are deployed.
- Worker service account is available.
- No local emulator variables are set for production checks.

## 2. Run production precheck

```bash
pnpm run prod:precheck
```

Expected:

- required production env vars pass.
- Firebase/GCP identifiers match the production project.
- no placeholder values are present.

## 3. Run production smoke

```bash
pnpm run prod:smoke
```

Expected:

- smoke user obtains a valid Firebase Auth ID token.
- `createJob` callable succeeds.
- `getJob` callable succeeds.
- job ID is recorded for follow-up verification.

## 4. Queue a narrator test job manually if needed

```bash
pnpm run job:queue -- --type narrator.tts --payload '{"text":"URAI Jobs production smoke test."}'
```

Expected:

- job document exists.
- queue entry exists.
- initial job status is `CREATED` or `QUEUED`.
- initial queue status is `READY`.

## 5. Run local production worker if managed worker is not active

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
job: CREATED or QUEUED -> RUNNING -> SUCCESS
queue: READY -> LEASED -> DONE
```

## 6. Firestore verification

Check:

- `jobs/<jobId>`
- `jobQueue/<jobId>`
- `jobResults/<jobId>`
- `logs` filtered by `jobId`

Expected:

- job status `SUCCESS`
- queue status `DONE`
- result document exists
- worker log exists

## 7. Security cleanup

- [ ] Rotate any password or token exposed during manual testing.
- [ ] Confirm smoke user is dedicated and low blast-radius.
- [ ] Confirm smoke user has only required admin/operator claims.
- [ ] Remove local shell history if secrets were pasted.
- [ ] Confirm no secrets were committed.

## 8. Production hardening follow-up

- [ ] Record smoke job ID and workflow URL in release evidence.
- [ ] Confirm alerts/logging are visible to operators.
- [ ] Confirm rollback path is known.
- [ ] File follow-up issues for any non-blocking warnings.
