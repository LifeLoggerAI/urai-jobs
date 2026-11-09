# ONE URAI GENESIS — Jobs R942 original-source idempotency fixture repair / PRODUCTION HOLD

**Checkpoint:** 2026-11-09 UTC. **Proposed review SHA:** `dd0d03be0393285d8adf800b162231173b5b7395`. **Parent:** Jobs R940 [PR #378](https://github.com/LifeLoggerAI/urai-jobs/pull/378), `5881a650230c55245c87a001c58f3ebc6835196b`. The parent original code is unchanged. This is a **one-file test-only repair** on a fresh branch. No real media or production activity.

## Reconciled R940 failure

R940 targeted original `scripts/life-movies-idempotency-revocation-race-contract.mjs` 14-case test reported 13 PASS / 1 FAIL: the positive long-form existing-binding replay returned `longform_plan_not_found`. The original bridge `functions/src/jobs/studioLifeMovieLongformBridge.ts` blob `888e9645e78d1bd723df883e0a73f042143f1e03` deliberately reads `transaction.get(planRef(binding.jobId))`, refuses a missing plan, then checks original `assertPlanOwner` and `assertLifeMoviePlanCurrentOrg`. Those are correct safety checks; do not remove them.

## R942 exact test-only change

- Original R940 test blob `86dc2e95edb7a663df90c75bfbe873ec62ace970` -> R942 test blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.
- Adds a realistic stored `plans/prior-accepted-job` record for long-form positive existing-binding replay. It binds `planId`, `ownerUid`, `tenantId`, source project/digests, consent, status and required plan metadata. It is **synthetic only**.
- Preserves the original no-write behavior; includes missing stored plan, wrong owner and wrong organization as **three extra explicit fail-closed cases**, bringing the test's declared Node `test()` cases from 14 to 17.
- Evaluates the exact `assertPlanOwner` implementation from the current original long-form source, rather than inserting a permissive test stub. Current `lifeMovieLongformOwnerOrg.ts` is the original production source blob `36b809a8e599b288480800f4fc3248eb828b5911` and is likewise evaluated, not bypassed.
- All existing revoked, malformed, owner-pending, owner-missing, owner-malformed and failed Firestore-read denial tests remain; short-form behavior unchanged.

**No application code, worker, Firestore/Storage Rules, signing authority, IAM, deployment, locks or production resources changed.** This patch cannot enable C6 or writing private derivatives.

## Native local evidence *actually executed*

Local container: Node 22.16.0, npm 10.9.2, Java 21, Git 2.47.3; direct git clone failed `Could not resolve host: github.com`. Tested **seven independently authored isolated original-helper-contract cases**, including the positive same-owner unscoped plan, absent plan, wrong owner, wrong organization, inherited/accessor org guards, and current-org mismatch.

Command: `node --test /mnt/data/genesis_r942/validate_original_owner_org.test.mjs`  
Result: **7/7 PASS / 0 FAIL / exit 0**. TAP digest SHA-256: `132b5b3406e37117fc7a1d52d3144f5b978a4a9f83e5cf613332d03e2ec3784e`.

This local test is an **extracted-helper synthetic behavior check**, **NOT** execution of the patched full 17-test script. It does not establish complete original bridge runtime behavior, emulator acceptance, whole workspace tests or a release PASS. The patch was written and read back through authenticated GitHub connector; full native re-execution is still **NOT_RUN / BLOCKED** in this session.

## Exact next verification commands

On a clean, independently approved credential-free source-complete host at **exact commit** `dd0d03be0393285d8adf800b162231173b5b7395`:

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git
cd urai-jobs
git checkout --detach dd0d03be0393285d8adf800b162231173b5b7395
test "$(git rev-parse HEAD)" = "dd0d03be0393285d8adf800b162231173b5b7395"
test -z "$(git status --porcelain)"
node --version
corepack pnpm --version
pnpm install --frozen-lockfile
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
node --test scripts/life-movies-longform-resume-transaction-contract.mjs
node --test scripts/r417-original-donor-longform-resume-transaction-contract.mjs
node scripts/life-movies-consent-gate-smoke.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
```

**Expected** for the isolated original 17-case target: 17 PASS only if source/fixture correctly represents plan records; do not pre-certify this. Preserve every full native TAP, exit code, `sha256sum`, tool versions, frozen lockfile and exact HEAD. Full review suite and four-service disposable Auth/Firestore/Functions/Storage emulator runner remain required; no customer or production credentials in tests.

## P0 blocking parent and release gates

- [Jobs P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): storage-enforced future write denial after revocation, active upload drain, exact-generation deletion and producer IAM.
- Actual owner-signed trusted C6 `lifeMovieConsentAuthorityAvailable()===false` remains deliberately hard-off at original source blob `53761ac0f5c0340563b13fdd9a12a90e75409d42`. No caller receipt or test fixture may substitute for valid consent.
- Jobs source candidate [#371](https://github.com/LifeLoggerAI/urai-jobs/pull/371) remains draft; full 76-command suite, native emulator acceptance, privileged GCS IAM testing and signed private media→Studio→owner-only Replay→revocation/deletion ACK remain unproven.
- Other Genesis gates: competing Firestore Rules publishers `urai-4dc1d/(default)`, operational billing, CI start failures, source-to-deployment parity, protected independent review, physical devices, accessible spatial journey, visual owner GO.

**Disposition:** REVIEW ONLY / UNMERGED / NO DEPLOY / GENESIS PRODUCTION HOLD. Preserve R940 original worker branch and previous Chalk test receipts without double counting.
