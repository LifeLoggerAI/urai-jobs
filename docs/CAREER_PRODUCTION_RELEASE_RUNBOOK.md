# URAI Jobs Career Production Release Runbook

This runbook is the ordered release path for the URAI-Jobs V1-V5 career surfaces and runtime hooks.

It assumes repo-side implementation is already present for:

- V1 Career Mirror
- V2 Marketplace and packets
- V3 bounded automation controls
- V4 decision layer
- V5 Passport and economic path graph
- Career worker runtime
- Career production smoke and evidence scripts

## 1. Confirm local/repo checks

Run from the repository root:

```bash
pnpm install --no-frozen-lockfile
pnpm activation:verify
pnpm career:verify
pnpm urai-jobs:verify
pnpm --dir web typecheck
pnpm --dir web build
pnpm career-worker:typecheck
pnpm career-worker:build
```

Expected result: all commands pass.

## 2. Confirm CI checks

Use GitHub Actions:

- `Career Surfaces CI`
- `URAI Jobs Runtime CI`

Both workflows support `workflow_dispatch` and can be run manually from the Actions tab.

Record workflow URLs in `docs/PRODUCTION_VALIDATION_<YYYY-MM-DD>.md`.

## 3. Deploy runtime

Deploy Firebase and workers using the approved environment/project:

```bash
pnpm prod:precheck
pnpm deploy:firebase:prod
pnpm deploy:workers
```

If the career worker is deployed separately, use:

```bash
bash scripts/deploy-career-worker.sh
```

Record deployed commit, deployment timestamp, Firebase project, and worker URL.

## 4. Configure required runtime environment

Ensure production Functions/worker configuration includes:

```bash
CAREER_WORKER_URL=<deployed-career-worker-url>
```

Then verify worker health:

```bash
pnpm prod:verify-workers
```

Record the health output in release evidence.

## 5. Run generic production smoke

```bash
pnpm prod:smoke
```

Record the smoke job ID, status transitions, logs, and artifact/result output.

## 6. Run V1-V5 career production smoke

```bash
FIREBASE_PROJECT_ID=<project> GCP_REGION=us-central1 pnpm prod:career-smoke
```

This submits all ten career job types:

| Version | Job type |
| --- | --- |
| V1 | `career.profile.summarize` |
| V1 | `career.fit.score` |
| V2 | `career.document.parse` |
| V2 | `career.document.tailor` |
| V2 | `career.packet.generate` |
| V3 | `career.followup.plan` |
| V4 | `career.interview.prep` |
| V4 | `career.offer.compare` |
| V4 | `career.spatial.portal.generate` |
| V5 | `career.passport.export` |

Expected output:

- one job ID per job type
- `release-evidence/career-prod-smoke-<timestamp>.json`

## 7. Validate and render career release evidence

```bash
pnpm prod:career-release-evidence
```

This runs:

```bash
node scripts/validate-career-smoke-evidence.mjs
node scripts/render-career-smoke-report.mjs
```

Expected output:

- validated JSON evidence
- `release-evidence/career-prod-smoke-<timestamp>.md`

## 8. Verify terminal states and artifacts

For each of the ten career job IDs:

- confirm job reached an expected terminal state
- confirm queue reached an expected terminal state
- confirm result/artifact exists where expected
- confirm worker logs do not show unexpected errors

Canonical job terminal success state:

```text
SUCCESS
```

Canonical queue terminal success state:

```text
DONE
```

## 9. Fill release evidence document

Copy:

```bash
docs/RELEASE_EVIDENCE_TEMPLATE.md
```

To:

```bash
docs/PRODUCTION_VALIDATION_<YYYY-MM-DD>.md
```

Attach or reference:

- CI workflow URLs
- deployment logs
- generic smoke job ID
- career smoke JSON path
- career smoke Markdown report path
- worker health output
- rollback path

## 10. Release decision

Approve only when all are true:

- CI passed
- deployment completed
- worker health passed
- generic production smoke passed
- all ten career smoke jobs created
- career smoke JSON validated
- career smoke Markdown report generated
- terminal statuses and artifacts checked
- rollback path documented

## Rollback

Use the existing rollback path:

```bash
pnpm prod:rollback-worker
```

If Firebase deploy must be reverted, redeploy the last known-good commit and record the rollback commit, timestamp, and operator in the production validation document.

## Current known boundary

This runbook validates repo-side and runtime career workflow readiness. It does not prove external marketplace behavior, third-party integrations, or final user-facing production acceptance unless those are separately tested and recorded.
