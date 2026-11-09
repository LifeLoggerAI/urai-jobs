# ONE URAI GENESIS — JOBS R934–R940: ORIGINAL SECURITY-SOURCE TEST EXECUTION & NO-GO HANDOFF

**Audit checkpoint:** 2026-11-08 23:26 America/Chicago / 2026-11-09 06:26 UTC. **Source-only review and isolated CPU tests. No production certification.** Keep Genesis production **HOLD**.

## Starting authority and untouched source

- Jobs runtime two-parent review [PR #371](https://github.com/LifeLoggerAI/urai-jobs/pull/371) commit `df19633466eaebdda844569ed0d562245bd31dc6`: #368 original owner/tenant/org cancellation donor + #369 quota deletion donor; OPEN DRAFT UNMERGED; application source remains unchanged in this entire R934–R940 continuation.
- Test-only parent [PR #374](https://github.com/LifeLoggerAI/urai-jobs/pull/374) head at commencement `37a118dd46804561ead61d4df772e47328b2ecd6`, retains R933 **10/10** privacy creation/deletion guard original-source checks and earlier R924–R933 fixtures. Remains unmerged.
- New **separate** test-only branch `review/chalk-r934-consent-smoke-original-authority-review-20261109`. Latest code commit **`52cac02c22cc7e19e3e3f9a81dc2bac854086d2b`**. No application source, Firestore/Storage Rules, worker, triggers, IAM, tokens, original donor branches or production resources edited.

## New source-only test modifications / exact ancestry

| Round | Immutable commit | Test change and invariant preserved |
|---|---|---|
| R934 | `009cdbec9ab4f5d4e911355397f7dcdf19c61202` | `scripts/life-movies-consent-gate-smoke.mjs`: compiles **original** `lifeMovieLongformOwnerOrg.ts` and `currentJobCallerAuthority.ts`, inserts exact exports into smoke VM, asserts cross-org denial; no bypass helper |
| R935 | `93a51170b33a3873f34dfbe2b2e2302ab3a8d7b8` | Same smoke: adds synthetic current Firestore owner/operator account profiles and current tenant to synthetic jobs; manual operator receives authenticated UID; source current-authority veto retained |
| R936 | `dd8f428c304943517d609a2c4eff67fe04095f77` | `scripts/urai-jobs-verify.mjs`: legacy static `job.ownerUid !== authenticatedUid` assertion replaced with required **transactional current-user read + boundJobMatchesCurrentOwnerScope(job,currentUser,caller.uid)**, retaining owner/tenant/org denial |
| R937 | `a0abef3d0d6c6e4770b5bab70c2cd14a442326c8` | `scripts/queue-recovery-contract.mjs`: assert three original transaction reads (queue, master job, **current operator profile**) and current-role recheck after read before lease; replaces obsolete two-read regex |
| R938 | `067b418e0f8544f3d8e0ecac5a7c85a05396ce6d` | `scripts/life-movies-longform-resume-transaction-contract.mjs`: inject actual original `assertLifeMovieJobPlanOrg` into extracted resumePlan VM |
| R939 | `bd25a7e32c2bc5350f3549fd24e2b11426ce7a20` | `scripts/r417-original-donor-longform-resume-transaction-contract.mjs`: same original owner/org helper in original donor VM; both resume suites then targeted PASS |
| R940 | `52cac02c22cc7e19e3e3f9a81dc2bac854086d2b` | `scripts/life-movies-idempotency-revocation-race-contract.mjs`: inject real `serverLifeMovieOwnerOrgId`, `assertLifeMoviePlanCurrentOrg`, `assertLifeMovieJobPlanOrg`, with negative cross-org fixture; preserves server-owned plan authority |

Do not merge this test-only branch into protected main or R923 source until independent review. Every patch is an original-source harness/witness update; none establishes deployed runtime behavior.

## Actual immutable-source test ledger

All runs used owner-authorized isolated short-lived RunPod CPU, a clean exact Git checkout, Node `v22.23.0`, pnpm `8.15.9`, Java 21, Node archive checksum, `bash -n` original R879/R854 acceptance entrypoints, no inherited Firebase/GCP production credentials and no customer objects, live jobs, worker delivery or Cloud IAM mutations. Test logs are NOT consumer media. Every nonzero exit is **HOLD**.

| Round | Target / result | Next original-source blocker | Exact receipts |
|---|---|---|---|
| R934 `009cdbec...` | Frozen install PASS, consent smoke **FAIL** | Original helper imports fixed; queue expected unrelated job LEASED but **missing synthetic current owner** left it PENDING, a fail-closed server protection | `smoke.log` SHA256 `a857090e520dd4353e598d5cde678940f581df05aaa06cf1494c56d47e560f2d` |
| R935 `93a51170...` | Frozen install PASS, targeted consent smoke **PASS**; root verify **FAIL** | Legacy checker demands raw ownerUid/authUID comparison, whereas current source validates current owner + tenant/org via server-bound helper | `smoke.log` SHA256 `73ec865f3c15b89793f1e6669d00cf85f801067c885bf2bd60494fa9aab39850`; root SHA256 `5d3e71bdf3cecf9acab298ab8854668a5266664f1df2dbdb5fe1f0790cd9f23b` |
| R936 `dd8f428...` | Frozen install + consent smoke **PASS**; root verify **FAIL** | Original queue recovery regex assumes only queue+job reads, missing current operator profile in same transaction | root SHA256 `9bfdac91b6794856c486ea5fe9204e9f6ca429a6773c56e4012e7aa891ad3502` |
| R937 `a0abef3...` | Frozen install + smoke **PASS**; root verify **FAIL** | Original `life-movies-longform-resume-transaction-contract.mjs` extracted VM lacks `assertLifeMovieJobPlanOrg`, triggering ReferenceError in multiple cases | Original failed test file/cases captured in RunPod stdout; no independent full TAP digest retained |
| R938 `067b418...` | Frozen install + smoke **PASS**; root verify **FAIL** | Independent historical donor `r417-original-donor-longform-resume-transaction-contract.mjs` has same missing VM helper | Original failed test file/cases captured; no complete root PASS |
| R939 `bd25a7e...` | Frozen install + smoke PASS; **both original resume suites targeted PASS**; root verify **FAIL** | Next `life-movies-idempotency-revocation-race-contract.mjs` 14-case suite **11/14 PASS**, three long-form cases missing original `serverLifeMovieOwnerOrgId` in fixture | `resume.log` SHA256 `f74e4906592c5aec84bb067d360f6a148f935e0c1e819b3a554671711ad8caa9`; `verify.log` SHA256 `b98fabf4a7fd72066268b4628ed8211b7893b25e0902687c7d869ed7ce82113d` |
| R940 `52cac02...` | Frozen install + smoke PASS; **both resume suites targeted PASS**; idempotency suite now **13/14 PASS**, 1 FAIL | Positive existing-binding `clear` case returns `longform_plan_not_found`. Original source requires a bound stored plan when replaying the prior idempotency key. Synthetic fixture supplies binding but not plan. No full root verification stage reached | `idempotency.log` SHA256 `bdc8f76cbb048c77c1250b462029c6a85e69c1524757b172d9a22f7a51bfa06e`, `resume.log` SHA256 `e3afa4492d7eb69122c21306f0c4b59f377d20f6d22ad56a9b3e1c54e7450cbc`, frozen `install.log` SHA256 `77ac0633bbd965a3c006cebd3172048dfa4111395869fc6dd66c350177973291` |

**Critical nuance:** A targeted local PASS or absence of a failure in an unexecuted later stage does not certify the 76-command root suite. No latest commit has passed the entire suite, typecheck/build, four emulator acceptance or real cloud data-plane rights. Do not aggregate R934–R940 into one full pass count.

## Why `longform_plan_not_found` is the current exact R940 failure

In original `functions/src/jobs/studioLifeMovieLongformBridge.ts` at source blob `888e9645e78d1bd723df883e0a73f042143f1e03`, `createPlan` on an existing idempotency binding checks `bindingMatches`, reads `transaction.get(planRef(binding.jobId))`, **refuses a missing boundPlan with `longform_plan_not_found`**, then checks `assertPlanOwner` and `assertLifeMoviePlanCurrentOrg` before returning `deduplicated:true`. This is a correctness/safety invariant; never remove or bypass it. The test source `scripts/life-movies-idempotency-revocation-race-contract.mjs` (R940 blob `86dc2e95edb7a663df90c75bfbe873ec62ace970`) returns a simulated binding of jobId `prior-accepted-job` but has **no corresponding persisted `planRef('prior-accepted-job')`**. A reviewer must add a minimal faithful original plan fixture matching `assertPlanOwner`/org and source scope, then rerun original 14 cases and no-write cancellation/revocation tests. Preserve the negative case of a missing bound plan separately, rather than making positive case bypass storage.

## Next exact commands / acceptance sequence (NO production)

1. Read [Jobs draft #371](https://github.com/LifeLoggerAI/urai-jobs/pull/371) and [test-only branch](https://github.com/LifeLoggerAI/urai-jobs/tree/review/chalk-r934-consent-smoke-original-authority-review-20261109) and Genesis Labs master R933. Verify SHA `52cac02...` before any new patch; create separate review-only test branch if the original worker is modifying this one.
2. Fix **only** original R940 idempotency test plan fixture (plan must exist and be owner/org/scope correct). Ensure additional missing-plan negative test, if needed, proves `longform_plan_not_found` and makes **zero writes**; preserve all original consent/revocation negative test coverage. Do not weaken runtime code.
3. In credential-free isolated checkout pin full next SHA: `pnpm install --frozen-lockfile`, `node --test scripts/life-movies-idempotency-revocation-race-contract.mjs`, both original `life-movies-longform-resume-transaction-contract.mjs` and `r417-original-donor-longform-resume-transaction-contract.mjs`, `node scripts/life-movies-consent-gate-smoke.mjs`; capture all TAP and sha256. Then entire 76-root `pnpm urai-jobs:verify` without bypass. Typecheck/build only when preceding is green. The original R879/R854 four Firebase emulators require approved `demo-urai-jobs`/disposable project and clean global cloud env guards; do not run against real cloud.
4. Independently review source/acceptance/rollback protection and perform owner-approved **read-only** GCP/Firebase project `urai-jobs` live resource inventory, service IAM, deployed Rules/releases and Cloud Run/Functions/storage revisions. **No GCP provider metadata readback has been achieved here.**
5. P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) must prove true storage-enforced post-revocation stale/alternate privileged principal GCS **403**, active upload drain, exact-generation purge ACK. Real signed Privacy→Studio→Jobs→GCS→owner-only Spatial/Replay→revoke/deletion and downstream ACK remains untested. Do not write customer media or process real jobs without explicit authorization.
6. Keep GitHub required checks and independent reviewer protected; CI jobs on past commits failed with **0 executed steps**, not proven source/compiler failures. No merge/deploy until all P0 and safety-critical P1 gates clear.

## Release decision and evidence classification

- **Verified:** GitHub original-source review hashes, six changed test-only files, immutable source test attempts R934–R940, exact local negative/synthetic checks, all named RunPod test hosts stopped when completed.
- **NOT verified:** Current live Firebase apps/Functions/Firestore/indexes/Storage/Auth/Rules/IAM/Cloud Run/Scheduler/PubSub/Hosting/logs/billing, deployed code SHA, real external worker route, GCS stale-writer IAM denial, signed owner-positive private media, owner-only Replay, deletion/purge ACK, four-emulator suite, protected CI approval, independent production visual/device review.
- **Decision:** **ONE URAI GENESIS JOBS = NO-GO / PRODUCTION HOLD.** R940 has a tracked source-faithful test fixture repair, not a release. No production resources modified.
