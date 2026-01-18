# Durable Job Queue System

This document describes the durable job queue system implemented in this project.

## How it Works

The system is built on top of Firestore and Cloud Functions. It provides a reliable way to execute background tasks.

### Enqueueing Jobs

Jobs can be enqueued using the `enqueueJob` callable function. This function supports idempotency by providing an `idempotencyKey`.

### Job Execution

A scheduled Cloud Function (`jobWorker`) runs every minute to claim and execute pending jobs. The worker leases jobs to prevent multiple workers from processing the same job.

### Job Lifecycle

Jobs transition through the following statuses:

- `PENDING`: The job is waiting to be executed.
- `RUNNING`: The job is being processed by a worker.
- `SUCCEEDED`: The job completed successfully.
- `FAILED`: The job failed, but will be retried.
- `DEAD`: The job has failed all retry attempts.
- `CANCELED`: The job was canceled by an admin.

### Error Handling and Retries

Failed jobs are automatically retried with exponential backoff. If a job exceeds its maximum number of attempts, it is moved to the `DEAD` state.

### Administration

Admins can cancel, requeue, and list jobs using the provided callable functions (`cancelJob`, `requeueJob`, `listJobs`).
