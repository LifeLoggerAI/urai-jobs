# One UrAi Genesis — R891 exact-source convergence, REVIEW ONLY / HOLD

**Local date:** 2026-11-07 Central (Git commits 2026-11-08 UTC)  
**Repository:** LifeLoggerAI/urai-jobs  
**Convergence Git commit:** `578608d627b878b208f9331a46cbcc71bcd3842a`  
**Current reviewed code (before this evidence document):** `87a384c3340958c7af2da90c54f3baaeeae13c4b`  
**Release:** NO-GO. Never infer production authorization from source checks.

## Both original source histories are retained

A real two-parent Git commit has ordered parents:

1. Owner, revocation, private Studio long-form, queued worker and legacy-writer review **R890 PR #367** — `2cca2e75cf8ddaab6c1e40d4e0d8c39831382473`.
2. Independent server-owned atomic create quota, index, Auth/Firestore/Functions/Storage emulator harness, project isolation **peer PR #364** — `3438eb5e675923d8149bc4d9672617bb389148d7`.

GitHub comparison showed disjoint app files; overlapping **only** `package.json` and `scripts/run-r879-unified-native-acceptance.sh`. No original PR, branch, IAM policy or `main` was changed. A complete, untruncated 1,428-entry peer Git tree supplied 16 exact peer blobs, copied onto the existing owner-security tree without editing their contents. The original long-form and private-source code was not reimplemented. All original parent SHAs remain reachable.

## Exact source integration

- `createJob.ts`: peer Git blob `c52f09900bb76a1fa71445a7fceb39c177c2c568`. Current role/owner matching and idempotency logic coexist with the peer's Firestore-owned sliding quota transaction.
- `jobCreateRateLimit.ts`: peer pure source `9b7a53c41c56681dfdf4cebbc00de9a962adf5d2`.
- `firestore.indexes.json`: peer `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd` (adds missing ascending owner/createdAt migration index). `firestore.rules`: peer `cfa77a8fa5e69327ab352b31450c59a036d21e38` (server-owned quota profile field).
- `currentJobCallerAuthority.ts`: R890 original exact `b791017fcb291e8a793b2b85fa9ee37991277c9d`.
- `studioLifeMovieLongformBridge.ts`: R890 original exact `888e9645e78d1bd723df883e0a73f042143f1e03`, maintaining current owner/tenant/org cancellation and private playback preflight.
- The root `urai-jobs:verify` command includes **74 individual shell-joined commands**; exactly four peer-only suites added to the existing 70; **all command strings unique**, and 11 suites unique across the two parent lines preserved. Root package blob `0e6dcac476c8e54b3b49e0d9e3e517b49d0ae058`.
- Original authenticated demo-only four-emulator acceptance runner preserved unchanged, blob `67ae8515bd206456c8d181ff52ef173e67f65cc2`.
- Outer `run-r879-unified-native-acceptance.sh` source Git blob `5e5f4d8523dcc1607637589c2f149d5a91ddc793`, requiring original R854 seven-stage negative storage run, current owner and private-movie checks, peer quota/Firestore index/env isolation tests, R890 cancellation tests, real nine-case physical-generation broker, then peer original four-emulator authenticated Jobs current-role+quota suite, including native 14-concurrent-job admission. Explicitly uses `-u FIREBASE_PROJECT_ID -u CLOUDSDK_CORE_PROJECT` and overrides GCLOUD/GOOGLE/URAI_EMULATOR_PROJECT to nested `demo-urai-jobs`. The inner runner rejects inherited Functions .env/secret files before and after build. Outer uses isolated `urai-staging-test`, no inherited cloud credentials and a disposable HOME. Both runners require reviewed Git SHA and clean checkout.
- 11/11 targeted *connector-side static source/wiring assertions* confirmed the exact R891 branch contains 74 distinct root commands, all required stage names, pinned package SHA, both security suites, cloud-credential refusal, and demo emulator handoff. **These are not Node test passes.**

## Evidence limitations and mandatory next execution

This environment has Node v22.16, TypeScript 5.8.3 and Java, but **no pnpm 8.15.9**, no complete Jobs checkout, and `github.com`/npm registry DNS lookups fail. The latest R891 runner **has NOT passed a fresh exact-file `bash -n`, early fail-closed preflight, frozen install, Functions typecheck, root verification, original Auth+Firestore+Functions+Storage emulators, or GCS API denial test**. Earlier R890 14/14 source-mocked handler and 14/14 independent maintained cancellation tests belong to their original unchanged blobs, NOT the complete R891 native runtime. Similarly, peer PR #364 has source-reviewed quota/index/harness changes but no demonstrated native acceptance on this combined head.

Do **not** treat GitHub Actions jobs with 0 executed steps as build results.

### Ordered release gates

1. Independently fetch exact R891 source with complete Git history on a trusted no-cloud-credential runner; verify working tree clean, Node 22/pnpm 8.15.9/Java 21 and `bash -n` + refusal preflight before running.
2. Run frozen `pnpm install --frozen-lockfile`, original `pnpm urai-jobs:verify`, root `pnpm typecheck`, `pnpm build`, preserving logs, exit statuses and SHA256 on exact head.
3. Run original R854 native Auth/Firestore/Storage negative rights, write reservations, late-write replay and derivative revocation; nine-case physical-generation broker **with disposable project only**.
4. Run peer original native Auth/Firestore/Functions/Storage handler tests at demo-only project, including current operator role downgrade, owner/tenant+deletion, idempotency and 14-way quota race. Confirm actual emulator host env, project isolation and runtime test logs.
5. Separately obtain independently authorized **real GCS data-plane 403** for each retired/alternate privileged identity; prove exclusive writer IAM, pre-byte reservation, in-flight upload drain and exact-generation post-revoke deletion. Neither emulator test proves these.
6. Verify authentic signed positive C6 owner/source-rights and owner-only protected Studio→Replay, device accessibility and independent security/release review before an explicit authorized GO.

**No paid compute, production release, IAM changes, real customer media, secret extraction, render enablement, or `main` merge. P0 Storage #252 and P1 Jobs #337 remain OPEN. ONE URAI GENESIS PRODUCTION HOLD.**
