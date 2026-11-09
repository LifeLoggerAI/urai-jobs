# ONE URAI GENESIS — R972 Source-Authority Verification and Release-Hold Handoff

**Checkpoint:** R972 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Read-only GitHub source/config/PR/issue verification after R971. Documentation only. No tests, builds, emulators, CI dispatch, provider reads, deploys, Rules/IAM changes, real jobs or private media.

## 0. Executive findings

R972 adds fresh exact-source readback to R971 and tightens the handoff in five ways:

1. **Shared Firestore target is source-confirmed:** Spatial, Admin and B2Bportal each map a Firebase alias to `urai-4dc1d`, and their `firebase.json` files each declare a Firestore Rules path. The source indicates all three can select the same `(default)` database target while carrying different Rules source files. This is a competing publisher configuration risk; no provider-native read proves what Rules are currently deployed or who deployed them.
2. **Privacy #186 remains Functions-only for deployment:** Privacy main `firebase.json` declares Firestore and Storage Rules, but Privacy has no root `.firebaserc` in the inspected main ref. The #186 guarded deploy script is intentionally scoped to `functions:privacy`; it does not publish the changed Rules file. Actual project/region mapping and deployed Rules remain unknown.
3. **Jobs #380 remains a source-level profile Rules defect:** the current Jobs main `firestore.rules` lacks a complete protected server-owned profile field set, including `dataRightsDeletionRequestId`. The exact Rules file at Jobs #378 head is inherited from its base and is not in #378's seven-path PR diff. Therefore #378 is not a Rules repair.
4. **The PR graph is unchanged in the important review paths:** Jobs #378/#389/#390/#391, Privacy #186 and Spatial #1964 remain open/draft/unmerged. Jobs #379 and Labs #304 remain the documentation relay.
5. **The core release blockers remain open:** Jobs #252/#345/#376/#380 and Privacy #83. Production stays HOLD.

## 1. Exact refreshed current refs and PRs

### Main refs
- Jobs main: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`; tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; branch API says `protected=false`, protection disabled, required checks off.
- Privacy main: `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`; branch API says `protected=false`.
- Spatial main: `da94837c2457b0a7590e26a7a644cd728de8afb8`; branch API says `protected=false`.

### Key pull requests
| PR | Head SHA | Status |
|---|---|---|
| Jobs #378 R940 test review | `5881a650230c55245c87a001c58f3ebc6835196b` | Open, draft, unmerged |
| Jobs #379 forensic docs | `ca7f88f4c7f47b9a200f70e86184f03792ca26b2` at R972 start | Open, draft, unmerged |
| Jobs #389 auth gate | `b865209cc352241602d8b9714672f3401aed7669` | Open, draft, unmerged |
| Jobs #390 producer→Jobs Zod | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open, draft, unmerged |
| Jobs #391 regex correction | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Open, draft, unmerged |
| Labs #261 federated Rules source audit | `2980ca804fe04c37256a00af6e291a79a05004e4` | Open, draft, unmerged |
| Labs #284 Firebase source registry | `6e1f9c8ae8ac2d80835da008d46cf1d6d089ef23` | Open, draft, unmerged |
| Labs #304 Genesis continuity | `3eacfc21688eae7ad33eeb6aa162c2c6952a376a` | Open, draft, unmerged |
| Privacy #186 Rules / guarded deploy | `2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc` | Open, draft, unmerged |
| Spatial #1964 C1 Rules/expiry stack | `e3347d0e1ee57eaabafcfd50e2b033f7476aecf8` | Open, draft, unmerged |

These are snapshots. Refresh all heads before changes.

## 2. Direct current-source verification: Spatial, Admin, B2Bportal

The following files were fetched from the exact current main SHAs, not inferred from prior summaries.

### Spatial main
Repository: `LifeLoggerAI/urai-spatial`  
Main: `da94837c2457b0a7590e26a7a644cd728de8afb8`
- `.firebaserc` blob `0d4fc68d65f23254829cc0502621a6ffe2215788`: aliases `spatial` and `urai-spatial` both map to `urai-4dc1d`.
- `firebase.json` blob `2466dd32ddb52c672f9d6700cf1470c451c55b7c`: Firestore Rules path `firebase/firestore.rules`; Functions source `apps/functions`, codebase `urai-spatial-functions`; Storage Rules path `firebase/storage.rules`.
- `firebase/firestore.rules` blob `26330636a18a3675da049aa4bdadb34c82293882`.

### Admin main
Repository: `LifeLoggerAI/urai-admin`  
Main: `1cde00e69238f6a32237af2d1914a1b77339d5bc`
- `.firebaserc` blob `48b58a1e42c3554ead35cba801e980f0afdeaf2f`: aliases `default` and `admin` map to `urai-4dc1d`.
- `firebase.json` blob `9cdb6bfa298c46376fbdd1b1604df5b530ccd39b`: Firestore Rules path `firestore.rules`; Functions source `functions`, codebase `default`.
- `firestore.rules` blob `1b9926316d2c5f5911bbbd52b000967f5e935030`.

### B2Bportal main
Repository: `LifeLoggerAI/B2Bportal`  
Main: `4aea8574970d28a293f921a34156c4cc5a971213`
- `.firebaserc` blob `ea4ae23452b00fea090b411114cfd164200205fd`: `default` maps to `urai-4dc1d`.
- `firebase.json` blob `f93da458dc32acd6b4217a24f0d2db902deb086a`: Firestore Rules path `firestore.rules`; Storage Rules path `storage.rules`; Functions source `functions`; Hosting target `urai-b2bportal-production`.
- `firestore.rules` blob `b17ec9f4ef896870722905a279ac0d8206fcf24a`.

All three declare a Firestore Rules source for the same alias target. This is the direct source-level collision. The exact Rules blobs differ. It is a credible configuration collision/policy overwrite/service breakage risk if independent workflows publish to the same actual Firebase project/database.

**Not established:** actual Firebase project number/account, actual default database resource identity, whether these Rules files have been published, which release is active, which principal can publish, latest provider release identifiers/etags, or whether the repositories deploy separately with explicit project overrides. Source config is not provider readback.

Labs #261 remains the source-only governance detector/ledger. Its eight test declarations were not run in this pass.

## 3. Privacy project and deployment boundary

Privacy main:
- SHA `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`.
- Root `.firebaserc`: not found at exact inspected main ref.
- `firebase.json` blob `04a0a54c96abde147a61ab800d924a8c56130109`.
- Firestore Rules path `firestore.rules`, Storage Rules path `storage.rules`, Functions source `functions`, codebase `privacy`, runtime Node 22.

Privacy #186:
- Head `2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc`.
- Changed files include `firestore.rules`, `package.json`, `scripts/guarded-firebase-deploy.mjs`, deployment test, validator and Rules tests.
- Guarded deploy wrapper scope is `functions:privacy`, requires explicit project/env/SHA/clean-tree checks and rejects caller scope overrides.

Thus Privacy #186's changed Firestore Rules are not published by its own guarded Functions deployment path. This is a safety boundary, not a completed Rules deployment. Actual project ID, number, region and effective Rules are unknown.

Do not create or guess a root `.firebaserc`, add Rules to the deploy wrapper or invoke Firebase deployment until the owner/admin identifies the real project/database and approves one Rules publisher.

## 4. Jobs #380 and PR #378: precise field-protection status

Issue #380 remains OPEN.

### Jobs main
- Main SHA `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- Main Rules blob `7dc63626c6e1a2e7b20ded280ea2dd070f16abc9`.
- The inspected self-update predicate does not protect the complete server-owned field set; `dataRightsDeletionRequestId` is absent.

### Jobs #378
- Head `5881a650230c55245c87a001c58f3ebc6835196b`.
- Current changed-file list is exactly seven files:
  1. `docs/security/R940_NEXT_CHALK_ORIGINAL_SOURCE_TEST_RECONCILIATION_HOLD.md`
  2. `scripts/life-movies-consent-gate-smoke.mjs`
  3. `scripts/life-movies-idempotency-revocation-race-contract.mjs`
  4. `scripts/life-movies-longform-resume-transaction-contract.mjs`
  5. `scripts/queue-recovery-contract.mjs`
  6. `scripts/r417-original-donor-longform-resume-transaction-contract.mjs`
  7. `scripts/urai-jobs-verify.mjs`
- `firestore.rules` is not in the PR diff.
- Rules blob at #378 head: `cfa77a8fa5e69327ab352b31450c59a036d21e38`.
- The same blob is present at the declared base branch `review/chalk-r924-original-studio-transaction-fixture-repair-20261108`.
- Its affected-key protected list includes several lifecycle/security fields but omits `dataRightsDeletionRequestId`.

**Conclusion:** #378 is test/verification fixture work. It is not a Rules repair and does not close #380. No live Rules engine evaluation was executed in R972.

Required source repair must be a separate review change with:
- a complete server-owned profile field matrix agreed by Jobs/Privacy/Studio/Spatial owners;
- explicit protection for add/change/remove of `dataRightsDeletionRequestId`, tenant identity, account status, deletion flags, central privacy fence, role, permissions and rate-limit fields as applicable;
- authenticated native Firestore Rules emulator tests for every changed field;
- safe owner profile-edit regression tests;
- server/service/admin authority boundaries;
- deployed Rules release readback after separately authorized deployment.

## 5. Current release issue states

Fresh R972 issue readback:
- Jobs #252 — OPEN, P0: durable post-revocation write fence, stale/alternate writer denial, upload drain and physical purge ACK.
- Jobs #376 — OPEN, P1: durable authority/continuation policy after post-admission operator revocation.
- Jobs #380 — OPEN, P1: server-owned profile field binding, including `dataRightsDeletionRequestId`.
- Jobs #345 — OPEN, P2: concurrent createJob quota admission against original transaction.
- Privacy #83 — OPEN: canonical consent/revocation source exists; protected deployed runtime, downstream ACK and provider-call suppression remain unproven.

No issue was closed or altered in R972.

## 6. CI and branch governance

Jobs main branch metadata still reports `protected=false` and required checks `off`. Privacy and Spatial main branch metadata also report `protected=false` in the connector readback. This does not settle any inaccessible organization-level/inherited policy; effective governance is NOT CERTIFIED.

Previously inspected candidate workflow runs for Privacy #186, Spatial #1964 and Jobs #390/#391 concluded failure, but sampled job steps were null/empty and raw log fetches returned BlobNotFound 404. Do not report application test assertion failure or success. R972 did not rerun CI.

## 7. R972 execution ledger

Performed:
- Refreshed Jobs forensic PR #379, engineering PR #389, Labs #304, Privacy #186, Spatial #1964 and main branch metadata.
- Re-fetched exact current source files for .firebaserc, firebase.json and Firestore Rules in Spatial/Admin/B2Bportal/Privacy/Jobs.
- Verified aliases and configured Rules file paths from the raw contents.
- Verified Jobs main Rules blob and Jobs #378 head Rules blob; compared #378 changed-file inventory and base blob.
- Refreshed Jobs #252/#345/#376/#380 issue state.
- Confirmed no R972 document pre-existed at the start of the round.

Not performed:
- no local clone or checkout;
- no dependency installation;
- no source/Rules tests or R841 detector tests;
- no native Firebase emulator;
- no build or typecheck;
- no provider inventory or effective IAM/Rules read;
- no CI rerun;
- no deployment, merge, dispatch, production Rules change or private media access;
- no paid compute.

## 8. R973 exact next-worker plan

1. Read this report, R972 machine checkpoint and R973 start prompt, then R971/R970 reports.
2. Refresh main refs, branch protection, Rulesets, Jobs #378/#379/#389/#390/#391, Labs #261/#284/#304, Privacy #186, Spatial #1964, and issues #252/#345/#376/#380/#83.
3. Obtain owner-authorized read-only provider inventory for `urai-4dc1d`: real project number, default database, deployed Rules release ID/etag/source, deployment principals and Firebase CLI history. Never assume source aliases prove provider mapping.
4. Resolve accountable Rules authority: one publisher for shared default DB, or explicitly approved project/database separation. Record owner, repo, source SHA, deploy identity and rollback procedure. Do not deploy during discovery.
5. Confirm Privacy's intended actual project and region. Preserve #186 Functions-only deployment boundary; define separate Rules release approval only after project and ownership evidence.
6. Make a new isolated Jobs Rules branch for #380. Protect all server-owned fields including `dataRightsDeletionRequestId`; add signed-in Rules emulator cases for add/change/remove plus allowed owner profile fields.
7. Run Labs #261 detector and eight test cases on exact immutable head; classify as source-config-only.
8. Restore executable CI evidence: inspect runner/check logs; use a controlled, protected, review-only run only once runner allocation is understood.
9. Preserve R647, Jobs #371 and R818/R836 as distinct acceptance tracks.
10. Prove #252 on authorized nonproduction GCS: stale/alternate writer 403, in-flight/resumable upload drain, exact-generation deletion, final absence and downstream ACK.
11. Complete #376 continuation semantics, #345 concurrency, actual deployed identity/revision/IAM, rollback, protected Replay, accessibility/device/visual acceptance and founder GO.

## 9. Release decision and boundaries

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

No merge, deploy, Firebase Rules/IAM mutation, CI bypass, C1/C6 enablement, revocation dispatch, private media, customer data, paid compute or production GO is authorized by R972.

---
*R972 is an exact source/metadata reconciliation, not provider-native acceptance or security certification. All hashes and PR heads are snapshots and must be refreshed before any mutation.*
