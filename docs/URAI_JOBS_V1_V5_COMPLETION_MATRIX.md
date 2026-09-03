# URAI Jobs V1-V5 Completion Matrix

Status: repo-side implementation scaffold complete
Scope: public career product surfaces plus approved URAI Jobs runtime hooks

This matrix records what exists in the repository for each autonomous URAI-Jobs version. It separates repo-side completion from production evidence. Production evidence still requires CI runs, deployment outputs, worker health checks, smoke job IDs, domain checks, and release artifacts.

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
| Top navigation | `web/src/App.tsx` links V1-V5 |
| Landing page | `web/src/pages/LandingPage.tsx` links V1-V5 |
| Version Console | `web/src/pages/CareerVersionConsolePage.tsx` renders `stage.href` links |
| Version model | `web/src/lib/careerLaunchPlan.ts` includes `href` for V1-V5 |

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

The repository now contains the V1-V5 URAI-Jobs product and runtime scaffolding required to continue into CI verification and production deployment evidence. The remaining work is operational verification, not product-surface scaffolding.
