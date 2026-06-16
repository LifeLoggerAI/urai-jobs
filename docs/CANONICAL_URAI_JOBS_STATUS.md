# Canonical URAI‑Jobs Status

This document captures the current state of the `urai‑jobs` repository at the start of the autonomous completion process.  It distinguishes between implemented features, partial scaffolding, and missing functionality across the backend runtime, worker packages, front‑end surfaces, system integrations, security posture, and CI/CD automation.

## Overview

URAI‑Jobs is a Firebase/Firestore‑backed job execution runtime designed to orchestrate asynchronous work across the URAI ecosystem.  The repository includes a functions package for queue management and job execution, a shared types package for data contracts, a React front‑end for internal admin and career surfaces, and worker packages for offloading work to Cloud Run.

## Backend runtime (functions)

| Component | Status | Evidence |
| --- | --- | --- |
| **Job creation (`createJob`)** | Implemented and validated via Zod; writes job & queue docs in a transaction. | `functions/src/jobs/createJob.ts`【turn11file0†L18-L79】 |
| **Job retrieval (`getJob`/`getJobStatus`)** | Implemented; enforces owner or operator access. | `functions/src/jobs/getJob.ts`, `functions/src/jobs/getJobStatus.ts` |
| **Job cancellation & retry** | Exposed via callable functions and admin v2 handlers; uses transactions and logs. | `functions/src/jobs/cancelJob.ts`, `functions/src/jobs/admin-v2.ts` |
| **Queue processing (`processQueueTick`, `processQueueNow`)** | Present but not audited in detail; likely leases and schedules jobs. | `functions/src/jobs/processQueueTick.ts` |
| **Job execution (`executeJob`)** | Implements Pub/Sub triggered execution, dispatches to worker URLs via axios, falls back to inline handlers if env vars missing.  Echoes payload and writes artifacts to a public bucket【turn48file0†L68-L139】. | `functions/src/jobs/executeJob.ts` |
| **System maintenance (`retryExpiredLeases`, `cleanupTerminalJobs`, `systemReconcile`)** | Present; not audited. | `functions/src/jobs/retryExpiredLeases.ts`, etc. |
| **Admin listings (`listJobs`, `listJobsV2`, `listJobLogs`)** | Implemented; restricts access to operators and uses Firestore queries. | `functions/src/jobs/admin.ts`, `functions/src/jobs/admin-v2.ts` |
| **Job registry** | Static mapping of job types to worker classes and queue names; includes spatial, studio, narrator, asset, career, and system jobs. | `functions/src/core/jobRegistry.ts` |
| **RBAC enforcement** | Wrapper `withAuthenticatedRole` checks user roles stored in Firestore; roles/permissions collections not yet implemented. | `functions/src/core/auth.ts` |
| **Firestore paths & type definitions** | Provided via helper functions and shared types package. | `functions/src/core/firestore-paths.ts`, `packages/shared-types/src/index.ts` |

## Worker packages

| Worker | Status | Evidence |
| --- | --- | --- |
| **career-worker** | Stubbed handlers for all `career.*` job types; returns `payloadEcho` and placeholder outputs【turn49file0†L45-L56】. | `workers/career-worker/src/handlers/index.ts` |
| **studio, narrator, spatial, asset workers** | Scaffolding directories present but handlers missing or stubbed; fallback inline handler in functions performs work. | `workers/studio-worker`, etc. |
| **Dockerfiles & deployment scripts** | Each worker has a Dockerfile and deploy script but not verified. | `workers/career-worker/Dockerfile`, `scripts/deploy-workers.sh` |

## Front‑end (web)

| Area | Status | Evidence |
| --- | --- | --- |
| **Routing & navigation** | `App.tsx` defines routes for `/career-mirror`, `/career-marketplace`, `/career-automation`, `/career-decision`, `/career-passport`, `/career-versions`, etc. | `web/src/App.tsx` |
| **Career Mirror (V1)** | Page scaffold exists; includes local profile state, calls runtime hooks `career.profile.summarize` and `career.fit.score`. Uses localStorage and sample data. No real backend persistence. | `web/src/pages/CareerMirrorPage.tsx` |
| **Marketplace (V2)** | Page and model scaffolds present; uses stubbed runtime hooks. | `web/src/pages/CareerMarketplacePage.tsx` |
| **Automation (V3)**, **Decision (V4)**, **Passport (V5)** | Placeholder pages with minimal UI; runtime hooks referenced but not implemented. | `web/src/pages/CareerAutomationPage.tsx`, etc. |
| **Admin UI** | Create job page and some operator presets exist; job list pages are missing. | `web/src/pages/CreateJobPage.tsx` |

## System-of-systems integration

No real integration is implemented.  Worker URLs are configured via environment variables; if missing, the runtime falls back to inline handlers that write artifacts to a public bucket【turn48file0†L68-L139】.  There is no code connecting to URAI identity, spatial, studio, asset, analytics, admin, or B2B services beyond placeholders in the job registry.

## Security & privacy posture

- **Payload echo**: Inline fallback workers and the career worker return the entire job payload in the response【turn49file0†L45-L56】.  This is a direct data‑leak risk.
- **Public artifact buckets**: Inline fallback writes outputs to `gs://urai-jobs-inline-artifacts/*` and exposes those paths in job results【turn48file0†L68-L139】.
- **Worker authentication**: Workers accept arbitrary HTTP calls; there is no shared secret or token validation.
- **RBAC**: Role enforcement depends on Firestore user documents; there are no `roles` or `permissions` collections or Firestore rules to enforce role separation.

## CI/CD & scripts

- The repository defines dozens of scripts for verification, smoke tests, and deployment (e.g., `career:verify`, `urai-jobs:verify`, `deploy:firebase:prod`) in the root `package.json`.
- GitHub workflows for runtime CI and career surfaces CI exist, along with a complex `career-production-release.yml`, but they depend on secrets and environment variables not available in this context.
- There are no passing CI runs or deployment evidence in the repository.  Many of the docs referenced in `scripts/career-launch-gate.mjs` (e.g., `CAREER_PRODUCTION_RELEASE_RUNBOOK.md`) are present but incomplete; others will need to be created or updated.

---

This status document will be updated as the agent progresses through implementation and verification.
