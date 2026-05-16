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

Move failed jobs into:

- firestore collection: failedJobs
- optional GCS archival
- replay audit log

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
- auto-purge expired failures
