# URAI Jobs Activation Governance

Status: launch-gated
Last updated: 2026-05-11

## Purpose

This document turns the URAI Jobs activation audit into a repeatable implementation and release-control process for this repository.

Important boundary: this repository is currently the **URAI Jobs Runtime**, an internal production job-execution fabric. The repository README states that this repo is not the public jobs marketplace or careers application surface, and that public candidate/employer marketplace flows should live in a separate public app or a clearly separated future module unless a future product decision explicitly expands this repository.

Therefore, activation work in this repository must preserve the runtime boundary unless a formal product decision is added.

## Product decision gate

Before implementing public marketplace flows here, create and approve a product decision record covering:

- Whether `LifeLoggerAI/urai-jobs` remains internal runtime only.
- Whether the public marketplace belongs in a separate repo/app.
- Whether a clearly separated marketplace module will be added to this repo.
- Security review for any public unauthenticated surface.
- Privacy/legal review for candidate data, resumes, employer data, analytics, export, and deletion.
- Deployment ownership for apex and `www` domains.

Until that decision exists, this repo should only be activated as the internal runtime.

## Activation scope for the current repository

The current repository activation scope is:

1. Runtime queue creation and status retrieval.
2. Worker dispatch and execution.
3. Lease, retry, cancellation, cleanup, and reconciliation behavior.
4. Admin/operator job visibility.
5. Runtime security, rules, auth, storage, secrets, and deployment controls.
6. Production smoke checks for runtime endpoints and operator flows.
7. Release evidence, rollback, versioning, and upgrade repeatability.

Out of scope until the product decision gate is approved:

- Public jobs list.
- Public job detail pages.
- Candidate profiles.
- Resume upload for public candidates.
- Job applications.
- Employer dashboards.
- Applicant tracking.
- Public marketplace SEO pages.
- Pricing and billing for employers.

## Required release evidence

A release is not production-ready until all evidence below is attached or linked from the signoff ledger.

### Repository verification

- `pnpm urai-jobs:verify`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm urai-jobs:smoke`
- Callable emulator E2E using `pnpm urai-jobs:e2e`

### Security and data boundary verification

- Firestore rules deny-by-default behavior verified.
- Runtime job ownership and admin/operator access verified.
- Cancel/retry/list job boundaries verified.
- Storage artifact access reviewed.
- No committed secrets found by scan.
- Production CORS/origin configuration reviewed.
- App Check posture documented as enforced, monitored, or deferred with rationale.

### Deployment verification

- Firebase project selected explicitly.
- Required secrets and runtime environment variables verified.
- Worker URLs configured.
- Cloud Run workers deployed or intentionally stubbed for the release.
- Firebase Functions deployed.
- Firestore rules and indexes deployed.
- Hosting deployed.
- Production smoke checks completed.
- Rollback command tested or documented with exact target.

## Repeatable release process

1. Open a version branch.
2. Update `CHANGELOG.md` or release notes with the intended scope.
3. Run local verification commands.
4. Deploy to preview/staging.
5. Run runtime smoke and callable E2E.
6. Complete signoff ledger entries.
7. Deploy production only after signoff completion.
8. Run production smoke.
9. Tag the release.
10. Record the deployed commit, environment, smoke evidence, known gaps, and rollback command.

## Version tracks

- `v0.x-preview`: internal preview; no production claims.
- `v0.x-runtime-mvp`: runtime queue/operator MVP verified in staging.
- `v1.0-runtime-prod`: runtime production release with signoffs and smoke evidence.
- `v1.x-runtime-upgrade`: runtime upgrades that preserve existing contracts.
- `v2.0-platform`: major architecture or product expansion requiring a decision record.

## Marketplace expansion path

If URAI chooses to add public marketplace features to this repository, add a product decision record and then implement the public system as a clearly separated module with its own:

- Firebase codebase.
- Hosting target or app shell.
- Firestore collections and indexes.
- Storage rules for resumes.
- Auth and App Check policy.
- Legal/privacy pages.
- Candidate, employer, and admin QA matrix.
- Production domain smoke checklist.
- Separate release lock and signoff ledger.

Do not bolt candidate/employer marketplace behavior into the runtime functions or operator UI without this separation.
