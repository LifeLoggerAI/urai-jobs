# ONE URAI GENESIS — R972 current-head reconciliation, Privacy native evidence, Firebase deploy authority and revocation protocol

**Observed:** November 9, 2026 · America/Chicago  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository:** LifeLoggerAI/urai-jobs · **Forensic PR:** #379  
**Branch:** docs/genesis-jobs-firebase-forensics-20261109  
**Scope:** fresh 19-main ref refresh; refreshed Labs/Privacy/Jobs PR graph; read-through of Labs R939/R940/R960/R961/R962 and Jobs R959–R964; exact current Privacy R27 workflow source and latest run metadata; refined Firebase Rules deployment-authority map; Jobs #380; central registry parallel consolidation candidates. Documentation/source readback only.

## 0. Executive determination

R972 supersedes the temporal pins and several conclusions in R971.

1. **All 19 repository main refs still match R958/Round 24.** R972 repeated the 19 Git ref reads. This confirms branch tips only, not a complete current source checkout or production certification.
2. **Labs master #262 advanced to aab1d7422d80c38605780ddf89ceebe891b66947.** It now includes R939 and R940 as well as R958–R962 material. It remains open/draft/unmerged. Separate #331/#332 16-file consolidations remain open drafts based on an earlier master commit; do not silently treat them as merged or canonical main.
3. **Privacy R27 has prior exact-source native evidence that R971 did not incorporate.** R939 ran application/test source at commit 6fecb46e380a6400f2ec095ef615d9ef73319032: root/Functions install, lint, typecheck, 199/199 unit tests (R27 9/9), Functions build/typecheck, static Rules and root preflight all passed. The Firebase emulator command exited 0 with 13 Rules and 3 integration assertions, but invalid-canonical-record trigger exceptions and ECONNRESET/socket-hang-up noise remain unexplained. Raw logs were not archived; only hashes were recorded, and the preflight final worktree had one uncaptured entry. This is meaningful exact-source evidence, not clean end-to-end release acceptance.
4. **Latest Privacy #257 head is a3f7119497fe1d9c6dc61e104a1da0a583d247f8.** It adds one workflow-only commit over e2193434…; compare reports 1 ahead / 0 behind and one modified path, .github/workflows/r27-scoped-consent-verification.yml. The current workflow changed Node setup to 22.23.0, resolving the earlier R940 Node 20 vs Functions Node 22 mismatch. Latest exact-head workflow run 42613095876 still concluded failure; job 129146191449 has steps:null, logs_url:null. No workflow command execution is established.
5. **The Firebase Rules conflict must be described precisely.** Spatial, Admin and B2Bportal all source-select urai-4dc1d/(default) with different Rules files; Admin and B2Bportal Rules also overlap at adminUsers/{document} and partnerAccounts/{document} with different predicates. But of the reviewed governed deployment paths, Admin can deploy Firestore Rules; Spatial's reviewed governed WIF path is Functions/Hosting only; B2Bportal's reviewed workflows do not deploy Rules. Other manual/delegated publishers remain unknown. Thus this is a confirmed source target/policy collision and a current Admin Rules-capable path, not proof that three governed workflows all publish Rules or proof of live overwrite.
6. **Jobs/Privacy revocation design has a more mature R963/R964 proposal, but it is still only design.** The R647 donor is preserved and useful but incompatible with R20; ACK digest/event identity and crash-safe retry semantics still require explicit Privacy/legal/security approval. No v3 implementation, dispatcher, ACK flow or purge has been executed.

Jobs #252 remains P0. Jobs #380 remains P1. Production remains HOLD / NO-GO.

No merge, deploy, dispatch, Rules/IAM mutation, provider inventory, media access, billing mutation, paid compute or new tests were performed in R972.

## 1. Authority and source-of-truth hierarchy

### 1.1 Labs master #262

Fresh PR metadata:
- Repository: LifeLoggerAI/urai-labs-llc.
- PR #262, branch docs/genesis-estate-registry-20261106, base main 61c48fbdf3453394571a393430458fc916a2db89.
- Latest head observed: aab1d7422d80c38605780ddf89ceebe891b66947.
- Open / draft / unmerged.

The current master branch has R958, R959, R960 and R961/R962 cross-model continuity addenda, plus R939 and R940 Privacy R27 native/workflow handoffs. Treat Labs #262 as central knowledge and worker navigation, not production source, merged default branch or release authority.

### 1.2 Concurrent consolidation PRs — preserve, do not silently merge

R972 refreshed these additional Labs review branches:

| PR | Head | Base | Changed files | Meaning |
|---|---|---|---:|---|
| #327 | ada698f86f3ec4c96797a0a37a13bdcf2f37f912 | f54bb081d07f1684b2bad7f6e7b8d97a999105e8 | 3 | Round 25 R970 full cross-service contract/governance |
| #328 | 4b6a79fcbabc88d834b28ba5673c3a3800061e27 | 0dcc6e5ddfad8662f8111f1ffe10bc8e9e9d16db | 5 | Jobs R959 ancestry / R520 reservation prototype |
| #329 | 0e09fcdf6aceac26b27d978c7421dced94de8556 | 0e408330b82dc70ddce674deb0ed36c4f04e508c | 3 | Round 25 R969 C1 Rules/cross-lineage |
| #330 | 1e9fd687ac1c21c0e9648a0d2f040bd2ca08c63f | 0e408330b82dc70ddce674deb0ed36c4f04e508c | 3 | Re-anchored R969 C1 Rules/cross-lineage |
| #331 | 0b4871d6b77b8dcc73a9d7bb448bbc02e34589d8 | 0e408330b82dc70ddce674deb0ed36c4f04e508c | 16 | Jobs R968–R971 cumulative revocation/Rules consolidation |
| #332 | 3a6376999f0c015f39cdab8555aa688f9a3de56b | 0e408330b82dc70ddce674deb0ed36c4f04e508c | 16 | Current-master consolidation sibling to #331 |
| #304 | fb53f8b1875ceb05083e095e407e78228deb9e25 | 7a12b04aecfa7091fa133c8adc9841de4bf446b6 | 21 | Jobs R944 forensic handoff |

PR #331 and #332 share the same 16 changed paths and are parallel consolidated documentation candidates based on the same older commit; #332 compares 16 ahead / 0 behind its own base. Neither is merged. Both should be compared to latest #262 head before integration. Do not copy their entire broad diffs into #262 without confirming no worker files or newer master entries are overwritten.

### 1.3 Jobs forensic PR #379

Current metadata at R972:
- Open / draft / unmerged.
- Branch docs/genesis-jobs-firebase-forensics-20261109.
- Head at refresh: 730120dbebf35df231be796a5859d3367dd35c3d.
- Base metadata still records old Jobs main SHA 9d29be1…; current Jobs main remains 2bcdbcf….

The Jobs #379 branch is a forensic evidence lane, not current Jobs main. Its base metadata predates the explicit add/revert sequence on main. Do not confuse a PR base SHA snapshot with current main.

## 2. All 19 repository main refs

R972 freshly fetched git/ref/heads/main for all 19 registered repositories. All exact SHAs match R958/Round 24.

| Repository | Current main SHA |
|---|---|
| UrAi | 8cac3ba513830c11261d57bc2b5dd7ad8b83e85a |
| UrAi-Dev | 08257158e2ffee8bbeb183ae89185f1677bad1da |
| UrAiProd | d3d7ce6e607a5ee1be2c9f9ede6eecf1cfb393b9 |
| urai-spatial | da94837c2457b0a7590e26a7a644cd728de8afb8 |
| urai-privacy | 1163d6f32a123ef9a6638e092a3eee5ec4a3b317 |
| urai-jobs | 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1 |
| urai-studio | 854477d80b1a7aa718edb60d1ed4c1cf22dbed9d |
| urai-staging | bda659ad23590b39e7f32de349f8a3723455ce02 |
| urai-admin | 1cde00e69238f6a32237af2d1914a1b77339d5bc |
| urai-analytics | a6e98090843301ad4f377c1cd8a840edfe517c8c |
| urai-marketing | b421ab5ca2c4a76a1b63e7c8d43996cf7a764354 |
| urai-investors | 1c248838072a2ada4da52d943b10c933a5016a26 |
| urai-labs-llc | 2359d7e33df837dd4c4279ce444cfc8750c05c8b |
| asset-factory | a49f611ade29a1754787701ab4bf915c85c0cdc6 |
| urai-content | 988ca4f7f38b1ce86e4d3f426361b5866fd23e0d |
| urai-foundation | 8ee8036b649ae9c9e73ae374a7247f0bb34c4c03 |
| urai-communications | 40cd2f4b6d422734869486a49cddac9e103a58f1 |
| B2Bportal | 4aea8574970d28a293f921a34156c4cc5a971213 |
| urai-storytime | 73f586a0a2931961ae221af7cfc0caf1b6aef39d |

Evidence grade: current Git ref metadata, not complete source checkout, tree/blob byte verification, branch census, build, deployed runtime or provider state.

## 3. Privacy R27 — corrected exact evidence and current workflow

### 3.1 R939 native acceptance on exact application/test source

Labs #262 contains R939 report and machine manifest:
- Report: 35_R939_PRIVACY_R27_EXACT_NATIVE_ACCEPTANCE_AND_EMULATOR_CAVEATS_20261109.md
- Manifest: manifests/R939_PRIVACY_R27_NATIVE_ACCEPTANCE_20261109.json
- Tested commit: 6fecb46e380a6400f2ec095ef615d9ef73319032
- Tree: c6bd5d94f2e71e7d267bdd2c6a49e4c98ccdccff
- Isolated CPU runner: Ubuntu 24.04, Node 22.23.0, npm 10.9.8, Java 21.0.12.1; no cloud/production credentials injected.

R939 reported:
- root and Functions npm ci: PASS;
- lint: PASS;
- root typecheck: PASS;
- unit tests: **199/199 PASS**, 20 files, including R27 9/9;
- Functions typecheck: PASS;
- Functions build: PASS;
- static Rules validator: PASS;
- Java prerequisite: PASS;
- full root npm run preflight: PASS / exit 0, including export/deletion contracts, route smoke, Privacy/Tier-One audits, Next production build and HTML QA.

These are meaningful exact source/test receipts. They apply to the application/test bytes that remain unchanged on later #257 heads. R939 did not test the new CI workflow file introduced later, did not establish deployed identity or provider state, and did not provide a clean final worktree receipt.

### 3.2 Emulator caveat is material

R939's Java-backed emulator command exited 0. It reported:
- Firestore/Storage Rules: 13/13 assertions across 2 files;
- Privacy integration smoke: 3/3 assertions.

However Functions emulator logs showed publishConsentRevocation exceptions for intentionally invalid canonical consent records, unhandled trigger termination, and ECONNRESET/socket hang-up during synthetic fixture mutations. The report requires mapping each invalid fixture write to its trigger and a clean exact-head rerun with reviewed logs.

Therefore:
- record the emulator test command as exit 0 and listed assertions passing;
- do not call the four-emulator run clean or fully certified;
- preserve the trigger-noise investigation as outstanding;
- direct callable Auth-token denial acceptance with a verified synthetic Jobs token remains separate;
- raw logs were not retained in GitHub (only hashes were printed), and root preflight ended with one uncaptured worktree entry.

### 3.3 R940/R972 workflow lineage and toolchain correction

R940 documented that commit e2193434e22983cd52ae835e6e128748dfde1dc7 added the R27 workflow only. That workflow initially used Node 20.19.0 while Functions declared Node 22.

R972 current Privacy #257 head:
- a3f7119497fe1d9c6dc61e104a1da0a583d247f8
- Base R20 #256: cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6
- Compare from prior e219343…: one commit ahead, zero behind, one modified path only: .github/workflows/r27-scoped-consent-verification.yml.
- Current workflow blob: 10b45cbdc75356adba76afdd6fd14f562c4e358a.
- Current workflow uses Node 22.23.0, correcting the prior Node-major mismatch.

Latest workflow run:
- Run 42613095876: completed/failure.
- Job r27-boundary: id 129146191449.
- Job details return steps:null, logs_url:null.
- No raw test/build results or diagnostic artifact URL were available.

All six sampled workflows on current #257 head returned completed/failure. A failed job with no step/log evidence is not an application-test failure and not a pass.

**Current R27 disposition:** app/test source is supported by R939 exact-source native results; current workflow is source-corrected to Node 22 but its run is unobservable; emulator trigger noise, direct callable identity, independent source review, real issuer and deployed runtime remain unresolved. Keep life-movie.render unregistered and callable forced-deny. No grant, render, dispatch or private output capability.

## 4. Privacy R647 → R20 → Jobs revocation — current canonical design state

### 4.1 Three revocation lineages remain distinct

A. **Jobs #371 three-case emulator harness** expects an older missing Privacy module family (consent-jobs-delivery.ts, consent-jobs-http.ts, consent-jobs-dispatch.ts) and deliverJobsConsentRevocation. Exact provenance was not recovered in inspected Privacy trees/path history. Do not fabricate a historical source recovery. The harness's use of Firestore/Storage emulator fixtures and mocked callable/HTTP identity does not establish a production service identity or GCS IAM.

B. **Privacy R647 #214 prepared dispatcher donor** exports dispatchPendingJobsRevocations. It is a substantial bounded lease/retry/HTTPS/ACK library but explicitly not exported, scheduled, activated or deployed. Its 10 dispatcher and 16 contract/transport tests were not run in the inspected R962/R964 environment due GitHub DNS/checkout failure. They are Node/VM/fake-Firestore/mocked-transport tests, not Firebase emulator acceptance.

C. **Privacy R818/R836 #224/#232** is a separate Jobs compiled-identity/transport to actual Privacy callable denial/review-only runner. It is not the missing #371 source family or the R647 outbox dispatcher. Exact R836 four-emulator acceptance is still unaccepted.

Do not transfer APIs or test counts between these tracks.

### 4.2 R647 incompatibilities with R20

R647 must not be cherry-picked unchanged:
1. Its outbox query requires jobsDelivery* queue fields omitted by R20.
2. R20 changed immutable publisher integrity hash inputs by adding prior-grant evidence.
3. R647 v2 mapper drops priorGrantReceiptHash and priorGrantEvidenceState.
4. R647 maps outbox createdAt to Jobs revokedAt, conflating outbox creation time with source consent transition time.

Preserve R647 mechanics as a donor, not as an active integration. Legacy events with missing delivery metadata or prior lineage require explicit classification; do not blanket-backfill or silently reinterpret them.

### 4.3 R963 v3 event/ACK design and R964 required receiver changes

R963 is a proposal only. It proposes:
- versioned consent.revoked.v3;
- immutable event identity/digest over complete owner/purpose/tier/policy/current receipt/prior-grant receipt/evidence/source transition timestamp/provenance/correlation/contract fields;
- fixed canonical serialization and cross-language test vectors;
- separate immutable event facts and mutable delivery lease/retry projection;
- Privacy per-consumer ACK subdocument as canonical application ACK;
- Jobs HTTP response as authenticated transport evidence;
- Jobs ACK semantics limited to local consent-block application, never physical GCS purge;
- exact retry idempotency for at-least-once delivery.

R964 identifies three requirements that must be explicitly resolved:
1. Privacy R20 ACK callable checks detailHash format and token-bound consumer identity but does not recompute detailHash from complete event digest + Jobs receipt/action, nor does it recompute the full immutable outbox event digest.
2. R20 eventId identity inputs omit the prior-grant receipt/evidence pair even though integrityHash and replay classification include them. R963 v3 should make a clear identity decision and supply test vectors.
3. Crash-safe ACK retry: if Jobs commits its local block/receipt and Privacy commits the canonical ACK but a response is lost, retry must recognize the byte-identical existing ACK as idempotent success; a conflicting ACK goes needs-review, never overwritten. Stable token-bound service actor identity across retries/deploy rollovers must be defined because current duplicate-ACK comparison includes actor UID.

Proposed state authority:
- Jobs local immutable receipt proves only the exact Jobs owner/purpose block action.
- Privacy per-consumer ACK is canonical application ACK after receiver-side integrity validation.
- Root outbox delivery state is a scheduling/transport projection, not a second independent ACK authority.
- Provider Storage denial, upload drain, generation deletion and physical purge are separate receipts and never implied by Jobs ACK.

No v3 contract, code, dispatcher export, schedule/task wrapper, event migration, ACK integration or producer-to-ACK test has been implemented/approved.

## 5. Firebase Rules — refined publisher authority and overlapping policy

### 5.1 Exact source target and Rules sources

Labs Firebase R971 report is now present in #284:
- FIREBASE_R971_SHARED_RULES_AUTHORITY_AND_DEPLOY_PATH_RECONCILIATION_20261109.md
- machine manifest manifests/FIREBASE_R971_SHARED_RULES_AUTHORITY_20261109.json
- current PR #284 head 9bb62bc57886e830111c4537a8512e240dd0dc9a (open/draft/unmerged).

Current source configs:
| Repository | Source project/database | Rules file | Rules blob |
|---|---|---|---|
| Spatial | urai-4dc1d/(default) | firebase/firestore.rules | 26330636a18a3675da049aa4bdadb34c82293882 |
| Admin | urai-4dc1d/(default) | firestore.rules | 1b9926316d2c5f5911bbbd52b000967f5e935030 |
| B2Bportal | urai-4dc1d/(default) | firestore.rules | b17ec9f4ef896870722905a279ac0d8206fcf24a |

These distinct Rules files select the same source-configured project/database. Admin and B2Bportal have overlapping matches at adminUsers/{document} and partnerAccounts/{document} with different predicates. Spatial contains the same users/{uid}/lifeMovies/{movieId} match twice with identical predicates (source redundancy; not itself proof of expanded access).

### 5.2 Reviewed governed deploy paths

- **Admin:** source-controlled production workflow → launch lock → scripts/deploy-production.sh, with WIF and exact target/rollback SHA checks. The script executes firebase deploy --only hosting,functions,firestore,storage -P urai-4dc1d. This is a source-verified Rules-capable deploy path. It does not prove workflow execution, configured GitHub WIF vars or effective IAM.
- **Spatial:** reviewed governed WIF flow is explicitly functions-and-hosting; actual steps use --only functions and --only hosting. The reviewed flow does not publish Firestore Rules. The read-only live-verify workflow has no production mutation command. This does not prove there are no other publisher paths.
- **B2Bportal:** reviewed CI and production-evidence workflows run checks/audits/emulator tests; neither contains a Firebase production deploy command. The package Rules command uses disposable project urai-b2bportal-test. Manual/delegated/legacy publisher paths remain UNKNOWN.

Therefore do not describe all three as proven active governed publishers. The source-level collision is three distinct Rules sources aimed at one target; the reviewed current deploy-capable Admin path is confirmed; other manual/delegated authority remains unknown.

### 5.3 Privacy deployment

Privacy main/#186 have no root .firebaserc in inspected refs. Privacy #186's guard remains Functions-only (functions:privacy) and does not deploy its changed Firestore Rules. The founder-supplied urai-privacy seed is not provider proof.

### 5.4 Provider status

No authenticated provider readback was performed:
- live project number and default database identity UNKNOWN;
- deployed Ruleset IDs/bytes and history UNKNOWN;
- effective IAM and all human/WIF/manual publisher identities UNKNOWN;
- no current cloud proof of overwrite, breach or live policy mismatch.

Required decision: one accountable canonical shared publisher and intentionally composed Rules, or owner-approved project/database separation with migration, identity, storage, indexes, billing, backups and rollback. No Rules concatenation or alias mutation by assumption.

## 6. Jobs #380 owner-field Rule and other open issues

Jobs issue #380 remains OPEN/P1:
- main Rules blob 7dc63626c6e1a2e7b20ded280ea2dd070f16abc9;
- R940 inherited Rules candidate blob cfa77a8fa5e69327ab352b31450c59a036d21e38;
- dataRightsDeletionRequestId is absent from the self-update protected field set in both.
- Jobs #378's seven changed files do not include firestore.rules; #378 is not a Rules repair.

Classification: source-level self-update Rules gap, not a proven deployed exploit or proof that mutation succeeds in the full Rules engine. It may allow a changed request binding to cause a fail-closed mismatch and disrupt a legitimate deletion. Required new isolated Rules patch protects the complete server-owned profile field set and tests add/change/remove on every field under authenticated Firestore emulators while preserving authorized service/admin writes.

Other issue ledger:
- Jobs #252 OPEN/P0: durable future-write epoch/reservation, exclusive writer identity, stale/alternate writer 403, active upload drain, exact generation deletion, final physical absence and durable downstream ACK.
- Jobs #376 OPEN/P1: approved post-admission operator withdrawal/continuation policy.
- Jobs #345 OPEN/P2: concurrent createJob quota admission/idempotency under native Firestore transaction tests.
- Jobs #380 OPEN/P1: server-owned deletion request field guard.
- Privacy #83 OPEN: source implementation exists, but protected deployed runtime, downstream ACK and provider-call suppression remain unproven.

## 7. Studio → Jobs producer/consumer status

Studio candidate chain remains:
- #198 3ba9f4eda3d81c3813bcaa8f68cf892e204e02f2
- #199 17859bf26915f99ee08eb8673953b0057740279c
- #200 e74a20746f9ca109cd166f06521e47a3d615f89e
- #201 a6187abfd12ffc8f534ddf66246da91ed032e1

Master reports bounded local results: R926 15/15, R927 33/33, R930 34/34, R931 35/35; R936 Studio #201 frozen install/typecheck/full suite 56/56/Next build. These are candidate-scoped receipts and were not rerun in R972.

Jobs #390 has a reported exact-candidate parser/producer suite 15/15: Studio's actual serialized envelope rejects because canonical consent is absent. A dummy receipt fixture checks schema only, not grant authority. Jobs main does not contain #390 schema additions (source.generation, timeline.sourceStartMs, top-level consent) nor the candidate consent gate.

Fresh compare #390→#391 reports diverged 1 ahead / 2 behind at common ancestor a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9, despite PR #391 metadata declaring #390 as its base. Resolve actual Git parent ancestry and execute corrected exact-head parser tests; do not assume a clean PR child.

## 8. Cross-model capability correction through R962

Labs master R960–R962 corrects the current system description:
- URAI-Communications has a merged five-provider sequential failover router with spend/output hardening.
- The router is behind ENABLE_COUNCIL_MODEL_ROUTER, default-off; no product caller was located in the reviewed source.
- Current staging provider registry is pinned to older source and reports runtime not certified/live smoke not done; update readiness evidence to the current Communications main before claiming current live readiness.
- This is bounded provider selection/failover, not parallel multi-specialist debate, voting or synthesis.
- Spatial Orb remains a separate OpenAI conversation path with bounded local state.
- Internal route context propagation exists, not persistent general cross-session memory.
- Public social/video comment adapters and AI-to-AI public comment loops remain unverified.
- Jobs is governed execution; Labs registry is engineering continuity, not user autobiographical memory.

No live provider runtime activation or deployment is claimed.

## 9. Full acceptance matrix

| Gate | Current state | Required next proof |
|---|---|---|
| 19 repo main refs | 19/19 exact refs match R958 | full current source/branch/byte/history |
| Labs registry | #262 advanced; #331/#332 sibling consolidations open | refresh/reconcile ancestry and avoid overwriting concurrent updates |
| Privacy R27 native | 199/199 units + lint/type/build/static/preflight on 6fecb46… | current workflow diagnostic and clean emulator trigger logs |
| R27 current workflow | Node 22.23.0 source corrected; latest hosted run no steps/logs | observable exact-head artifact and exit records |
| R27 callable | forced deny, unregistered purpose | Auth emulator token/claim/revoked-token boundary and independent review |
| R20 ACK | receiver lacks full digest/detail recomputation | approved v3 event identity, source time and canonical ACK semantics |
| R647 dispatcher | substantial prepared donor, incompatible | exact donor tests then selective v3 port |
| Jobs #371 harness | expected Privacy provenance unresolved | exact source recovery or explicitly new reviewed harness |
| Shared Firestore | source-configured target collision, Admin deploy capable | live Rules/IAM/publisher readback and architecture choice |
| Jobs #380 | deletion request ID not protected in two inspected Rules sources | separate repair + authenticated Rules emulator |
| Jobs #252 | OPEN/P0 | durable write fence, active drain, 403, exact deletion, final ACK |
| Studio/Jobs | candidate repairs and parser receipt | current-main vs candidate schema, #391 ancestry and full same-SHA test |
| Provider runtime | no live Firebase/GCP inventory | authorized project/Rules/IAM/runtime/bucket/backup/billing evidence |
| CI governance | failed runs/null steps/missing logs; main protection not proven | protected diagnosable CI and non-author reviewer |
| Product/device | substantial source and prior bounded reports | Windows/web/iOS/Android/XR, accessibility, localization, visual signoff |
| Legal/ops | historical source/docs | current store/provider billing, backups/restore, rollback, legal approvals |
| Release | NOT CERTIFIED | independent certification and explicit Founder GO |

## 10. R973 execution order

1. Refresh all 19 main refs, Labs #262/#284/#261/#331/#332, Jobs #379 and issues #252/#345/#376/#380, Privacy #257/#256/#214/#224/#232, Jobs #371/#378/#389/#390/#391, Studio #198–#201, Spatial #1962/#1964/#2073, Admin and B2Bportal before any source edit.
2. Reconcile Labs #331/#332 to latest #262 head aab1d742…. Preserve their 16-file R968–R971 consolidation and compare both against current master; do not merge broad docs automatically.
3. For Privacy #257 current a3f7119…, run the updated Node22 workflow with observable steps/artifacts. Use R939 199/199 + build/preflight as prior source receipt, not current workflow execution. Diagnose emulator invalid-trigger/ECONNRESET noise and rerun exact current app source with logs; archive raw logs and final clean worktree.
4. Resolve Jobs #391 divergence and execute the actual candidate Zod parser; separately compare current Jobs main schema; do not promote #390 branch's 263-file ancestry by assumption.
5. Complete Studio #198–#201 full suite on one exact combined source tree and compare serialized producer to candidate Jobs schema and current main; keep consent hard-off.
6. Obtain owner-controlled provider read-only inventory for urai-4dc1d: project number, database, deployed Ruleset, effective IAM, Admin WIF vars/principal, human/manual publishers, current runtime sources. Make an approved single publisher vs DB-separation decision. Do not publish Rules or mutate IAM.
7. Create isolated Jobs #380 Rules candidate protecting dataRightsDeletionRequestId and test every protected field add/change/remove via authenticated Rules emulators.
8. Approve R963/R964 v3 event/ACK contract with Privacy/legal/security and Jobs owners: canonical serialization, full prior-grant identity, source timestamp provenance, Jobs receipt/action hash, Privacy ACK receiver verification, stable actor identity, legacy disposition and crash-safe identical-ACK recovery.
9. Recover/execute R647 donor tests on a network-capable clean runner; no unchanged cherry-pick. Keep #371 and R818/R836 separate.
10. Close Jobs #252 through actual nonproduction Storage data-plane stale/alternate writer 403, in-flight upload/stream drain, generation-bound deletion, final absence and durable no-late-write ACK. No point-in-time list or Jobs ACK substitutes.
11. Restore protected CI and independent review; verify actual rollback restores prior healthy live revision, not newest preview.
12. Finish same-SHA authorized owner consent → private render → protected Replay → revoke → provider suppression → physical purge → downstream ACK. Complete device/accessibility/AAA visuals, legal/store/billing/backups and explicit Founder GO.

## 11. R972 execution ledger

Performed:
- 19 repository main refs fetched and compared to R958.
- Fresh PR metadata for Labs #262/#261/#284/#327–#332/#304, Jobs #378/#379/#389–#391, Privacy #256/#257.
- Privacy #257 current commit compare, changed-file list, workflow exact source, latest workflow run/job metadata.
- Labs master entrypoint and R939/R940 exact source reports/manifests read.
- Labs R960 cumulative revocation report and current Firebase R971 shared authority report/manifest read.
- Jobs R959–R964 dispatcher compatibility, event/ACK proposal and receiver review read.
- Jobs issues #252/#345/#376/#380 and current review metadata/search read.

Not performed:
- No clone/checkout, install, test, typecheck, build, emulator or CI dispatch.
- No Firebase/GCP provider APIs, effective IAM/Rules or deployed revisions.
- No merge, deploy, dispatch, Rules/IAM mutation, billing change, user record/media or paid compute.

## 12. Hard boundaries

**NO MERGE / NO DEPLOY / NO DISPATCH / NO C1 OR C6 ENABLEMENT / NO PRIVATE MEDIA / NO IAM OR RULES MUTATION / NO BILLING ACTION / NO PAID COMPUTE / NO PRODUCTION GO.**

Preserve LifeLogger → LifeOS → UrAi → RuAi source and histories, worker-owned branches, exact receipts, branch ancestry and unresolved contradictions. No false green status.

**ONE URAI GENESIS — R972 RECONCILED. PRODUCTION HOLD / NO-GO.**
