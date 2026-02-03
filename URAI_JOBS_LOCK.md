# URAI-JOBS LOCK: The Canonical Job Control Plane

**STATUS: GREEN ✅ / DONE ✅ / FROZEN ❄️**

This document describes the architecture, API, and state machine of `urai-jobs`, the definitive job control plane for URAI. This service is now considered complete and locked. No further changes should be made without a formal review process.

## Architecture

`urai-jobs` is a serverless application built on Google Cloud Functions and Firestore. It provides a simple, robust, and scalable system for enqueuing, tracking, and auditing jobs. The system is designed to be the central source of truth for all asynchronous tasks within the URAI ecosystem.

- **API**: A set of HTTP endpoints for creating, querying, and managing jobs.
- **State Store**: Firestore is used to store the state of all jobs in the `jobs` collection.
- **Audit Log**: All state transitions and actions are recorded in the `jobAudit` collection, providing a complete and immutable history of every job.
- **Locking**: An atomic, lease-based locking mechanism ensures that only one worker can process a job at a time.

## API Contract

All endpoints require an `x-urai-internal-key` header for authentication. The API key is configured as an environment variable in the Cloud Functions runtime.

| Endpoint | Method | Description |
|---|---|---|
| `/api/jobs/enqueue` | `POST` | Enqueues a new job. |
| `/api/jobs/poll` | `GET` | Polls for queued jobs. |
| `/api/jobs/:jobId` | `GET` | Retrieves the details of a specific job. |
| `/api/jobs/:jobId/cancel` | `POST` | Cancels a job. |
| `/api/jobs/:jobId/retry` | `POST` | Retries a failed job. |
| `/api/jobs/:jobId/lock` | `POST` | Locks a job for processing. |
| `/api/jobs/:jobId/heartbeat` | `POST` | Extends the lease on a locked job. |
| `/api/jobs/:jobId/release` | `POST` | Releases the lock on a job. |

## State Machine

The `status` field of a job document tracks its progress through the system. The following diagram illustrates the possible state transitions:

```
QUEUED -> RUNNING -> SUCCEEDED
  |         |         |
  |         v         v
  |       FAILED -> RETRIED (back to QUEUED)
  v         
CANCELED
```

## Worker Integration (asset-factory)

Workers, such as the `asset-factory`, should integrate with `urai-jobs` as follows:

1.  **Poll for jobs**: Periodically call the `/api/jobs/poll` endpoint to retrieve a batch of queued jobs.
2.  **Lock a job**: For each job, call the `/api/jobs/:jobId/lock` endpoint to acquire a lock.
3.  **Process the job**: Once a lock is acquired, the worker can safely process the job.
4.  **Send heartbeats**: While processing, the worker must periodically call the `/api/jobs/:jobId/heartbeat` endpoint to maintain its lock.
5.  **Release the job**: When processing is complete, the worker should call the `/api/jobs/:jobId/release` endpoint and update the job's status to either `SUCCEEDED` or `FAILED`.

## Studio Integration (urai-studio)

The `urai-studio` application should use the `urai-jobs` API to provide visibility into the job queue and the status of individual jobs. The studio can use the `/api/jobs/:jobId` endpoint to retrieve job details and the `/api/jobs/poll` endpoint to display a real-time view of the queue.
