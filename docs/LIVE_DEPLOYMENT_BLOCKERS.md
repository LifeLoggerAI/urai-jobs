# URAI Jobs Live Deployment Blockers and Final Release Actions

Status: repository implementation and release automation prepared
Default branch: `main`
Repository permissions observed: admin/maintain/push available through GitHub connector

This document records what remains before anyone can truthfully mark URAI-Jobs V1-V5 as live in production.

## What is complete in the repo

- V1 Career Mirror page, model, local persistence, profile/fit runtime hooks.
- V2 Marketplace page, candidate/employer/opportunity/document/packet models, document/packet runtime hooks.
- V3 Automation page, bounded rules, pause controls, review ledger, follow-up runtime hook.
- V4 Decision page, interview prep, offer comparison, spatial portal runtime hooks.
- V5 Passport page, profile packets, economic path graph, skill gaps, Passport export runtime hook.
- Top navigation links V1-V5.
- Landing page links V1-V5.
- Version Console links V1-V5.
- Career worker package exists under `workers/career-worker`.
- Career worker build/typecheck is included in root scripts.
- Career surface verifier exists.
- Career runtime smoke verifier exists.
- Production career smoke script exists.
- Production career smoke evidence validator exists.
- Career smoke Markdown report generator exists.
- Bundled career release evidence command exists.
- Manual Career Production Release GitHub Actions workflow exists.
- Release evidence template requires V1-V5 smoke evidence.
- Career production release runbook exists.
- Firebase Hosting already rewrites all direct SPA routes to `/index.html`.

## What is not yet proven live

These items require external runtime execution, secrets, or cloud environment access beyond repository file writes.

| Blocker | Why it matters | Required action |
| --- | --- | --- |
| GitHub Actions has no status attached to latest commits | No CI pass/fail evidence is visible yet | Manually dispatch `Career Production Release`, `Career Surfaces CI`, or `URAI Jobs Runtime CI` |
| `GCP_SERVICE_ACCOUNT_JSON` secret not verified | Production workflow needs Google auth | Add/verify GitHub environment or repository secret `GCP_SERVICE_ACCOUNT_JSON` |
| Production environment approval not verified | Workflow uses `environment: production` | Ensure GitHub `production` environment exists and approvals are configured as desired |
| Firebase/GCP project not executed | Deployment/smoke needs real project | Dispatch workflow with correct `firebase_project_id` and `gcp_region` |
| `CAREER_WORKER_URL` not proven configured in production | Career runtime jobs need deployed worker route | Configure production Functions/worker env with deployed career worker URL |
| Career worker health not proven | Need deployed worker health response | Run `pnpm prod:verify-workers` or inspect workflow output |
| Production smoke job IDs not generated yet | Need evidence that all ten career job types work live | Run `pnpm prod:career-smoke` or the production workflow |
| Career smoke JSON/report not generated yet | Required release artifact | Run `pnpm prod:career-release-evidence` after smoke |
| Terminal states/artifacts not verified | Created job IDs alone are not terminal success | Confirm `SUCCESS` jobs, `DONE` queue states, and output artifacts |
| Public domain/live URL not verified | User-facing live status depends on hosting/domain | Confirm Firebase Hosting URL/custom domain after deploy |

## Final release sequence

Use the manual GitHub workflow if secrets and environment are configured:

1. Open GitHub Actions.
2. Run `Career Production Release`.
3. Inputs:
   - `firebase_project_id`: production Firebase project ID
   - `gcp_region`: `us-central1` unless changed
   - `confirm_release`: `CAREER-RELEASE`
4. Download the `career-production-release-evidence` artifact.
5. Copy `docs/RELEASE_EVIDENCE_TEMPLATE.md` to `docs/PRODUCTION_VALIDATION_<YYYY-MM-DD>.md`.
6. Fill the release evidence with workflow URLs, smoke job IDs, worker health, terminal statuses, artifacts, and rollback path.

## Equivalent command sequence

```bash
pnpm install --no-frozen-lockfile
pnpm activation:verify
pnpm career:verify
pnpm urai-jobs:verify
pnpm --dir web typecheck
pnpm --dir web build
pnpm career-worker:typecheck
pnpm career-worker:build
pnpm prod:precheck
pnpm deploy:firebase:prod
pnpm deploy:workers
pnpm prod:verify-workers
pnpm prod:smoke
FIREBASE_PROJECT_ID=<project> GCP_REGION=us-central1 pnpm prod:career-smoke
pnpm prod:career-release-evidence
```

## Definition of live complete

URAI-Jobs V1-V5 can be marked live only when all are true:

- GitHub CI/workflow run passed and URL is recorded.
- Firebase Hosting deploy completed and URL is reachable.
- Direct routes work:
  - `/career-mirror`
  - `/career-marketplace`
  - `/career-automation`
  - `/career-decision`
  - `/career-passport`
  - `/career-versions`
- Career worker is deployed and healthy.
- `CAREER_WORKER_URL` is configured in production.
- Generic production smoke passes.
- V1-V5 career production smoke creates all ten job IDs.
- Career smoke evidence JSON validates.
- Career smoke Markdown report renders.
- Each career job reaches expected terminal status and artifacts are verified.
- Rollback path is documented.

## Current verdict

The repository is prepared for live release execution. The remaining work is operational execution and proof collection in GitHub Actions/Firebase/GCP, not additional product scaffolding.
