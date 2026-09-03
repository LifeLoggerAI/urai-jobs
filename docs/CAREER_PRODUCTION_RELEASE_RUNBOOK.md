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
- Career release manifest and live route checklist artifacts

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
- `Career Production Release`

All release workflows support `workflow_dispatch` and can be run manually from the Actions tab.

Record workflow URLs in `docs/PRODUCTION_VALIDATION_<YYYY-MM-DD>.md`.

## 3. Run the one-button production workflow

Preferred path:

```text
GitHub Actions -> Career Production Release
```

Inputs:

```text
firebase_project_id=<production Firebase project>
gcp_region=us-central1
career_worker_url=<deployed career worker URL>
live_base_url=<Firebase Hosting or custom base URL>
deploy_before_smoke=true
confirm_release=CAREER-RELEASE
```

The workflow verifies, builds, deploys, smokes, validates evidence, stamps release manifests, stamps route checklist artifacts, and uploads release evidence.

## 4. Manual deploy path if workflow dispatch is unavailable

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

Record deployed commit, deployment timestamp, Firebase project, Hosting URL, and worker URL.

## 5. Configure required runtime environment

Ensure production Functions/worker configuration includes:

```bash
CAREER_WORKER_URL=<deployed-career-worker-url>
```

Then verify worker health:

```bash
pnpm prod:verify-workers
```

Record the health output in release evidence.

## 6. Run generic production smoke

```bash
pnpm prod:smoke
```

Record the smoke job ID, status transitions, logs, and artifact/result output.

## 7. Run V1-V5 career production smoke

```bash
FIREBASE_PROJECT_ID=<project> GCP_REGION=us-central1 CAREER_WORKER_URL=<worker-url> pnpm prod:career-smoke
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

## 8. Validate and render career release evidence

```bash
pnpm prod:career-release-evidence
```

This validates the JSON evidence and renders:

```text
release-evidence/career-prod-smoke-<timestamp>.md
```

## 9. Stamp release manifest and live route checklist

```bash
FIREBASE_PROJECT_ID=<project> GCP_REGION=us-central1 CAREER_WORKER_URL=<worker-url> FIREBASE_HOSTING_URL=<hosting-url> node scripts/stamp-career-release-manifest.mjs
FIREBASE_HOSTING_URL=<hosting-url> node scripts/stamp-career-route-checklist.mjs
```

Expected output:

```text
release-evidence/career-release-manifest.json
release-evidence/career-release-manifest.md
release-evidence/career-live-route-checklist.json
release-evidence/career-live-route-checklist.md
```

## 10. Verify live routes

Open every URL from `career-live-route-checklist.md`:

| Version | Route |
| --- | --- |
| HOME | `/` |
| V1 | `/career-mirror` |
| V2 | `/career-marketplace` |
| V3 | `/career-automation` |
| V4 | `/career-decision` |
| V5 | `/career-passport` |
| Console | `/career-versions` |

Confirm each route loads the URAI Jobs app shell and the correct surface.

## 11. Verify terminal states and artifacts

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

## 12. Fill release evidence document

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
- career release manifest path
- career live route checklist path
- worker health output
- route verification notes
- rollback path

## 13. Release decision

Approve only when all are true:

- CI passed
- deployment completed
- worker health passed
- generic production smoke passed
- all ten career smoke jobs created
- career smoke JSON validated
- career smoke Markdown report generated
- career release manifest generated
- live route checklist generated and manually verified
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
