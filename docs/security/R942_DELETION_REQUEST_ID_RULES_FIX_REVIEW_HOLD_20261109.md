# ONE URAI GENESIS — R942 Jobs Rules owner-deletion binding correction / HOLD

**2026-11-09 UTC | REVIEW ONLY | NO-GO / PRODUCTION HOLD**  
**Zero incremental cost.** No paid browser, cloud/RunPod compute, real media, live GCP/Firebase metadata, Auth access, production changes, service/IAM policy changes, or peer branch rewrite.

## 1. Precise lineage

- Genesis master registry: [Labs draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262).
- Earlier complete source-only Firebase audit: [Jobs draft #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) R941 continuation.
- Source-confirmed deletion request binding issue: [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380).
- Original R940 donor [Jobs draft #378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) exact source HEAD **`5881a650230c55245c87a001c58f3ebc6835196b`**. Source-only immutable review branch `review/chalk-r942-jobs-owner-deletion-binding-rules-20261109` was created from that HEAD. Draft #378, #374, #371, main and #379 were not rewritten.
- Main is still `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, lacking the broader R940 Rules candidate. This PR is intended for review against the R940 donor, **not direct production deployment**.

## 2. Exact deficiency and correction

The R940 source Rules `firestore.rules` original blob `cfa77a8fa5e69327ab352b31450c59a036d21e38` self-user update guard uses `request.resource.data.diff(resource.data).affectedKeys().hasAny([...])` to block client creation/update/removal of server-owned identity and consent/deletion fields, but omitted **`dataRightsDeletionRequestId`**. Existing `functions/src/privacy/dataRightsExecution.ts` blob `756547684397788d8051acace70ac0e5c03e2e17` writes that server-owned request ID and checks it in the owner-specific DELETE fence (`dataRightsDeletionRequestId === parsed.data.requestId`). An authenticated owner should not be allowed to alter the server's request binding.

**Minimal change:** add `'dataRightsDeletionRequestId'` to the protected `affectedKeys` field set. Preserve existing five legacy field comparisons, all server authority conditions and normal owner displayName update behavior; do not permit privileged client writes or modify the backend deletion handler.

## 3. Exactly four original-source changes

| Path | Original blob | New original Git blob after independent readback | Change |
| --- | --- | --- | --- |
| `firestore.rules` | `cfa77a8fa5e69327ab352b31450c59a036d21e38` | `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` | Protect `dataRightsDeletionRequestId` |
| `scripts/owner_authority_rules.static.test.mjs` | `3c1dcedbdb5d988da32e85a8e06241bc0bda8bb2` | `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75` | Add binding ID to exact authority-field assertion and mutation guard |
| `scripts/user_authority_rules.firebase-emulator.test.mjs` | `c46a1628a1c5a6deb246c5f45ee114d7046b27be` | `95f4b72b1d7260a191b0cdc77c5cf008b57011e0` | Seed real synthetic owner's deletion ID; authenticated owner client REST mutation and removal DENY; legacy missing-field client addition DENY |
| `scripts/run-r879-unified-native-acceptance.sh` | `5cb8dfdec3207c9732d59bcb13dc8df87a2a7c26` | `0f93e70eb601057a082cf4a7a5dade26807a5868` | Retain original strict blob pins; update only changed Rules/static hashes and add exact native test hash check |

No application code, IAM, GCS, Storage Rules, live deployments, Firebase flags, customer data, other worker branches or older test results have been changed.

## 4. Verification actually performed in this worker

**15/15 focused static verification predicates PASS**, evaluated on GitHub-returned bytes of all four changed files (not a run of the original Node tests):

1. Four changed files independently returned by GitHub on the new branch.
2. Rules protected list equals static test trusted list.
3. Rules list equals the complete 12-field audited server-owned set.
4. No duplicate protected field.
5. Exact deletion-request ID protected.
6. `affectedKeys` preserved (not `changedKeys`).
7. Native test uses authenticated Firebase ID token Firestore REST.
8. Native existing owner fixture has persisted original binding.
9. Owner mutation test exists.
10. Legacy-add mutation test exists.
11. Native test source hash pins match.
12. Rules source hash pins match.
13. Static test source hash pins match.
14. Unified runner contains no `firebase deploy`.
15. No modifications to original main branch.

**IMPORTANT**: This is source-alignment/static checking. It is **not** an executed `node --test`, Firestore/Auth emulator assertion, native 4-emulator acceptance, root 76-command suite, production Rules readback or independent signoff. The available container has Node 22.16.0, Java 21, git, but GitHub DNS resolution fails, pnpm/firebase are absent, and no original full checkout/dependencies were available. Do not claim a real emulator pass, even though the native test is authored to use client ID-token REST and a disposable project.

## 5. Known additional tests and native-release blockers

- Before merging, independently run the actual original static test `node --test scripts/owner_authority_rules.static.test.mjs`; it must verify original expected field set, add/remove, no weakening of client ACL. The full authenticated test `scripts/user_authority_rules.firebase-emulator.test.mjs` must run under the existing guarded **demo-urai-jobs** Auth/Firestore/Functions/Storage native harness. Require real ID-token REST 403 results, Admin readback unchanged and normal displayName update 200.
- Full original release verification must pass at **one immutable head** with `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`, and guarded R879/R854 four-emulator suite in a credential-free, source-pinned, disposable environment.
- Original R940 positive idempotency fixture `longform_plan_not_found` (13/14) remains independently unresolved. This branch inherits it unchanged. Repair separately with an actual owner/org-bound stored plan fixture and missing-plan no-write negative.
- The owner-field `dataRightsDeletionRequestId` should be investigated in the broader Privacy/Jobs data-rights lineage. Restricting client update must not obstruct Admin/service write under actual deployed IAM and properly authorized DELETE.
- The current guard remains a **denylist of authority fields**, not a fully enumerated positive allowlist. Review other unrecognized future owner authority fields before general release. Decide whether all remaining profile fields should be explicitly allowlisted, avoiding unforeseen client authority changes.
- Existing [Jobs P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) remains open: this Rules fix does NOT stop stale/privileged GCS uploads. Independently establish storage IAM 403, in-flight drain and exact-generation deletion ACK before releasing media. Signed C6 authorization → Studio → Jobs → owner-only Spatial Replay → revoke/delete and downstream purge ACK is **NOT CERTIFIED**.
- GitHub Actions host jobs have recently reported failure without recorded execution steps; don't classify as source test failures without actual job output. Protected CI, eligible independent reviewer and source-to-deployed-revision certification remain missing.

## 6. Exact safe command sequence (NOT RUN)

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r942-review
cd jobs-r942-review
git fetch origin
git checkout <FULL_IMMUTABLE_R942_PR_HEAD_SHA_FROM_GITHUB>
test "$(git rev-parse HEAD)" = "<FULL_IMMUTABLE_R942_PR_HEAD_SHA_FROM_GITHUB>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version                       # Node 22 required
pnpm --version                       # pnpm 8.15.9 required
node --test scripts/owner_authority_rules.static.test.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

Review the original runner and scrub all credential, production project/bucket and `.env` settings before emulator invocation. The runner itself fails closed on unexpected inherited credentials/config, and checks Git blob identity. Do not weaken it or run the emulators against the actual project.

## 7. Next Chalk takeover

1. Re-fetch this isolated branch HEAD and [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380); compare with any other workers' later Rules patches before merging.
2. Run the exact static and native emulator test. Preserve exit codes, SHA256 logs, identity/Rules source provenance and relevant 403/200 status for both existing and missing legacy fields.
3. Independently review and merge only when correct release controls exist. Never deploy or turn on private processing on the strength of the source-only static 15/15.
4. Keep all cloud provider resources, other Jobs/Privacy/Studio/Spatial review branches, credential/billing configuration and user private data untouched.
5. **PRODUCTION HOLD / NO-GO.**
