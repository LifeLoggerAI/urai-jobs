# Marketplace API Contract

Status: draft

## Auth model

| Role | Auth requirement |
|---|---|
| Public | No auth required for published job reads |
| Candidate | Firebase Auth required |
| Employer | Firebase Auth + employer membership required |
| Admin | Firebase Auth + admin claim required |

## Jobs

### GET /api/marketplace/jobs

Returns paginated published jobs.

### GET /api/marketplace/jobs/:jobId

Returns a published job detail.

### POST /api/marketplace/jobs

Allowed roles:
- employer
- admin

Creates a pending-review job.

## Candidate profiles

### GET /api/marketplace/profiles/me

Returns the authenticated candidate profile.

### POST /api/marketplace/profiles

Creates or updates the authenticated candidate profile.

## Resume uploads

### POST /api/marketplace/resume-intent

Returns a signed upload intent for approved resume mime types.

Allowed mime types:
- application/pdf
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document

## Applications

### POST /api/marketplace/applications

Creates a job application.

Requirements:
- authenticated candidate
- published job
- duplicate application prevention

### GET /api/marketplace/applications/me

Returns only applications owned by the authenticated candidate.

### PATCH /api/marketplace/applications/:applicationId/withdraw

Allows the authenticated candidate to withdraw a pending application.

## Employers

### POST /api/marketplace/employers

Creates an employer organization or lead.

### GET /api/marketplace/employers/:employerId/applications

Returns applications only for jobs owned by the employer.

### PATCH /api/marketplace/employers/:employerId/applications/:applicationId

Allows employer application status updates.

## Admin

### GET /api/marketplace/admin/review-queue

Returns pending jobs and employer reviews.

### PATCH /api/marketplace/admin/jobs/:jobId

Allows moderation actions:
- approve
- reject
- pause
- close
- feature
- unfeature

### PATCH /api/marketplace/admin/employers/:employerId

Allows employer moderation actions.

## Privacy operations

### POST /api/marketplace/export-request

Creates a user export request.

### POST /api/marketplace/delete-request

Creates a user deletion request.

## Error contract

All API responses should return:

- `ok`
- `error`
- `code`
- `message`
- `requestId`

## Release rule

Do not mark the marketplace production-ready until every route above has:

- implementation
- auth checks
- rules tests
- integration tests
- smoke checks
- QA evidence
