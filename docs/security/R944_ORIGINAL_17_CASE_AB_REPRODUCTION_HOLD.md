# ONE URAI GENESIS / Jobs R944 — exact original-script R940→R942 controlled red-green reproduction

**Date:** 2026-11-09 UTC. **Production: HOLD / NO-GO.** This is an additive original-test evidence receipt on the isolated Jobs [R942 PR #382](https://github.com/LifeLoggerAI/urai-jobs/pull/382). It does not change Jobs application source, queue, consent, IAM, Firestore/Storage Rules, dependency lockfiles, production media or provider environments.

## Source identity / no lost work

- **R940 baseline:** [Jobs PR #378](https://github.com/LifeLoggerAI/urai-jobs/pull/378), commit `5881a650230c55245c87a001c58f3ebc6835196b`. Reconstructed *unaltered* original `scripts/life-movies-idempotency-revocation-race-contract.mjs`: `git hash-object = 86dc2e95edb7a663df90c75bfbe873ec62ace970`, exactly GitHub's blob.
- **R942 repair:** test-only source at [Jobs PR #382](https://github.com/LifeLoggerAI/urai-jobs/pull/382), commit `d87cc22b798b6894861a344125f57747e016c1ba`. Reconstructed *unaltered* original same path: `git hash-object = 9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.
- Original unmodified full `functions/src/privacy/ownerDeletionFence.ts` source blob `25952da83f79f121ce12819dba3452fee6706df6`; original unmodified full `functions/src/jobs/lifeMovieLongformOwnerOrg.ts` source blob `36b809a8e599b288480800f4fc3248eb828b5911`, both verified with `git hash-object`.
- Original inspected `consentBlocks.ts` source *tail excerpt*, length 1,449, FNV64 `75e553817bcf20a2` from full GitHub blob `8bd86161687402ebb610cc30f6677f88521c2c1c`. The two original Studio bridge function *excerpts* were reconstructed with exact upstream length+FNV64: `createLifeMovieJob` length **6,581**, FNV64 `3ef81f986aef68ea`, full GitHub blob `a8c1ba71472312895cb4464282d5d2ba12e190c8`; `createPlan` length **8,315**, FNV64 `c5575ac2841f6d66`, full GitHub blob `888e9645e78d1bd723df883e0a73f042143f1e03`; original `assertPlanOwner` length **210**, FNV64 `cd9a6f3e27179b6d`. These source files are **abbreviated excerpts, NOT full-file Git blob matches**, so tests are correctly classified isolated excerpt+synthetic backend.

## Actual independent native commands and results

**Local runner** Node `v22.16.0`, npm `10.9.2`, global TypeScript `5.8.3` through local symlink, Git `2.47.3`; no current pnpm8 frozen checkout or Firebase tools. Current container `git ls-remote` fails DNS `Could not resolve host: github.com` even though authenticated GitHub connector readbacks succeed.

```sh
# In the isolated source-excerpt fixture only, no production credentials:
node --test scripts/life-movies-idempotency-revocation-race-baseline-r940.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
```

| Source | Result | Native exit | Original TAP SHA256 | Meaning |
|---|---|---:|---|---|
| R940 exact original | **13 PASS / 1 FAIL**, expected-red | 1 | `4d7c62acabc468e97f3695946cb17f07adeb29872e33938b503afef905851a36` | Existing idempotency binding, synthetic long-form plan absent; original source correctly refuses `longform_plan_not_found` |
| R942 exact original | **17 PASS / 0 FAIL / 0 SKIP**, green | 0 | `33313825e8a5d36e72f22454cc5557ecf25257c020065542cca4103fc87b4eda` | R942 fixture now provides owner- and tenant-bound persisted plan, runs true original `assertPlanOwner` plus org helper, and adds missing-plan/wrong-owner/wrong-org expected denials |

A **second controlled rerun** verified the same behavior (R940 **13/14**, R942 **17/17**) and the original file blob pins before running. Rerun TAP SHA256s: baseline `fdf18f7565782e9238893e0946867bcd137080e71489c2070b8e5f7062a4bc1a`; repaired `371fe76ec5790203890c0ab4c641e9a70329a8e764abe117f8fb071eb84f2e9b`. Rerun script exited zero **only because it explicitly treats R940 failure as expected**; R940 native test itself exits 1. Do not count red baseline as a safety PASS.

**Portable evidence:** the ChatGPT conversation contains `One_UrAi_Genesis_R944_Original_Test_AB_Reproduction_2026-11-09.zip`, ZIP SHA256 `73cbd43ec3b2613806c876b4817920b3119fbc4a9bef3b50ee472a0707685b01`, with all four original-case TAP logs, both blob-exact original test files, two full original helpers, source-matched bridge excerpts, FNV checker, controlled rerun script, SHA256SUMS and JSON machine receipt. No media or credentials.

## What is and is not certified

**PASS:** original 17-case test *in isolated faithfully excerpted source with synthetic Firestore doubles*. This is stronger than prior R942's seven independently authored helper-only tests. The original R940 failure is independently reproducible and resolved **in test fixture**, without weakening original private owner/org/revocation handler source.

**NOT_RUN/BLOCKED:** a full original checkout at HEAD with frozen `pnpm@8.15.9`, complete `pnpm urai-jobs:verify` (76 registered commands, not 76 tests), full `pnpm typecheck && pnpm build`, Auth/Firestore/Functions/Storage emulators, Cloud GCS principal `403`, active-upload drain, real signed Privacy C6 admission, protected Life Movie→owner-only Spatial Replay→revocation/deletion and downstream purge ACK, protected CI, reviewer and release approval. R943 Storytime separate positive generation-pinned work still needs pre-delete PENDING/REVOKED reconciliation and future-write fence.

**P0 remains [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252)** storage-enforced stale/alternate writer denial. Positive C6 Jobs authority is still intentionally hard-off; never change a fixture or environment flag to invent a green real-media integration. No production GO or source merge was requested or performed.

## Next exact commands on a real source-complete, credential-free runner

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git && cd urai-jobs
git checkout --detach d87cc22b798b6894861a344125f57747e016c1ba
test "$(git rev-parse HEAD)" = "d87cc22b798b6894861a344125f57747e016c1ba"
test -z "$(git status --porcelain)"
pnpm install --frozen-lockfile
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
node scripts/life-movies-consent-gate-smoke.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
```

Then guarded original disposable four-emulator runner and independent security tests, before any production consideration. Retain **HOLD** regardless of isolated 17/17 green.
