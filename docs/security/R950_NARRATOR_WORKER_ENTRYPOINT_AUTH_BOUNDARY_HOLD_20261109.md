# ONE URAI GENESIS — R950 Narrator worker canonical entrypoint and authentication boundary

**Date:** November 9, 2026 UTC. **Disposition:** source-level defense-in-depth review, **PRODUCTION HOLD / NO-GO**. **Cost:** $0. No cloud access, IAM changes, live requests, customer jobs/media, deploy, paid tools, merge or external action.

## Exact source and PR lineage

- Base: [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) source head `fd1c8d85acd5cc96ef9fcb300173e362b004eb54`, stacked on [#384](https://github.com/LifeLoggerAI/urai-jobs/pull/384). #386 fails closed on misleading legacy rollback, preserving the R879 runner's 57 exact source pins.
- R950 isolated branch: `review/chalk-r950-narrator-canonical-auth-regression-20261109`. No application source, Dockerfile, package lock, native Rules, cloud configuration or production state changed.
- Original root historical Narrator file `workers/narrator-worker/index.js` Git blob `75fbc4967b8c7a68b39fb6987493c244b7aea915` defines `app.post('/', async ...)` with a **comment placeholder** to authenticate; no bearer middleware at that route. It also directly mutates job results on a valid-looking lease. **Risky legacy source, not a verified deployed endpoint**.
- Canonical `workers/narrator-worker/Dockerfile` blob `2f9be4ed4fd6c1eafbea87cc9ca51e6b8c2bf9aa`: copies only `package.json`, `tsconfig.json`, and `src`; executes `npm run build`, `CMD ["node", "dist/index.js"]`. It does **not** include the historical root `index.js`.
- Canonical `workers/narrator-worker/src/index.ts` blob `5b87e7f614852e339834d72d6f4ce2b9aceffb15`: `app.post('/execute-job', requireWorkerAuth, asyncHandler(...))`; `app.get('/authz', requireWorkerAuth, ...)`; validates production worker token + bucket at startup.
- Canonical `workers/narrator-worker/src/runtime.ts` blob `445f34dccc3b96eda73778d9299daa19dcd85982`: absent/blank bearer token returns HTTP 503 (including local/test) and mismatched bearer returns 401 using hashed `timingSafeEqual`. No local bypass.
- `scripts/deploy-workers.sh` blob `b42fdcb1748bcfd0d541c3fffa334401fdf9e3b3`: canonical fleet uses service image built for the named worker and Cloud Run `--allow-unauthenticated`, therefore **application-layer auth is a critical boundary**. No live Cloud Run revision, IAM invoker, image digest or ingress readback exists to prove what was deployed.

## Specific regression gap and review-only correction

Existing `scripts/check-secure-worker-deploy.mjs` blob `49283af8a7e0912bddacef8a5bea3366ad82aa26` required Narrator production secrets and the `/authz` bearer route, but **did not explicitly check authenticated `/execute-job` nor the Dockerfile entrypoint**.

R950 edits only the existing source verification contract, now Git blob `cfbbf163c2800f58d8b2ccf41f9e31c0402351bb`. Six added `requireText` guards check (1) Narrator execution route uses `requireWorkerAuth`, (2) no missing/blank worker token even in tests, (3) timing-safe hashed comparison, (4) Docker copies secured `src`, (5) compiles TypeScript, (6) executes compiled `dist/index.js`. One `rejectText` guard prevents `COPY index.js` from reintroducing the legacy entrypoint. Existing checks left unchanged. No request handler implementation was altered.

**Direct source-check receipt, not native Node test execution:** after committing, all five original relevant files were fetched again from the R950 branch by exact Git blob. Eight truth checks in a pure static comparison confirmed the route/middleware, fail-closed runtime, Docker build entrypoint, presence of legacy unprotected code and the six added contract markers; **8/8 source assertions true**. The original full `node scripts/check-secure-worker-deploy.mjs`, original 77-command root, typecheck, build, packaged Docker image, HTTP bearer-negative tests, authentic Firebase emulators and live Cloud Run IAM were **NOT RUN** in this R950 continuation. Do not call 8/8 static expressions a Node unit test or live vulnerability certificate.

## Recommended next-worker verification

On an already-approved credential-free **free** host with complete clean exact R950 source (never production credentials, never real customer media):

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r950
cd jobs-r950
git checkout --detach <EXACT_CURRENT_FULL_R950_HEAD>
test "$(git rev-parse HEAD)" = "<EXACT_CURRENT_FULL_R950_HEAD>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version
pnpm --version
pnpm install --frozen-lockfile
node scripts/check-secure-worker-deploy.mjs
node scripts/worker-readiness-source-contract.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
```

Next, under independent approval on a disposable local container and synthetic auth token, prove HTTP `POST /execute-job` returns 503 without configured worker secret, 401 with bad bearer, and only valid authenticated synthetic requests reach handler. Verify the actual built Docker image's configured entrypoint and included files; reject/retire or explicitly quarantine the legacy root `index.js` after independently comparing all historical packaging paths. Do not substitute direct source checks for actual runtime and IAM. Also run original guarded R879 native emulators with the required `--run-exact-review-only` flag, and maintain full CI log evidence.

**Separate P0 gates still open:** [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real GCS stale/alternate privileged writer post-revocation 403 and in-flight upload drain/generation-pinned purge; trusted owner C6 Privacy→Studio→Jobs private MP4/SRT→Spatial protected Replay→revocation/deletion ACK; [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission role rights, [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Firestore client rule. Production CI protected review, live cloud inventory, rollback, device acceptance and founder GO remain missing.

**Production HOLD; no new credits, deployment, IAM change, private media or unreviewed merge.**
