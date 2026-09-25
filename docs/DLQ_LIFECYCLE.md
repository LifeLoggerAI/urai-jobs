# Dead Letter Queue Lifecycle

## Goals

Provide safe recovery for:

- exhausted retries
- poison jobs
- worker crashes
- malformed payloads
- external dependency failures

## Lifecycle

### 1. Retry

Jobs retry until:

- maxAttempts reached
- lease expiration exceeded
- unrecoverable classification detected

## 2. Dead-letter transition

Current runtime representation:

- canonical job record remains in `jobs` with `status: DEAD`;
- corresponding queue record may remain in `jobQueue` with `status: DEAD` until governed cleanup;
- replay/audit history must be preserved;
- no separate `failedJobs` collection is current authority.

## 3. Alerting

Trigger alerts on:

- DLQ growth spikes
- repeated poison payloads
- repeated worker failures
- retry storms

## 4. Replay tooling

Replay should:

- validate payload schema
- reset retry counters
- preserve original request IDs
- preserve audit metadata

## 5. Retention

Recommended:

- retain failed jobs for 30 days
- archive artifacts after 7 days
- scan and report expired DEAD candidates;
- destructive purge remains governance-hard-off until retention/deletion policy, backup/restore evidence, and legal/privacy approval are certified.
