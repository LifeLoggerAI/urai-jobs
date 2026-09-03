# URAI Jobs Marketplace Readiness Package

Status: draft
Date: 2026-05-11

This package defines the implementation and verification contract for the public URAI Jobs marketplace module.

The existing repository remains the URAI Jobs Runtime until marketplace implementation is explicitly separated and approved. This folder is the handoff point for that separated module.

## Target public routes

- `/`
- `/jobs`
- `/jobs/:slug`
- `/apply/:jobId`
- `/employers`
- `/pricing`
- `/about`
- `/terms`
- `/privacy`

## Target API surface

- `GET /api/marketplace/health`
- `GET /api/marketplace/jobs`
- `GET /api/marketplace/jobs/:jobId`
- `POST /api/marketplace/profiles`
- `GET /api/marketplace/profiles/me`
- `POST /api/marketplace/resume-intent`
- `POST /api/marketplace/applications`
- `GET /api/marketplace/applications/me`
- `PATCH /api/marketplace/applications/:applicationId/withdraw`
- `POST /api/marketplace/employers`
- `POST /api/marketplace/employers/:employerId/jobs`
- `GET /api/marketplace/employers/:employerId/applications`
- `PATCH /api/marketplace/employers/:employerId/applications/:applicationId`
- `GET /api/marketplace/admin/review-queue`
- `PATCH /api/marketplace/admin/jobs/:jobId`
- `PATCH /api/marketplace/admin/employers/:employerId`
- `POST /api/marketplace/export-request`
- `POST /api/marketplace/delete-request`

## Target collections

- `marketplacePublicJobs`
- `marketplaceCandidateProfiles`
- `marketplaceJobApplications`
- `marketplaceEmployers`
- `marketplaceEmployerMembers`
- `marketplaceAdminReviews`
- `marketplaceAuditLogs`
- `marketplaceLeads`
- `marketplaceExportRequests`
- `marketplaceDeleteRequests`

## Storage paths

- `marketplace/resumes/{uid}/{resumeId}`
- `marketplace/company-assets/{employerId}/{assetId}`

## Implementation rule

Do not implement public marketplace behavior in the runtime callable functions or runtime operator UI. Keep the module separate, with its own app shell, API namespace, rules, storage paths, smoke tests, docs, and release evidence.

## Launch rule

Production launch remains blocked until the signoff ledger, QA matrix, deployment checklist, and smoke evidence are complete.
