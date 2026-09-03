# URAI-JOBS Core System Status

This document outlines the successful transformation of the `urai-jobs` repository into the core execution platform.

## 1. Build Summary

The previous job-board application has been replaced by a canonical, production-ready job execution system built on Firebase and Google Cloud. The new system provides a complete lifecycle for creating, queuing, executing, and managing asynchronous jobs.

## 2. Required Firestore Collections

The following collections are now essential for core system operation:

*   `jobs`: The canonical store for all execution jobs.
*   `jobQueue`: A separate, ephemeral collection for managing queue state.
*   `jobResults`: An immutable collection for storing terminal job outcomes.
*   `logs`: A structured collection for system and job-level logging.
*   `users`: For user identity and tenancy.
*   `roles`: Defines RBAC roles (admin, system, client, worker).
*   `permissions`: Defines fine-grained system permissions.
*   `systemState`: Singleton documents for managing global system configuration.

## 3. Exported Cloud Functions

The `functions/src/index.ts` file now exports the following core functions:

**Job Lifecycle & Management:**

*   `createJob`: (HTTPS) Creates and queues a new job.
*   `getJobStatus`: (HTTPS) Retrieves the status of a job.
*   `cancelJob`: (HTTPS) Requests cancellation of a job.

**Queue & System Processing (Scheduled):**

*   `processQueueTick`: Processes the job queue.
*   `retryExpiredLeases`: Recovers jobs with expired leases.
*   `cleanupTerminalJobs`: Archives old job-related documents.
*   `systemReconcile`: Detects and repairs system state inconsistencies.

**Event-Driven Triggers:**

*   `onJobTerminalEvent`: (Firestore) Emits an event when a job reaches a terminal state.

## 4. Cloud Run Worker Classes

The system is configured to route heavy workloads to the following Cloud Run worker classes. Stubs have been created for each:

*   `spatial-worker`
*   `studio-worker`
*   `narrator-worker`
*   `asset-worker`

## 5. Isolated & Archived Code

The following legacy items from the job-board application have been isolated to prevent conflicts:

*   **Path:** `/archive/job-board/`
*   **Contents:** `verifyJob.ts`, `scheduledRetry.ts`, and other job-board specific UI/backend code.
*   **Action:** The job-board web UI in `/public` has been moved to `/archive/job-board/public`.

## 6. Deployment Order

To deploy the URAI-JOBS core system, follow this order:

1.  **Deploy Firestore Rules & Indexes:**
    ```bash
    firebase deploy --only firestore:rules
    firebase deploy --only firestore:indexes
    ```

2.  **Deploy Storage Rules:**
    ```bash
    firebase deploy --only storage
    ```

3.  **Deploy Cloud Functions:**
    ```bash
    firebase deploy --only functions
    ```

4.  **Seed Initial System State (One-Time):**
    Execute the bootstrap script to create initial roles, permissions, and system configuration. This should be done via a secure administrative channel.
    ```bash
    cd functions
    npm run seed
    ```

5.  **Deploy Cloud Run Workers:**
    For each worker in the `/workers` directory, build and deploy the container image to Cloud Run, ensuring it is invokable and has the correct service account permissions to interact with Firestore.
