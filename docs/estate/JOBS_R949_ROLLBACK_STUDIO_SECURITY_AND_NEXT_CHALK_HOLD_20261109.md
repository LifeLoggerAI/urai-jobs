# ONE URAI GENESIS — Jobs R949 latest rollback/Studio forensic handoff

**November 9, 2026 UTC | Production HOLD / NO-GO | $0 spend | no live GCP calls or changes.**

## Read-first continuation

- Complete forensic evidence, resource unknowns, prior test history and P0–P3: [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), especially [R948 handoff](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/JOBS_R948_SOURCE_AND_ORIGINAL_TEST_RECONCILIATION_HOLD_20261109.md).
- Preferred reviewed runner candidate [Jobs #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384), source `fd05a376f876f9b835929a2074c09f47638659e2` (57/57 Git pins; 77 root commands enrolled but not executed).
- **NEW** source review child [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386), initial documented SHA `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` for the rollback hard-stop, derived from #384. Review-only; do not merge or deploy automatically.
- Detailed exact source evidence: [R949 security handoff](https://github.com/LifeLoggerAI/urai-jobs/blob/review/chalk-r949-rollback-placeholder-hard-stop-20261109/docs/security/R949_ROLLBACK_AND_STUDIO_HARD_OFF_EVIDENCE_20261109.md). Re-read current HEAD before any further work.

## R949 confirmed source issues and actions

1. **Legacy false-success rollback fixed in isolated draft:** Original `.github/workflows/rollback-on-smoke-failure.yml` blob `2cc2c0959d0537a94ffd84e7173d185322331d2c` was manual-dispatch, checkout, log messages claiming a previous stable revision *would* be restored, and exit 0. It did **not** execute any restore. New source exact blob `33cf1d462b0cb3460bb88fa53f5bced98a84a24e` is manual-only, no checkout, emits `[BLOCKED]` and exits 1. Prevents misleading success; does not perform rollback.
2. **Original offline tests actually executed:** New exact original Node test `scripts/r949-legacy-rollback-hard-stop.test.mjs`, Git blob `86d1673fb685c4e51f3cf3eec37d858093e64747` and matching workflow blob materialized from GitHub source and independently Git-hashed. `node --test` 3/3 PASS, zero failures/skips, exit 0, Node22.16.0, log SHA256 `8d81a13b83dadbe686ee2512566fcc75d445683088a6bf5096cfb8733c2ef9c9`. It actually runs original harmless Bash block and asserts code 1. **Not GitHub-hosted or a live Cloud Run rollback test.**
3. **Actual canonical rollback tooling is distinct:** `scripts/rollback-cloud-run-workers.sh` blob `b05cdef551022cedaa4a9da64b502d1099120443` can update Cloud Run traffic to a specified revision if invoked; `scripts/verify-rollback-revision.mjs` blob `cbca016fb807ce1e0e48a2c41e46f1f7b26e7c40` checks service image/source/secret fingerprint and rollback provenance; `.github/workflows/urai-jobs-production-deploy.yml` blob `0bc4d67765ce128df2861b2cb8e4469c51d63f87` is canonical WIF/approved deploy. None were invoked to mutate cloud; live restore and health evidence UNKNOWN. Do not confuse source-coded traffic commands with certified rollback.
4. **Source-confirmed deliberate Studio security hard-off:** `workers/studio-worker/index.js` exact blob `1b0e1fbcc76b4e9fc2fbd58863a33723f4513973` has `lifeMovieConsentAuthorityAvailable() { return false; }`; authenticated render `POST /` returns HTTP 503 before work and `/readyz` is not ready under source logic. Two MP4/SRT upload sites call `assertPrivateOutputWriteAuthority` before direct GCS write. Original authority module exact blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76` always denies private writes. Independently ran 3 isolated original-module behavior assertions, 3/3 PASS (not native provider IAM).
5. **Actual Cloud Run ingress policy needs an explicit trust decision:** canonical `scripts/deploy-workers.sh` source uses `--allow-unauthenticated`, with worker operations protected at application layer via bearer token (e.g. Studio `requireWorkerAuth`, Asset worker callback checks). This is not automatically exploitable, nor proof of live deployment; record effective IAM/ingress and independently test negative/positive HTTP authorization and broker-only media routes before public release.
6. **Historic broad IAM bootstrap is currently blocked in source:** `scripts/bootstrap-managed-worker-iam.sh` explicitly exits 1, and generic `deploy-managed-worker.sh` also exits 1. Existing legacy IAM grants can still persist—no real IAM readback.

## Next Chalk must not double-count

- 3/3 rollback source tests and 3/3 private-output module checks are **two separate small offline checks**; neither is the root 77-command suite, native Firebase emulator, real GCS IAM 403, or live Cloud Run service test.
- #386 is a **child of #384**, not a production deployment or code fix for Storage IAM. #384 has 57/57 matching R879 Git pins and a previous 5/5 original Git preflight, but full R879 not passed.
- Current GitHub Actions #384 exact-head 9/9 failed workflows, sampled Validate runtime zero job steps with log 404; root cause unverified.
- Main is unchanged at last observed `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; effective GitHub protected rulesets and deployed runtime still UNKNOWN.

## Actionable next work and hard stops

**Free/offline:** Original Node rollback test and source alignment already done; independently review #386, and on a complete credential-free host run full original Node22/pnpm8.15.9/Java21 frozen 77-command root, typecheck/build and R879 `--run-exact-review-only` genuine four-emulator acceptance against one immutable reviewed head, preserving exact Git pins. If #386 changes neither root manifest nor pinned sources, still verify the full candidate SHA and clean tree.

**Read-only cloud (only already-authorized account access, no payment):** project app/Function/Run/Storage/Firestore indexes/Rules/IAM/Secret Manager metadata, WIF, source/image digest, public Cloud Run invoker settings, all worker revisions and rollback-ready ancestor, billing/quotas/alerts. No secret values or user data.

**Independent production P0:** [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) actual stale/alternate privileged GCS writer denied after revocation with real 403; in-flight upload drain; generation-pinned deletion and downstream purge ACK. Positive independently authorized C6 Privacy→Studio→Jobs protected MP4/SRT→Spatial owner-only Replay→revocation/physical deletion and no cached link bypass. **Do not lift hard-off in code without positive safe design and real IAM receipts.**

**Governance:** Protected CI, eligible independent review, real rollback and health restore proof, signed founder launch decision, no TinyFish/paid compute/real private media without separate authorization. **ONE URAI GENESIS HOLD.**
