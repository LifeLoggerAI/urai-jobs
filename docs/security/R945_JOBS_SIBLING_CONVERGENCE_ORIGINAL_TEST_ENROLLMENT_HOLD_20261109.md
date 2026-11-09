# ONE URAI GENESIS — R945 source-faithful sibling convergence, exact-source acceptance enrollment and HOLD

**Date:** 2026-11-09 UTC. **Decision:** **PRODUCTION HOLD / NO-GO.** **Cost:** $0.  
**Scope:** `LifeLoggerAI/urai-jobs` review-only source branch `review/chalk-r945-r942-sibling-test-convergence-20261109`. No customer media, production IAM/Rules, cloud deployment, paid provider calls, original peer branch rewriting, or release promotion.

## 1. Exact pre-existing Genesis audit and hierarchy

- [Labs master registry draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), full Jobs forensic [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) R944 pack, master cross-chat [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).
- Original Jobs R940 parent [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) `5881a650230c55245c87a001c58f3ebc6835196b` (13/14 original idempotency, one long-form positive fixture missing persisted plan).
- Sibling [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) HEAD `a295fd834c1cc01710a36b04523b023de2283240` (Rules deletion-request ID, static/native tests and runner source pins); sibling [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382) HEAD `d87cc22b798b6894861a344125f57747e016c1ba` (exact original longform fixture).
- New R945 branch created **from #381 immutable head** and copied the **exact #382 test Git blob**, NOT a blind textual/manual re-implementation or merge of unreviewed code. Neither peer branch changed. The R942 #382 documentation-only receipt was not copied: it remains independently accessible through #382 and is linked here.
- `main` as observed in this checkpoint `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, protected field reported false. No production source was changed.

## 2. Exact original code/test and source pin readback

| Original path at new R945 review head | Observed Git blob | Result |
| --- | --- | --- |
| `firestore.rules` | `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` | **Exactly** preserved R942 #381 protected `dataRightsDeletionRequestId` |
| `scripts/owner_authority_rules.static.test.mjs` | `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75` | Original 15-test static security suite unchanged |
| `scripts/user_authority_rules.firebase-emulator.test.mjs` | `95f4b72b1d7260a191b0cdc77c5cf008b57011e0` | Original genuine native Auth/Firestore client REST test unchanged; NOT executed |
| `scripts/life-movies-idempotency-revocation-race-contract.mjs` | `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c` | Exact-byte #382 donor; realistic existing-plan fixture and three additional negative test cases; not rerun |
| `functions/src/jobs/studioLifeMovieLongformBridge.ts` | `888e9645e78d1bd723df883e0a73f042143f1e03` | Original server implementation unchanged, owner/org/consent guards preserved |
| `functions/src/privacy/dataRightsExecution.ts` | `756547684397788d8051acace70ac0e5c03e2e17` | Original rights/deletion implementation unchanged |
| `package.json` | `4804276332491e1e57a95a2a0cec7050df3a595c` | Preserves prior root verification, adds exact original idempotency `node --test` invocation once; now **77 unique commands enrolled** (76 prior + 1) |
| `scripts/run-r879-unified-native-acceptance.sh` | `29a3d2877ff97e7707eaf5a33f7d3f2c39aa416b` | Preserves prior source integrity pins, updates package hash, adds donor test exact hash pin and fails closed unless original Node output includes `# pass 17` |

**Important:** This is a serial commit chain on the #381 candidate, *not* a native Git two-parent merge. Exact donor test blob is identical; all #381 security files are identical. A future merge steward must still assess conflicts with newer authority/privacy branches before promotion. The R879 runner does not issue `firebase deploy`; invoking native emulators still needs a safe, credential-free, disposable host.

## 3. Verification actually executed and independently assessed

**Live GitHub original file readback/static checks:** Original donor test SHA exactly equals #382; original Rules/static/native scripts equal #381; root verification contains 77 unique command strings, the original longform test exactly once, and the original static Rules test exactly once. R879 pins of every directly inspected affected file match actual Git blobs (seven matching inspected pins). The R879 stage for long-form idempotency is present and has exact PASS-count assertion. Original longform flag `URAI_LIFE_MOVIE_LONGFORM_ENABLED` remains source-gated.

**Real local original Node test run, isolated three-file source only:**

```sh
cd /mnt/data/r942_verify
git hash-object firestore.rules scripts/owner_authority_rules.static.test.mjs scripts/user_authority_rules.firebase-emulator.test.mjs
node --check scripts/user_authority_rules.firebase-emulator.test.mjs
node --test scripts/owner_authority_rules.static.test.mjs > R945_original_static_node.tap 2>&1
sha256sum R945_original_static_node.tap
```

- Original three Git blobs match source SHA identifiers above, real `node --check` **PASS**.
- Actual original `node --test scripts/owner_authority_rules.static.test.mjs`: **15/15 PASS, 0 FAIL, 0 SKIP, exit 0** at Node v22.16.0.
- TAP log `R945_original_static_node.tap`: **3418 bytes**, SHA256 **`00fb4ae0bf5b39442ab165549e1422f3ee5e7c95b48772763710b4a3893f6877`**.
- This is a **repeat of the existing same 15-test suite**, not a new 15-case family, full root run, or Firebase engine test.
- **NOT RUN**: the newly enrolled original longform **17-case** Node test, the 77-command root suite, actual native four Firebase emulators, full build/typecheck, live GCP IAM, deployed Rules/SHA, storage writer 403, authorized Studio/Jobs/Spatial private film, or deletion acknowledgement. Prior GitHub environment cannot resolve github.com from container; `pnpm`, `firebase-admin`, `firebase-tools` are not installed. Available global TypeScript alone cannot truthfully support original full test execution.

**Security acceptance note:** The #382 fixture expects original `assertPlanOwner` and original org helper, with explicit missing-plan/wrong-owner/wrong-org negative cases. Because the original full 17-case suite has not actually run, **do not mark the old R940 13/14 failure fixed**. The new root/R879 acceptance deliberately makes that test a required gate rather than letting it be left unenrolled.

## 4. Immediate next Chalk actual commands and stop conditions

Use independently reviewed **immutable R945 PR HEAD** from GitHub, not a moving branch name as a test identity. Clean source checkout on an **already approved FREE / credential-free CPU host** with Node22, pnpm8.15.9, Java21 and correct frozen dependency trees:

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r945
cd jobs-r945
git fetch origin
git checkout --detach <EXACT_CURRENT_R945_FULL_40_CHAR_SHA>
test "$(git rev-parse HEAD)" = "<EXACT_CURRENT_R945_FULL_40_CHAR_SHA>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version
pnpm --version
pnpm install --frozen-lockfile
node --test scripts/owner_authority_rules.static.test.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh
```

**Hard stop on first nonzero test or source-pin mismatch.** R879 itself has additional environment/credential restrictions and nested review-only Firebase `demo-urai-jobs` and `urai-staging-test` emulator project guards; inspect the script before running and do not use actual `urai-jobs` project/credentials. Capture complete SHA256 logs, exit statuses and effective test identity. Real authenticated Firestore Rules change/add/remove with ID token must be **403**, valid displayName client update **200**, Admin authorized deletion write must remain functional.

## 5. Independent security/release blockers that R945 deliberately does NOT fix

- P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): priviliged GCS writer post-revocation **real IAM 403**, exclusive writer broker, in-flight upload drain, exact-generation deletion and downstream purge ACK missing. Client Firestore Rules do NOT certify Cloud Storage IAM.
- P0 signed positive owner C6 consent and independent Privacy → Studio → Jobs MP4/SRT → Spatial owner-only private Replay → revocation/deletion is NOT certified.
- P1 [Jobs #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission executor role withdrawal/approved continuation policy; original 4 expected-red security checks not resolved.
- P1 [Jobs #337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) current operator/owner/tenant/org hardening on unmerged review source requires complete native acceptance.
- P2 [Jobs #345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) atomic createJob rate-limit quota and 9th index currently candidate-only; deployed effective index still UNKNOWN.
- Current GCP cloud resource inventory, live deploy revision/Rules/IAM/billing/quotas, protected CI with actual execution and independent review, required rollback and founder release decision remain UNKNOWN/blocked.

**Do NOT merge, deploy, spend, enable private media, loosen storage authorization or assert production GO.** This is a useful converged review candidate + source-pinned next-worker documentation, NOT a certification. **ONE URAI GENESIS PRODUCTION HOLD.**
