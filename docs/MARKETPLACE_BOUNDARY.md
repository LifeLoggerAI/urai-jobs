# URAI Jobs Marketplace Boundary

`LifeLoggerAI/urai-jobs` is the URAI Jobs Runtime. It owns internal job execution, queueing, worker orchestration, admin/operator visibility, retries, cancellation, reconciliation, and production runtime evidence.

It is not currently the public hiring marketplace.

## Allowed in this repo

- Authenticated runtime operator UI.
- Job creation for internal runtime work.
- Runtime job status, logs, retries, cancellation, and admin controls.
- Worker and queue health surfaces.
- Runtime deployment, smoke, validation, and release evidence.

## Not production-ready in this repo

Do not expose or route these as production marketplace features without a separate product decision and implementation plan:

- public job search;
- public job detail SEO pages;
- profile persistence;
- resume upload and resume privacy flows;
- applications;
- organization onboarding;
- organization dashboards;
- applicant tracking;
- paid posting or billing;
- marketplace notifications;
- data export/delete workflows for hiring data.

Runtime navigation should not link public marketplace, pricing, or application surfaces unless a future marketplace module is explicitly chartered and release-gated.

## Future marketplace requirements

A future marketplace module must include:

- API contracts;
- Firestore and Storage rules;
- emulator-backed access tests;
- legal/privacy review;
- production smoke checks;
- rollback path;
- release evidence;
- explicit documentation that distinguishes marketplace data from runtime job data.

Until then, runtime activation should not be blocked on marketplace scope, and marketplace scope should not be silently mixed into runtime activation.
