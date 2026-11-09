# ONE URAI GENESIS — R970 19-repository refresh, Firebase Rules authority and CI reconciliation

**Observed:** 2026-11-09 · America/Chicago  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository:** LifeLoggerAI/urai-jobs  
**Documentation branch:** docs/genesis-jobs-firebase-forensics-20261109  
**Forensic PR:** Jobs #379 (open/draft/unmerged; R969 pre-write head f2881302c593c9e152a63560b3e992627c22de73; refresh again after R970 writes).  
**Scope:** fresh 19-main ref readback; current C1 Rules candidates and source topology; federated project alias/Rules publisher reconciliation; exact candidate ancestry; GitHub Actions run/job/step/log readback; next-worker handoff. Documentation only.

## 0. Executive determination

R970 confirms the Round 24 19-repository main SHA manifest remains current: **19/19 exact main refs unchanged**. No main ref has moved since the Round 24 baseline.

R970 adds four substantive findings:

1. **A source-verified shared Firestore Rules publisher collision exists in the configuration of Spatial, RuAi/B2Bportal and Admin.** All three select project urai-4dc1d, database (default), and each selects a different Rules file. Labs R841 independently documented this exact source-only risk. It is not evidence that a live Ruleset has already been overwritten or that a breach occurred.
2. **Privacy has no root .firebaserc on current main or the current #186 draft.** Its firebase.json points to a Firestore Rules file and a Functions codebase privacy; it does not select a Firebase project. The founder-supplied registry includes project ID urai-privacy, but that is a supplied seed, not proof of a live project or deployment mapping. Privacy #186's new guarded deploy wrapper is intentionally Functions-only. It does not publish the changed Firestore Rules file. This is safer against accidental Rules overwrite but means its Rules patch needs a separately approved, explicit deployment authority and procedure.
3. **Spatial #1964 is not a small merge candidate.** Its latest head is 1,489 commits ahead of Spatial main. Relative to its intended C1 parent #1962, it is a 13-commit stack with six changed paths, including the relevant firebase/firestore.rules patch. The exact Rules file is a bounded donor patch; the whole PR must not be treated as an isolated 13-commit or one-file change against main.
4. **Current Actions failures are still inconclusive.** Fresh Privacy #186, Spatial #1964 and Jobs #390/#391 run metadata reports completed/failure. Jobs #391 also has the Callable emulator E2E skipped. The sampled job summaries have steps:null; direct logs returned BlobNotFound. We cannot classify these as application assertion failures or passes.

R970 did not clone or check out repositories, install dependencies, run tests/builds/emulators, access Firebase/GCP provider APIs, inspect effective IAM or deployed Rules, dispatch CI, merge, deploy, mutate provider resources, access user data or private media, or use paid compute.

## 1. Fresh all-repository main ref readback

All 19 API git/ref/heads/main reads returned commit objects. Every exact SHA matches the Round 24 manifest.

| # | Repository | Current main SHA |
|---:|---|---|
| 1 | UrAi | 8cac3ba513830c11261d57bc2b5dd7ad8b83e85a |
| 2 | UrAi-Dev | 08257158e2ffee8bbeb183ae89185f1677bad1da |
| 3 | UrAiProd | d3d7ce6e607a5ee1be2c9f9ede6eecf1cfb393b9 |
| 4 | urai-spatial | da94837c2457b0a7590e26a7a644cd728de8afb8 |
| 5 | urai-privacy | 1163d6f32a123ef9a6638e092a3eee5ec4a3b317 |
| 6 | urai-jobs | 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1 |
| 7 | urai-studio | 854477d80b1a7aa718edb60d1ed4c1cf22dbed9d |
| 8 | urai-staging | bda659ad23590b39e7f32de349f8a3723455ce02 |
| 9 | urai-admin | 1cde00e69238f6a32237af2d1914a1b77339d5bc |
| 10 | urai-analytics | a6e98090843301ad4f377c1cd8a840edfe517c8c |
| 11 | urai-marketing | b421ab5ca2c4a76a1b63e7c8d43996cf7a764354 |
| 12 | urai-investors | 1c248838072a2ada4da52d943b10c933a5016a26 |
| 13 | urai-labs-llc | 2359d7e33df837dd4c4279ce444cfc8750c05c8b |
| 14 | asset-factory | a49f611ade29a1754787701ab4bf915c85c0cdc6 |
| 15 | urai-content | 988ca4f7f38b1ce86e4d3f426361b5866fd23e0d |
| 16 | urai-foundation | 8ee8036b649ae9c9e73ae374a7247f0bb34c4c03 |
| 17 | urai-communications | 40cd2f4b6d422734869486a49cddac9e103a58f1 |
| 18 | B2Bportal | 4aea8574970d28a293f921a34156c4cc5a971213 |
| 19 | urai-storytime | 73f586a0a2931961ae221af7cfc0caf1b6aef39d |

Coverage limit: these are branch-ref observations, not full byte rehashes, all-branch census, build/test, protected governance, provider inventory or release certification.

## 2. Fresh source topology: Privacy and Spatial C1

### 2.1 Current exact refs and Rules blobs

| Lane | Commit/head | Rules blob |
|---|---|---|
| Privacy main | 1163d6f32a123ef9a6638e092a3eee5ec4a3b317 | 7c0051eb6d148791198127e625c99973abdc49c1 |
| Privacy #186 | 2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc | 295e5d27623cceddec8245759ff28128b17be28c |
| Spatial main | da94837c2457b0a7590e26a7a644cd728de8afb8 | 26330636a18a3675da049aa4bdadb34c82293882 |
| Spatial #1962 | da2ee1ff6eed5b5cf0c8f3b762214fdb57c07c11 | C1 bridge parent |
| Spatial #1964 | e3347d0e1ee57eaabafcfd50e2b033f7476aecf8 | 8b015a8bbe123bb7857bff5d98ba5a153067c41c |

### 2.2 Privacy #186 ancestry and actual change surface

Privacy #186 metadata: open, draft, unmerged; base is Privacy main at 1163d6f. Git compare reports 12 commits ahead / 0 behind from main. Its complete changed-file list is six paths:

- firestore.rules
- package.json
- scripts/guarded-firebase-deploy.mjs
- scripts/guarded-firebase-deploy.test.mjs
- scripts/validate-rules.mjs
- tests/rules/firestore.rules.test.ts

The Rules patch tightens deletion tombstone semantics, binds embedded profile identity, protects the ten-field server-owned profile union, and adds rule validator/emulator test source.

### 2.3 Spatial #1964 ancestry — important supersession warning

Spatial #1964 latest head e3347d0e1ee57eaabafcfd50e2b033f7476aecf8 has a base at Spatial #1962 head da2ee1ff6eed5b5cf0c8f3b762214fdb57c07c11.

- Compare #1964 against #1962: 13 commits ahead / 0 behind, six changed paths.
- Compare #1964 against Spatial main: 1,489 commits ahead / 0 behind, many hundreds of file changes in the compare response.

The six-path #1964-to-#1962 stack is:
1. .github/workflows/first-private-memory-emulator.yml
2. firebase/firestore.rules
3. tests/firestore.privacyConsent.rules.static.test.mjs
4. tests/firestore.userAuthority.rules.test.mjs
5. urai-tier1/src/lib/privacy/canonicalMemoryConsentClient.ts
6. urai-tier1/tests/canonical-memory-consent-expiry.test.mjs

The relevant Rules repair is one file in this stack. It adds strict root deletion-tombstone / planning-lease fencing, embedded owner identity, ten protected profile fields using affectedKeys and the owner-only first-time C1 read. But the complete PR also changes the C1 client expiry timer, adds expiry tests and modifies a workflow. Do not cherry-pick the whole #1964 stack or retarget the full PR to main without a full ancestry and product/runtime review.

### 2.4 C1 Rules source mismatch remains real

Spatial #1964 introduces owner-only get behavior for consentRecords/{uid}_memory_storage:
- a missing document can be returned as missing to the same owner;
- a present record must match the authenticated UID, memory.storage, C1, policy 1.0.0;
- list and all client writes remain denied.

Privacy main's generic consentRecords read rule requires an existing document's UID or admin and does not express the same missing-first-consent read path. Privacy #186 strengthens shared owner profile rules but does not add that Spatial-specific C1 get rule in its visible patch.

This is a deliberate cross-service contract requirement to reconcile, not a reason to deploy one full service Ruleset over another.

## 3. R970 newly refreshed Firebase project / deploy topology

### 3.1 Spatial, RuAi and Admin share the same source-selected project

Fresh exact current-main files:

| Repository | .firebaserc blob | Alias | firebase.json blob | Rules path |
|---|---|---|---|---|
| Spatial | 0d4fc68d65f23254829cc0502621a6ffe2215788 | spatial / urai-spatial → urai-4dc1d | 2466dd32ddb52c672f9d6700cf1470c451c55b7c | firebase/firestore.rules |
| Admin | 48b58a1e42c3554ead35cba801e980f0afdeaf2f | default / admin → urai-4dc1d | 9cdb6bfa298c46376fbdd1b1604df5b530ccd39b | firestore.rules |
| B2Bportal | ea4ae23452b00fea090b411114cfd164200205fd | default → urai-4dc1d | f93da458dc32acd6b4217a24f0d2db902deb086a | firestore.rules |

Each Firebase configuration defines a different Rules source for Firestore database (default). This precisely corroborates the pre-existing Labs R841 source-authority report PR #261, not just the earlier R909 summary.

Labs R841 report blob: 9ac2a9d99f4c1ef1c09ea93b74ffcad1a1950e59. Its companion source snapshot blob: 1853988ffbbe6b0689f36dcb46d55f3bebe84e45. R841 classifies this as a credible source-level policy overwrite/service-breakage risk, NOT actual deployed overwrite or breach. R841 requires read-only live project/effective Rules verification, one accountable authority or approved database separation, combined owner/tenant/consent/revocation tests, IAM/source/rollback readback, independent review and Founder GO.

PR #261 is a review-only draft. Its original test/guard cannot certify current provider authority by itself.

### 3.2 Privacy root has no project alias, and its new deploy wrapper is Functions-only

Fresh readback:
- urai-privacy main has no root .firebaserc (GitHub contents API 404 at exact current main).
- Privacy firebase.json blob: 04a0a54c96abde147a61ab800d924a8c56130109.
- It defines Firestore Rules path firestore.rules, Storage Rules path storage.rules, Functions source functions, codebase privacy, runtime Node 22.
- The 23-project source registry includes supplied ID urai-privacy; it has no main root alias repository mapping. The supplied ID is not proof the project exists under the current account, is the deploy target, or hosts this source.

Privacy #186's added scripts/guarded-firebase-deploy.mjs builds a provider command with --only functions:privacy, an explicit --project, an approved project env value, exact approved commit SHA and clean working tree. It rejects caller-supplied scope flags. Its own comment says it avoids accidentally replacing Spatial-owned Firestore/Storage Rules.

**Important deployment consequence:** the #186 source patch changes firestore.rules, but its new guarded package deploy path only deploys Privacy Functions. The source-level Rules changes are therefore not deployed by that wrapper. That is a good guard against accidental shared Rules mutation, but a separate reviewed Rules deployment process, explicit approved project mapping and live authority proof are required before anyone can claim the Privacy Rules fix is active.

Do not infer project isolation from the urai-privacy seed ID or deploy to it without owner-authorized provider verification. No root .firebaserc also does not prove the service is inactive or has no nested/deployment-environment config.

### 3.3 Other relevant source targets

- Labs R909 source registry lists 23 founder-supplied Firebase project IDs; zero provider projects were live audited.
- R909 source matrix reports urai-4dc1d aliases in Spatial, Admin and B2Bportal. It flags other distinct source mapping risks. Source config does not show effective deployed Rules/IAM.
- Labs #284 current metadata readback: open/draft/unmerged, head 6e1f9c8ae8ac2d80835da008d46cf1d6d089ef23. This is the source-only 23-project / 19-repository configuration audit; its historical receipts remain separately scoped.
- A prior R919 owner-reported urai-staging provider readout from Nov 1 reported broad Editor on a Compute identity and a historical Storage Rules digest discrepancy. R919 explicitly labels it historical documentary/provider evidence, not live state as of Nov 9. Do not extrapolate to current urai-4dc1d or any other project.

## 4. Fresh CI run/job/step/log readback

R970 queried current workflow run metadata for the exact reviewed candidate commits.

### Privacy #186 head 2d0c7b6...
Eight sampled PR workflow runs returned completed/failure conclusions. The selected Release Verification job 125760642477 completed with failure but its job step summary returned steps: null. Downloading the raw job log returned HTTP 404 BlobNotFound.

### Spatial #1964 head e3347d0...
Twelve sampled PR workflow runs returned completed/failure conclusions. The selected RFINAL First Private Memory emulator job 125757056379 completed with failure but its job step summary returned steps: null; raw job log returned 404 BlobNotFound.

### Jobs #390 and #391
Both heads have nine sampled workflow runs with completed/failure conclusions. For Jobs #391, sampled Runtime job 129095052403 has steps: null and its Callable emulator E2E job 129095074327 was skipped. Raw runtime job log returned HTTP 404 BlobNotFound. The Jobs #390 runtime job has the same inconclusive log/step limitation in the previous forensic receipt.

**Interpretation:** GitHub confirms workflow conclusion failure and the specific skipped emulator E2E. It does not give usable step logs for the sampled failed jobs. No source-level cause is established. Do not say native emulator or application tests executed and failed; equally, do not call CI green.

## 5. Current source/review graph for R970

| PR | Latest observed head | State / note |
|---|---|---|
| Labs #261 federated Rules publisher HOLD | 2980ca804fe04c37256a00af6e291a79a05004e4 | Open/draft; source-authority guard/documentation |
| Labs #284 Firebase source audit | 6e1f9c8ae8ac2d80835da008d46cf1d6d089ef23 | Open/draft; 23 source IDs / 19 repo config |
| Privacy #183 Life Movie scope donor | 389aa638f99a6394b46be335ee0465168a7a1a4c | Open/draft; scoped verifier source |
| Privacy #186 shared profile / deletion Rules | 2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc | Open/draft; 12 commits ahead of Privacy main |
| Privacy #214 R647 dispatcher | cc0692053db3b1b8df8267d43856b1a3357de8a0 | Open/draft; prepared, not deployed |
| Privacy #224 R818 runner | f9e7786854f7ec70cab9a6e22d2c90ad95b834ed | Open/draft; denial-only |
| Privacy #232 R836 runner | e1e2dee63c39590d343d727aa53618ac97a52691 | Open/draft; exact-head full native run not accepted |
| Spatial #1962 C1 bridge | da2ee1ff6eed5b5cf0c8f3b762214fdb57c07c11 | Open/draft |
| Spatial #1964 Rules / C1 expiry stack | e3347d0e1ee57eaabafcfd50e2b033f7476aecf8 | Open/draft; 1,489 commits ahead of main; 13 commits over #1962 |
| Studio #201 | a6187abfd12ffc8f534ddf66246da91ed032e1dc | Open/draft; R931 |
| Jobs #390 | e8ba07fc26f154169f2e065d9aa65e77014635d2 | Open/draft; producer → Jobs Zod |
| Jobs #391 | 9f5759f072370fbd42a82560ff6c5d4f37169c6b | Open/draft; test regex correction |
| Jobs #379 | Refresh after R970 doc writes | Open/draft; forensic handoff |

All heads must be refreshed again before code changes or tests.

## 6. Provider/tool-access truth

The tool inventory in this R970 session contains GitHub connector functions but no callable Firebase, Firestore, Google Cloud, IAM, Cloud Run or Storage provider resource actions. The previous R919 audit similarly reported zero live Firebase project reads in its environment and required owner-controlled, authenticated Cloud Shell.

R970 could read source configuration, not provider reality. Therefore these remain UNKNOWN/NOT RUN:
- actual project existence and project numbers for all 23 registry seeds;
- current effective Firestore/Storage Rules and database identity;
- Firebase/GCP IAM and inherited ancestor roles;
- Functions and Cloud Run deployed revisions, images/digests, runtime service identities, ingress and secrets metadata;
- installed indexes, buckets, object versions and soft-delete state;
- live project/billing status and backups;
- actual current Rules publisher and whether any source Rules have been published.

Do not launch browser authorization into Cloud Shell or reuse an old browser session to fill this gap. Use an owner-controlled authenticated CLI session following the already documented R915 read-only project collector and R919 authorization cautions. Only redacted identifiers/metadata and timestamps should enter the ledger; never export secrets or user records.

## 7. R970 execution record

| Operation | Status |
|---|---|
| 19 GitHub main ref reads | 19/19 fetched; all match Round 24 |
| Privacy #186 / Spatial #1962/#1964 PR metadata and ancestry | Read / compared |
| Privacy #186, Spatial #1964 Rules source | Read / blob-pinned |
| Spatial/Admin/B2Bportal current .firebaserc + firebase.json | Read / blob-pinned |
| Privacy .firebaserc | Not present at root (exact-main contents 404) |
| Privacy current firebase.json | Read / blob-pinned |
| Labs #261 and #284 | Metadata and R841/R909 source evidence read |
| Privacy #186 / Spatial #1964 / Jobs #390/#391 Actions | Run metadata, sampled jobs and steps read |
| Sampled raw job logs | BlobNotFound 404 |
| Git clone/checkout | NOT RUN in R970 |
| Unit/native tests, installs, typecheck, build | NOT RUN |
| Firebase emulators | NOT RUN |
| Firebase/GCP provider inventory / effective Rules/IAM | NOT RUN |
| Merge / deploy / CI dispatch / provider mutation / private media | NOT PERFORMED |
| Paid compute | NOT USED |

## 8. R971 execution order

1. Refresh all 19 main refs and all candidate PR heads, including Labs #261/#284, Privacy #183/#186/#214/#224/#232/#253–#256, Spatial #1962/#1964, Admin/B2Bportal and Jobs #371/#390/#391/#379.
2. Obtain owner-authorized, read-only Firebase/GCP project inventory. Verify actual project numbers, database identities and resource/Rules publisher ownership. Use exact approved project IDs. Do not infer project existence or deployment from seed lists and .firebaserc alone.
3. Prioritize urai-4dc1d: inspect effective deployed Firestore Rules and their release identifiers; identify actual deploy IAM principals for Spatial, B2Bportal and Admin. Compare to all three current source Rules files and Functions namespaces. Do not publish a combined Rules file until accountable authority and target scope are approved.
4. Confirm whether Privacy is intended to deploy into a dedicated urai-privacy project, a shared project, or another project. Obtain explicit owner decision and provider source/runtime evidence. Keep Privacy #186 Functions-only wrapper as a hard limit; do not add Rules scope without a separate approved process.
5. Build a collection/action/field policy matrix across Privacy, Spatial, B2Bportal and Admin, including first-time C1 get, existing C1 record UID/purpose/tier/policy, user profile uid/userId/ownerId, ten protected fields, tombstone/lease semantics and admin/founder authority.
6. Extract and review Spatial #1964's six-path / 13-commit diff against #1962. Decide whether to port just reviewed policy/test/client pieces into a clean current-main branch; no wholesale merge of the 1,489-commit-ahead stack.
7. Run exact-head local/native rules tests on a connected clean host. Include test cases for first-time C1 missing read; owner/cross-owner existing record; wrong UID/purpose/tier/policy; profile identity forgery; add/remove/change of all ten protected fields; malformed/active tombstones and each planning lease marker; valid inactive tombstone; server/admin exception boundaries. Capture full command, dependency versions, raw TAP/log, source SHA/tree/blob, exit code.
8. Establish protected CI and independent review; obtain usable job logs or reproduce on protected runner. A steps:null, skipped E2E, startup failure or BlobNotFound is not a test verdict.
9. Preserve R647, Jobs #371 and R818/R836 as separate paths; recover exact #371 module provenance or write a clearly new harness; resolve R20/v3 event digest and ACK design with Privacy/legal/security.
10. Complete Jobs #252 real nonproduction GCS stale/alternate writer 403, in-flight upload drain, exact-generation deletion, final absence and durable purge acknowledgement. Then same-SHA C6 grant → private render → protected Replay → revoke → physical purge.
11. Complete devices/accessibility/AAA visuals, legal/store/billing/backups, rollback, independent certification and explicit Founder GO.

## 9. Hard boundaries

**NO MERGE / NO DEPLOY / NO DISPATCH / NO C6 ENABLEMENT / NO PRIVATE MEDIA / NO IAM OR RULES MUTATION / NO BILLING ACTION / NO PAID COMPUTE / NO PRODUCTION GO.**

The next Chalk must preserve original LifeLogger → LifeOS → UrAi → RuAi source and history, distinguish source intent from provider reality, and never use one repo's entire Ruleset to overwrite another service's policy.

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
