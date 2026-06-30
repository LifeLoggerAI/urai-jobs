# Queue Runtime Map

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Runtime components

- `createJob`: creates `jobs/{jobId}` and `jobQueue/{jobId}`.
- `jobs`: source of truth for job state, owner, payload, result, error, timestamps.
- `jobQueue`: queue leasing state.
- `processQueueTick`: leases due `PENDING` work.
- `job-execution`: execution message topic.
- `executeJob`: receives execution messages, validates lease token, and calls configured worker.
- `retryExpiredLeases`: requeues expired leases or fails exhausted jobs.
- `processQueueNow`: operator queue drain.
- `cancelJob`: cancels active jobs.
- Admin APIs: list jobs, read logs, retry failed jobs.

## Source-level hardening applied

- Missing worker URL in staging/prod now fails instead of succeeding with inline fallback.
- Worker auth header is sent when token is configured.
- createJob now validates job type, payload size, permission, rate limit, owner/org metadata, and audit log.

## External verification required

- Firebase project and deployed Functions.
- Scheduler jobs.
- Message topic and delivery metrics.
- Firestore indexes and security rules deployed.
- Worker services and invocation security.
- GCS bucket and artifact object proof.
