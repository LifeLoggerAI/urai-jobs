# URAI Jobs Runtime System-of-Systems Completion Audit

Date: 2026-05-20
Repository: `LifeLoggerAI/urai-jobs`
Product boundary: internal URAI Jobs Runtime, not the public candidate/employer marketplace.

## Executive summary

URAI Jobs Runtime is now locally verified as a coherent internal execution system. The repo passes invariant verification, smoke verification, build, typecheck, runtime deploy precheck, and managed-worker artifact precheck when dependencies are installed.

Production is intentionally blocked until the production environment, real Cloud Run worker URLs, artifact bucket, webhook secret, custom domains, deployed hosting, live smoke, worker health, and release evidence are complete.

## Current state from latest terminal evidence

Passed locally:

- `pnpm install --no-frozen-lockfile`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm worker:precheck`

Failed production gates:

- `pnpm prod:precheck`: missing required production env vars.
- `pnpm domains:verify`: `https://urai-jobs.web.app` serves the expected app asset, but `https://uraijobs.com` and `https://www.uraijobs.com` return HTTP 200 without the expected app shell or Vite asset.

## System map

### Runtime control plane

- Firebase Functions validate and enqueue work.
- Firestore stores job state, queue state, logs, leases, retries, terminal status, and reconciliation state.
- Firebase Auth controls operator access.
- Firebase Hosting serves the internal operator UI.

### Worker execution plane

- Cloud Run worker URLs are configured through production env.
- Required worker URLs:
  - `NARRATOR_WORKER_URL`
  - `ASSET_WORKER_URL`
  - `SPATIAL_WORKER_URL`
  - `STUDIO_WORKER_URL`

### Shared contract plane

- `packages/shared-types` owns canonical runtime types.
- Compatibility statuses are retained for legacy/admin surfaces.
- The repo blocks stale marketplace positioning and public candidate/employer routes.

### Verification plane

- `scripts/urai-jobs-verify.mjs`
- `scripts/activation-readiness-verify.mjs`
- `scripts/urai-jobs-smoke.mjs`
- `scripts/urai-jobs-deploy-precheck.mjs`
- `scripts/prod-env-precheck.mjs`
- `scripts/verify-custom-domains.mjs`
- `scripts/managed-worker-precheck.mjs`
- `scripts/system-of-systems-audit.mjs`

## P0 launch blockers

### P0-1 Production env is not configured

Required variables:

- `URAI_ENV=prod`
- `FIREBASE_PROJECT_ID`
- `GCLOUD_PROJECT`
- `GOOGLE_CLOUD_PROJECT`
- `GCP_REGION`
- `API_ALLOWED_ORIGINS`
- `WEBHOOK_SIGNING_SECRET`
- `GCS_BUCKET_NAME`
- `NARRATOR_WORKER_URL`
- `ASSET_WORKER_URL`
- `SPATIAL_WORKER_URL`
- `STUDIO_WORKER_URL`

Acceptance criteria:

- `pnpm prod:precheck` passes.
- No placeholders are present.
- Worker URLs are real `https://` URLs.
- `WEBHOOK_SIGNING_SECRET` is at least 24 characters.

### P0-2 Custom domains are not serving the deployed runtime app shell

Current evidence:

- `https://urai-jobs.web.app` passes and serves an expected asset.
- `https://uraijobs.com` returns 200 but does not expose expected app shell/asset.
- `https://www.uraijobs.com` returns 200 but does not expose expected app shell/asset.

Acceptance criteria:

- `pnpm domains:verify` passes for all three default domains.
- Apex and `www` resolve to the same Firebase Hosting app as `urai-jobs.web.app`.

### P0-3 Live production smoke is not complete

Acceptance criteria:

- `pnpm prod:smoke` passes with production environment loaded.
- `pnpm prod:verify-workers` passes against real worker URLs.
- Release evidence is recorded using `docs/RELEASE_EVIDENCE_TEMPLATE.md`.

## P1 major issues

### P1-1 Node runtime mismatch

Current local shell uses Node 20.19.1 while `functions` expects Node 22.

Acceptance criteria:

- Local, CI, and Firebase Functions runtime align on Node 22.
- No engine warnings in production verification logs.

### P1-2 Lockfile must stay refreshed

The local install required `--no-frozen-lockfile` because the lockfile lagged `workers/package.json`.

Acceptance criteria:

- Updated `pnpm-lock.yaml` is committed.
- CI install with frozen lockfile passes.

## Integration plan

1. Keep this repo strictly scoped to runtime execution infrastructure.
2. Keep public hiring marketplace features out unless a future product decision creates a separate bounded module.
3. Use `ops/production.env.example` as the canonical production env surface.
4. Use `pnpm audit:systems` as the high-level readiness audit.
5. Treat `prod:precheck`, `domains:verify`, `prod:smoke`, and `prod:verify-workers` as production blockers.
6. Record real deploy evidence before declaring production complete.

## Completion plan

### Phase 1: repo-local completion

- Install dependencies.
- Build all packages.
- Typecheck all packages.
- Run repo verification and smoke.
- Run deploy precheck.
- Run system audit.

### Phase 2: production configuration

- Fill production env in secret manager, GitHub Actions, Firebase config, Cloud Run, or local `ops/production.env`.
- Confirm worker URLs are deployed and reachable.
- Confirm GCS bucket exists.

### Phase 3: domain repair

- Attach `uraijobs.com` and `www.uraijobs.com` to the correct Firebase Hosting site.
- Verify DNS and SSL.
- Run `pnpm domains:verify` until all domains serve the app shell.

### Phase 4: live verification

- Deploy functions, hosting, Firestore rules/indexes, and Storage rules.
- Run `prod:smoke`.
- Run `prod:verify-workers`.
- Stamp deployment artifact.
- Record evidence.

## Commands

Local repo verification:

```bash
npx pnpm@8.15.9 install --no-frozen-lockfile
npx pnpm@8.15.9 build
npx pnpm@8.15.9 typecheck
npx pnpm@8.15.9 test
npx pnpm@8.15.9 audit:systems
```

Production gate verification:

```bash
npx pnpm@8.15.9 prod:precheck
npx pnpm@8.15.9 worker:precheck
npx pnpm@8.15.9 domains:verify
npx pnpm@8.15.9 prod:smoke
npx pnpm@8.15.9 prod:verify-workers
```

## Final acceptance criteria

URAI Jobs Runtime is production complete only when:

- Build passes.
- Typecheck passes.
- Test passes.
- System audit passes.
- Production env precheck passes.
- Worker precheck passes.
- Domain verification passes.
- Production smoke passes.
- Worker health verification passes.
- Deployment artifact is stamped.
- Rollback path is recorded.
- Release evidence is complete.
