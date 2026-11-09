# ONE URAI GENESIS — R950 Jobs HTTP worker, canonical image and historical entrypoint reconciliation

**2026-11-09 UTC | PRODUCTION HOLD / NO-GO | $0 spend | read-only GitHub metadata/source and isolated review-only test contract.** No real media/jobs, no cloud provider access, no IAM/Rules mutation or production deployment.

## Primary successor references

- [Jobs full forensic audit #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), previous R944–R949 receipts; [Labs master #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).
- [Jobs #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384), immutable SHA `fd05a376f876f9b835929a2074c09f47638659e2`: original source-integrity source pins 57/57 and R879 guarded native candidate.
- [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386), immutable SHA `fd1c8d85acd5cc96ef9fcb300173e362b004eb54`: review-only legacy false-success rollback correction.
- **NEW [Jobs draft #387](https://github.com/LifeLoggerAI/urai-jobs/pull/387)**: descendant of #386; strengthens existing `scripts/check-secure-worker-deploy.mjs` source contract. Observed initial HEAD `04592f8573c708954f95f87ddca1e168efde51f4`. It adds no runtime handler, Dockerfile, Firestore Rules, IAM, runner or production mutations.

## Narrator source selection and actual exposure boundary

**Historical risk — not a verified live vulnerability:** `workers/narrator-worker/index.js` Git blob `75fbc4967b8c7a68b39fb6987493c244b7aea915` has an unauthenticated `app.post('/', async...)` with an authentication **comment placeholder** and a simplified Firestore result write. This original root file is retained in history and source, but the canonical `workers/narrator-worker/Dockerfile` Git blob `2f9be4ed4fd6c1eafbea87cc9ca51e6b8c2bf9aa` copies `src` only, runs `npm run build`, and executes `node dist/index.js`. Therefore the historical root file **is not included by this Dockerfile**. The actual live Cloud Run image digest/entrypoint has NOT been inspected.

The canonical `workers/narrator-worker/src/index.ts` Git blob `5b87e7f614852e339834d72d6f4ce2b9aceffb15` guards `POST /execute-job` and `GET /authz` with `requireWorkerAuth`. `src/runtime.ts` Git blob `445f34dccc3b96eda73778d9299daa19dcd85982` refuses missing/blank secret with 503 **even in test** and mismatched bearer with 401 using timing-safe hashed comparison. The previously enrolled security checker only asserted Narrator's `/authz` and production token configuration; it did not assert the execution route or Dockerfile target.

R950 review updates ONLY `scripts/check-secure-worker-deploy.mjs`: original blob `49283af8a7e0912bddacef8a5bea3366ad82aa26` → `cfbbf163c2800f58d8b2ccf41f9e31c0402351bb`. Adds six required source invariants: protected `POST /execute-job`, missing-token denial, timing-safe comparison, Docker copies `src`, compiles, and executes `dist/index.js`; plus one rejection of legacy `COPY index.js`. A current GitHub readback of all original source blobs and eight pure source comparisons returned **8/8 true**. **This is a static readback, not independently run original Node, Docker, HTTP or cloud tests.** Existing `pnpm urai-jobs:verify` includes the strengthened checker; but the entire original 77-command suite is still NOT_RUN on this SHA.

## Additional exact-source HTTP route inventory (not live resource inventory)

| Worker / original source path | Runtime route and security source | Explicit uncertainty |
| --- | --- | --- |
| Narrator canonical `workers/narrator-worker/src/index.ts` | `/execute-job` and `/authz` require bearer. Source Docker builds secured `src`. | Live image digest/ingress and actual negative HTTP status not measured. |
| Narrator legacy `workers/narrator-worker/index.js` | Old unauthenticated `POST /` with placeholder auth and simplified writes. | **NOT** Dockerfile target; no proof this legacy source was ever deployed at present. |
| Asset `workers/asset-worker/index.js` | `POST /` bearer-protected, callback requires dedicated callback secret plus opaque callback token and lease/transaction checks. | Real callback public URL provenance, token leakage, IAM and signed request status unverified. |
| Studio `workers/studio-worker/index.js` | `POST /` bearer-protected, current consent authority constant `false` → 503; private MP4/SRT writes blocked by constant-false authority module; readiness unavailable. | Deliberate P0 hard-off, not completed end-to-end render or actual IAM denial. |
| Private Source `workers/private-source-worker/src/index.ts` | `POST /execute-job` bearer-protected for staging/prod; local/test/emulator only permits missing bearer. Calls private-source authorization before provider work. | Confirm runtime `URAI_ENV` and no local/test spoof in live Cloud Run, plus HTTPS and actual provider identities. |
| Captured Reality `workers/captured-reality-worker/index.js` | `POST /execute-job` bearer + rate-limit; `POST /engine-callback` callback token SHA256 tied to active job and deadline in Firestore transaction; consent blocks rechecked. | Query callback token may require log/redirect redaction review; no live engine proof. Current canonical GitHub workflow's selected worker set does **not** include Captured Reality even though script supports it. |
| Legacy Spatial `workers/spatial-worker/index.js` | `POST /` bearer with local/test bypass, explicitly returns 501 `SPATIAL_WORKER_NOT_IMPLEMENTED`; root reports implementation not ready. | Not a substitute for protected Spatial application's Replay implementation; no current canonical worker selection established. |

The canonical `scripts/deploy-workers.sh` blob `b42fdcb1748bcfd0d541c3fffa334401fdf9e3b3` uses Cloud Run `--allow-unauthenticated`, with explicit operation-level tokens for supported worker implementations. **This establishes a reliance on application-level authentication in source, not the effective GCP IAM policy or live network accessibility**. The canonical production workflow selects narrator-worker + asset-worker, optional studio-worker/private-source-worker, depending on approved inputs. No live deployed revision, principal or service URL was inspected.

## Next worker exact verification

1. Re-fetch moving #387 and parent #386 SHA. On a clean full immutable checkout and approved **free credential-free** CPU host, actually run `node scripts/check-secure-worker-deploy.mjs`, the original 77-command `pnpm urai-jobs:verify`, frozen build/typecheck and guarded R879 `bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only` with its required disposable-project variables. Do not treat R950 static 8/8 as execution.
2. Build only the **canonical Narrator Dockerfile** in a disposable local environment (no registry push or paid Cloud Build), verify image command resolves to `dist/index.js`, root legacy file absent, and prove HTTP 503 missing token, 401 bad token, valid token passes authentication into a *synthetic* harmless dispatch stub.
3. Audit public worker route inventory with isolated HTTP tests: Asset callbacks require both tokens/current lease; Captured Reality callback expiration/consent and query-token redaction; Private Source emulator-bypass impossible under production env; Studio bearer plus consent/write hard-off. Use dummy IDs and no real provider calls.
4. Obtain **already authorized** live read-only Cloud Run service/revision/IAM/digest/ingress metadata; compare source/image labels, service accounts, WIF, worker environment, protected rollback and service HTTP auth. Cloud Console URL alone is not provider evidence.
5. P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) privileged GCS future-write denial 403 after revocation, in-flight upload drain, generation-pinned purge ACK; signed positive C6→Studio→Jobs private MP4/SRT→Spatial protected Replay→revoke/delete. P1 [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission rights policy, [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Rules binding. Protected CI, independent eligible reviewer and founder GO still required.

**No credits spent, no private media or live cloud data accessed, no production change, no actual deployment proof. ONE URAI GENESIS HOLD.**
