# URAI Jobs V1-V5 Completion Matrix

Status: **HISTORICAL / RETAINED IMPLEMENTATION / NOT CANONICAL PUBLIC RUNTIME**
Scope: retained V1-V5 career implementation plus approved URAI Jobs runtime hooks

This matrix records historical implementation that remains in the repository. It is not a current production-activation claim. The canonical `LifeLoggerAI/urai-jobs` product boundary is the internal execution runtime. On the current convergence line, the canonical navigation no longer exposes V1-V5 career pages; legacy career paths are retained only as superseded compatibility routes unless a separately governed public career product/module is explicitly re-authorized.

Any future activation of these V1-V5 capabilities must re-earn product decision, security, privacy, accessibility, human-control, deployment and exact-head evidence. Employment-related external actions remain fail-closed and user-controlled.

## Shared runtime foundation

| Area | Repo evidence |
| --- | --- |
| Career job contracts | `functions/src/core/types.ts` |
| Runtime registry | `functions/src/core/jobRegistry.ts` |
| Dispatcher routing | `functions/src/jobs/executeJob.ts` routes `career.*` to `CAREER_WORKER_URL` |
| Career worker package | `workers/career-worker` |
| Worker server | `workers/career-worker/src/index.ts` |
| Worker handlers | `workers/career-worker/src/handlers/index.ts` |
| Worker deployment path | `workers/career-worker/Dockerfile`, `scripts/deploy-career-worker.sh` |
| Operator presets | `web/src/pages/CreateJobPage.tsx` |
| Readiness checks | `scripts/activation-readiness-verify.mjs`, `scripts/career-surfaces-verify.mjs` |
| CI entry points | `.github/workflows/urai-jobs-runtime-ci.yml`, `.github/workflows/career-surfaces-ci.yml` |

## V1 - Career Mirror

| Requirement | Repo evidence |
| --- | --- |
| Route | `/career-mirror` in `web/src/App.tsx` |
| Page | `web/src/pages/CareerMirrorPage.tsx` |
| Model | `web/src/lib/careerMirror.ts` |
| Persistence | `web/src/lib/careerMirrorStore.ts` |
| Runtime hooks | `career.profile.summarize`, `career.fit.score` |
| UI coverage | editable profile controls, persisted save/hide, reset state, explain-match panel |
| Verification | activation and career surface verifiers |

## V2 - Marketplace and packets

| Requirement | Repo evidence |
| --- | --- |
| Route | `/career-marketplace` in `web/src/App.tsx` |
| Page | `web/src/pages/CareerMarketplacePage.tsx` |
| Model | `web/src/lib/careerMarketplace.ts` |
| Runtime hooks | `career.document.parse`, `career.document.tailor`, `career.packet.generate` |
| UI coverage | candidate profile, employer profile, opportunity detail, document list, packet controls |
| Verification | activation verifier checks V2 model/page/runtime hooks |

## V3 - Bounded automation

| Requirement | Repo evidence |
| --- | --- |
| Route | `/career-automation` in `web/src/App.tsx` |
| Page | `web/src/pages/CareerAutomationPage.tsx` |
| Model | `web/src/lib/careerAutomation.ts` |
| Runtime hook | `career.followup.plan` |
| UI coverage | global pause, per-rule pause, explicit rule cards, review ledger |
| Verification | activation verifier checks V3 model/page/runtime hook |

## V4 - Decision layer

| Requirement | Repo evidence |
| --- | --- |
| Route | `/career-decision` in `web/src/App.tsx` |
| Page | `web/src/pages/CareerDecisionPage.tsx` |
| Model | `web/src/lib/careerDecision.ts` |
| Runtime hooks | `career.interview.prep`, `career.offer.compare`, `career.spatial.portal.generate` |
| UI coverage | interview prep room, offer comparison, burnout-risk framing, spatial portal generation |
| Verification | `scripts/career-surfaces-verify.mjs` checks V4 model/page/runtime hooks |

## V5 - Passport and economic path graph

| Requirement | Repo evidence |
| --- | --- |
| Route | `/career-passport` in `web/src/App.tsx` |
| Page | `web/src/pages/CareerPassportPage.tsx` |
| Model | `web/src/lib/careerPassport.ts` |
| Runtime hook | `career.passport.export` |
| UI coverage | profile packets, active economic mode, economic path graph, skill gaps, export job |
| Verification | activation and career surface verifiers check V5 model/page/runtime hook |

## Navigation evidence

| Surface | Repo evidence |
| --- | --- |
| Canonical top navigation | `web/src/App.tsx` exposes Runtime/Login and permission-gated Create/Operator surfaces; V1-V5 links are not canonical navigation |
| Canonical landing page | `web/src/pages/LandingPage.tsx` identifies Jobs as the internal execution fabric and does not advertise V1-V5 |
| Legacy career routes | `web/src/App.tsx` preserves the historical paths but resolves them to an explicit superseded-product state |
| Historical Version Console/model | retained in source for provenance and future separated-product work; not canonical public navigation |

## Commands to verify repo-side completion

```bash
pnpm install --no-frozen-lockfile
pnpm career:verify
pnpm activation:verify
pnpm urai-jobs:verify
pnpm --dir web typecheck
pnpm --dir web build
pnpm career-worker:typecheck
pnpm career-worker:build
```

## Production evidence still required

These cannot be completed by repository contents alone:

- CI run URL and passing status.
- Deployed Firebase Hosting URL.
- Deployed Firebase Functions version.
- Deployed Cloud Run `career-worker` URL.
- Production `CAREER_WORKER_URL` configured.
- Worker health response.
- Smoke job IDs for each career runtime job.
- Domain verification for public domains.
- Release evidence template filled with commit SHA, job IDs, logs, outputs, and rollback path.

## Current verdict

The repository contains substantial V1-V5 career implementation, but those surfaces are **not the canonical URAI Jobs public runtime and are not live-certified**. Current launch authority is the internal execution fabric. The retained career code is future/separated-product foundation only until explicitly re-authorized and independently proven under its own employment/privacy/security/accessibility governance.
