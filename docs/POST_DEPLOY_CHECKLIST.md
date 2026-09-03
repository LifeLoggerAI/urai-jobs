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

Generate a short-lived ID token using the production smoke-token helper, then run:

```bash
pnpm run prod:smoke
```

Expected:

- `createJob` returns a job ID.
- `getJob` returns the same job.
- The job starts as `CREATED` or `QUEUED`.
- The queue entry starts as `READY`.

## 5. Worker processing smoke

For local production-connected validation only, run the worker with production project, region, worker name, and job type environment configured.

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

- [ ] Managed worker deployed to Cloud Run or equivalent.
- [ ] Custom domains connected and verified.
- [ ] External worker URLs verified.
- [ ] GCS artifact output verified.
- [ ] Monitoring/alerts configured.
- [ ] Runtime release evidence recorded.
