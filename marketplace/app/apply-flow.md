# Candidate Apply Flow

Status: placeholder

## Intended flow

1. Candidate opens published job.
2. Candidate authenticates.
3. Candidate profile is loaded or created.
4. Resume upload intent is requested.
5. Resume upload completes.
6. Candidate submits application.
7. Duplicate application prevention runs.
8. Employer receives application.
9. Candidate can track or withdraw application.

## Required checks

- Auth required.
- Published job required.
- Candidate ownership enforced.
- Resume mime type validation enforced.
- Duplicate application rejection enforced.
- Storage privacy enforced.
- Audit logging enforced.

## Required future tests

- Duplicate apply rejection.
- Unauthorized apply rejection.
- Resume upload boundary checks.
- Candidate ownership checks.
- Withdraw flow checks.
- Employer visibility boundary checks.
