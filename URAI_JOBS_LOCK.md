# URAI-JOBS LOCK

**Confirmation: GREEN ✅ / FROZEN ❄️ / TAG `v1.0.0-urai-jobs`**

This document confirms that the `urai-jobs` repository has been finalized and locked. The project is now considered complete and stable.

## Architecture

The `urai-jobs` service is a serverless application built on Firebase. It consists of a suite of Cloud Functions that provide a secure and scalable API for managing jobs. The service uses Firestore as its data store, with a data model that includes jobs, job runs, and audit logs.

## API Contract

The API is documented in the `functions/src/index.ts` file. It includes endpoints for enqueuing, polling, locking, and updating jobs. The API is secured using an API key, which must be provided in the `x-urai-internal-key` header of all requests.

## State Machine

The job state machine is defined in the `functions/src/types/jobs.ts` file. It ensures that jobs transition between states in a predictable and orderly manner.

## Worker Integration

Workers can integrate with the `urai-jobs` service by polling the API for new jobs. Once a job is received, the worker can lock it, execute the work, and then update the job with the results.

## Studio Integration

Studio can integrate with the `urai-jobs` service by using the API to enqueue new jobs and to monitor the status of existing jobs.
