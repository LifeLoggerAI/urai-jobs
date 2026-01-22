# URAI-JOBS Roadmap

This document outlines the planned features and versions for the URAI-JOBS project.

## V1: Core Hiring & Applicant Tracking

- **Frontend SPA:** Vite + React + TypeScript application.
- **Job Board:** Publicly accessible list of open jobs.
- **Job Detail Page:** Detailed view of a single job.
- **Application Form:** Form for candidates to apply for a job.
- **Application Success Page:** Confirmation page after submitting an application.
- **Waitlist:** A simple form to collect interest from potential candidates.
- **Referral System:** Basic referral code handling.
- **Admin Console:** Protected area for managing jobs and applications.
- **Firestore Data Model:** Implementation of the core data structures for jobs, applicants, applications, etc.
- **Security Rules:** Strict security rules for Firestore and Storage.
- **Cloud Functions:**
    - `onJobWrite`: Trigger to update the public job board.
    - `onApplicationCreate`: Trigger to process new applications.
    - `createResumeUpload`: Callable function to handle resume uploads.
    - `adminSetApplicationStatus`: Callable function for admin actions.
- **Build & Deploy:** A complete build and deployment pipeline for both the frontend and backend.
- **Seed & Demo Data:** Scripts to populate the database with sample data.

## V2: Advanced Features & Production Hardening

- **Job Chains & Sub-jobs:** Support for more complex job workflows.
- **Rate Limiting & Concurrency Pools:** Control the flow of jobs to prevent system overload.
- **Priority Queues:** Allow certain jobs to be processed before others.
- **Cancellation & Timeouts:** Mechanisms to cancel or timeout long-running jobs.
- **Idempotency:** Ensure that jobs can be safely retried without causing unintended side effects.
- **Heartbeat & Reaper:** A system to detect and recover stuck or failed jobs.
- **Metrics & Auditing:** Detailed logging and metrics for observability and auditing.
- **Multi-tenancy & Permissions:** Support for multiple organizations and user roles.
- **Schema Validation:** Strict validation of all data entering the system.
- **Secrets Management:** Securely manage secrets and credentials.

## V3: Polish & Final Touches

- **Observability:** Comprehensive logging, monitoring, and tracing.
- **Resilience:** Robust error handling, retries, and circuit breakers.
- **Security:** In-depth security review and hardening.
- **Developer Experience:** A smooth and efficient local development and deployment workflow.
