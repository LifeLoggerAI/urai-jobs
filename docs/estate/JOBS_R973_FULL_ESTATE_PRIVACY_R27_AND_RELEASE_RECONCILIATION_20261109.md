# ONE URAI GENESIS — R973 Full Estate Continuity, Privacy R27 and Release-Hold Reconciliation

**Checkpoint:** R973 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repositories:** Jobs forensic lane, Labs master crosswalk, Privacy consent line, Spatial, Studio and shared Firebase estate  
**Scope:** Fresh read-only GitHub source/PR/issue/workflow metadata inspection plus documentation. No test, build, emulator, provider read, deployment, dispatch, IAM/Rules mutation, source change, paid compute or private-media operation occurred.

## 0. Executive determination

R973 reconciles R972 with the fuller R971 estate crosswalk and the later Privacy #257 head. The main new facts:

1. **Privacy #257 has advanced** from R27 head `e2193434...` to exact head `a3f7119497fe1d9c6dc61e104a1da0a583d247f8`. The ten-file candidate still keeps `life-movie.render` out of the canonical consent purpose registry, and its Jobs-only `verifyLifeMovieRenderConsent` callable explicitly sets `const allowed = false`. It is denial-only; no positive grant, capability, renderer permission or C6 authorization is created.
2. Six workflow runs for this exact #257 head are completed with failure conclusions. The dedicated R27 run is `42613095876`; previous raw run inspection showed empty/null step summaries and BlobNotFound 404 logs. R973 has not retrieved usable execution artifacts or rerun anything. Exact-head test/typecheck/build/emulator results are **NOT ESTABLISHED**, not “tests failed.”
3. The Labs master PR #262 has advanced to `40bbb3c44bc7c9810ede064afc2587c9c1fdc88a` (open/draft/unmerged). The Jobs R971 full-estate crosswalk already provides a richer map of 19 repositories, Studio→Jobs integration, Communications provider routing, C1/C6, shared Firebase, and the release matrix. This is a knowledge registry and source evidence index, not production authority.
4. Jobs main remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`. Main branch metadata reports unprotected/required checks off. Preserve its add-then-revert history; do not rewrite.
5. The Jobs/Privacy/Spatial shared Firebase Rules publisher risk remains source-level. Provider effective Rules, database identity, deploy history and actual principals are still unknown.
6. Jobs #252/#345/#376/#380 and Privacy #83 remain open. Jobs #380's server-owned `dataRightsDeletionRequestId` gap remains in the inspected source; #378 is not a Rules repair.
7. The four revocation/consent paths remain distinct: R647 donor dispatcher, Jobs #371 synthetic Storage cleanup harness, Privacy R818/R836 denial-only callable acceptance and Privacy R27 denial-only scoped Life Movie verification.
8. The broader Genesis still lacks same-SHA owner consent → private render → owner Replay → revoke → provider suppression → physical purge → downstream ACK. Protected CI, effective cloud inventory, rollback, devices/accessibility/visual approval and explicit Founder GO remain outstanding.

## 1. Canonical read order for the next Chalk

Read these first:
1. This report: `JOBS_R973_FULL_ESTATE_PRIVACY_R27_AND_RELEASE_RECONCILIATION_20261109.md`.
2. `JOBS_R973_MACHINE_CHECKPOINT_20261109.json`.
3. `JOBS_R973_START_NEXT_CHALK_R974_20261109.md`.
4. `JOBS_R971_FULL_ESTATE_MASTER_CROSSWALK_AND_RELEASE_HOLD_20261109.md` (35 KB master Jobs crosswalk; contains 19-repo refs, integration lineages, Studio/Jobs, cross-model continuity, C1 Rules, full acceptance matrix and #380 addendum).
5. `JOBS_R971_FULL_ESTATE_MACHINE_CHECKPOINT_20261109.json`.
6. `JOBS_R972_SOURCE_AUTHORITY_VERIFICATION_NEXT_CHALK_HOLD_20261109.md` and `JOBS_R972_MACHINE_CHECKPOINT_20261109.json`.
7. `JOBS_R971_FIREBASE_RULES_AUTHORITY_AND_OWNER_FIELD_RECONCILIATION_HOLD_20261109.md`.
8. `JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md` and `JOBS_R970_CONSOLIDATED_STACK_AND_EXECUTION_READINESS_HOLD_20261109.md`.
9. R969 current-lineage/Life Movie/C1 Rules, full-stack governance and full estate reports.
10. R968 consolidated three-lineage ledger, R967 provenance audit, R966/R965 ACK/purge reports, then R960–R965 source/compatibility/ACK proposals and R953–R959 Jobs auth/CI/security reports.
11. Labs master PR #262 `00_START_HERE.md`, registry, verification/evidence, inventory and R929 census. It is an index; preserve separate repository owners and original donor histories.

## 2. Current GitHub refs refreshed in R973

### 2.1 Jobs main
- SHA: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- Tree: `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`.
- Main branch API: `protected=false`; required checks enforcement `off`.
- The commit reverts the one accidental 90-line R933 test file addition and restores the earlier main tree. Commit is unsigned. Preserve history; no rewrite.

### 2.2 Main refs in the latest full estate crosswalk
The R971 crosswalk reports 19/19 current main refs still matched the Round24/R958 register:
- UrAi `8cac3ba513830c11261d57bc2b5dd7ad8b83e85a`
- UrAi-Dev `08257158e2ffee8bbeb183ae89185f1677bad1da`
- UrAiProd `d3d7ce6e607a5ee1be2c9f9ede6eecf1cfb393b9`
- Spatial `da94837c2457b0a7590e26a7a644cd728de8afb8`
- Privacy `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`
- Jobs `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`
- Studio `854477d80b1a7aa718edb60d1ed4c1cf22dbed9d`
- Staging `bda659ad23590b39e7f32de349f8a3723455ce02`
- Admin `1cde00e69238f6a32237af2d1914a1b77339d5bc`
- Analytics `a6e98090843301ad4f377c1cd8a840edfe517c8c`
- Marketing `b421ab5ca2c4a76a1b63e7c8d43996cf7a764354`
- Investors `1c248838072a2ada4da52d943b10c933a5016a26`
- Labs `2359d7e33df837dd4c4279ce444cfc8750c05c8b`
- Asset Factory `a49f611ade29a1754787701ab4bf915c85c0cdc6`
- Content `988ca4f7f38b1ce86e4d3f426361b5866fd23e0d`
- Foundation `8ee8036b649ae9c9e73ae374a7247f0bb34c4c03`
- Communications `40cd2f4b6d422734869486a49cddac9e103a58f1`
- B2Bportal/RuAi `4aea8574970d28a293f921a34156c4cc5a971213`
- Storytime `73f586a0a2931961ae221af7cfc0caf1b6aef39d`

This 19/19 figure is ref metadata, not complete byte-level source, history, user-data, provider or release certification. R973 did not repeat the full 19-ref census.

### 2.3 Labs master and forensic lane
- Labs master PR #262 observed head: `40bbb3c44bc7c9810ede064afc2587c9c1fdc88a`, open/draft/unmerged.
- Jobs forensic PR #379 moved during this sequence; re-fetch its latest head before writing.
- Labs cross-chat PR #304 remains open/draft/unmerged; refresh latest head after this write.
- Jobs engineering #389 remains open/draft/unmerged at `b865209cc352241602d8b9714672f3401aed7669` in last read; do not assume its base or state without refreshing.
- Jobs #390 remains open/draft/unmerged at `e8ba07fc26f154169f2e065d9aa65e77014635d2`, seven changed paths.
- Jobs #391 remains open/draft/unmerged at `9f5759f072370fbd42a82560ff6c5d4f37169c6b`, one changed test path. Its compare to #390 previously diverged 1 ahead / 2 behind at merge base `a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9`. Resolve ancestry before calling it a clean child.

## 3. Privacy R27 — fresh exact-head reconciliation

### 3.1 Current PR #257
- Repository: `LifeLoggerAI/urai-privacy`.
- PR #257 head: `a3f7119497fe1d9c6dc61e104a1da0a583d247f8`.
- Base: `review/chalk-r20-revocation-outbox-replay-integrity-20261109`.
- State: open/draft/unmerged.
- Ten changed paths:
  - `.github/workflows/r27-scoped-consent-verification.yml`
  - `functions/src/consent-api.ts`
  - `functions/src/consent-decision.ts`
  - `functions/src/cross-user-authority.ts`
  - `functions/src/functions-entry.ts`
  - `functions/src/life-movie-deletion-fence.ts`
  - `functions/src/life-movie-jobs-identity.ts`
  - `functions/src/life-movie-render-authorization.ts`
  - `functions/src/life-movie-scoped-receipt.ts`
  - `tests/unit/r27-life-movie-verifier-boundary.test.ts`

Earlier R27 #257 head `e2193434...` and its exact workflow readback are stale as branch identity, though the exact source blobs inspected below are unchanged at current a3f711 head. Re-fetch before future mutation.

### 3.2 Source behavior — still denial-only
Current source blobs:
- Workflow: `10b45cbdc75356adba76afdd6fd14f562c4e358a`.
- `consent-api.ts`: `d54a7636f7e6421577eb17a6316f1a4bc9fde8e7`.
- `consent-decision.ts`: `3cb3232d0334691c820575e8626c34e25d0c987e`.
- `functions-entry.ts`: `f81171feb058be606be19134928c4baf9830f664`.
- `life-movie-render-authorization.ts`: `978e0fd7805527713699010541394cd026fd2900`.
- Boundary test: `5376f6359229645907e4b2668a0e28516785b8f6`.

The source defines reserved literal `life-movie.render` with policy `1.1.0`, but `consentPurposeRegistry` intentionally does not register it. Generic `canonicalPurpose()` rejects unregistered purposes. The dedicated verifier is exported through Functions entry and:
1. requires own-claims `system` identity, consumer ID `urai-jobs`, dedicated verifier UID;
2. reverifies the bearer with revocation checking;
3. strictly parses subject, tenant, correlation, receipt hash, policy version and exact render scope;
4. transactionally reads consent record and deletion tombstone;
5. verifies subject, tenant, exact scope and receipt integrity;
6. records an audit-only data access event;
7. explicitly sets `const allowed = false`, and returns no receipt hash, expiry or render scope as a grant/capability.

It does not write a consent grant, register the Life Movie purpose, mint a reusable capability, activate scoped assembler, start rendering, create private media or authorize Replay.

The unit test contains nine test cases. It checks unregistered purpose, scoped receipt shape/owner/tenant/digest, malformed scope denial, never-allow behavior, deletion tombstone uncertainty, dedicated Jobs identity, token revocation checking, own-claims cross-user authority and the no-grant/no-assembler export boundary. These are test declarations/source content; R973 did not run them.

**Security meaning:** R27 is a conservative denial boundary while Privacy/legal has not approved a scoped Life Movie grant/issuer. Do not “fix” it by changing `allowed=false`, registering `life-movie.render`, exposing the assembler, or minting a grant. That requires separate policy approval, positive trusted issuer design, complete rights/subject/source proof, protected CI, deployment and same-SHA acceptance.

### 3.3 Current R27 workflow evidence
At exact head `a3f711...`, six workflow runs are completed with failure:
- `42613095735` — URAI Production Verify
- `42613095862` — URAI Privacy Release Verification
- `42613095876` — R27 scoped Life Movie denial-boundary verification
- `42613095808` — Privacy package validation
- `42613095784` — Release Verification
- `42613095765` — Consent Export and Deletion Branch Validation

Dedicated R27 workflow uses `ubuntu-latest`, Node 22.23.0, captures root `npm ci`, focused Vitest, root typecheck, Functions `npm ci`, Functions typecheck/build, uploads artifacts and then enforces all captured exit codes. Its source is fail-closed: install failure leads dependent stages to exit code 125 and final gate fails. However R973 could not fetch usable step/log execution details; prior raw inspection returned null/empty steps and BlobNotFound 404.

**Therefore:** current exact-head CI conclusion is red, but which command ran and why remains unknown. Unit test, typecheck, build and Firebase four-emulator acceptance remain NOT ESTABLISHED. Do not describe this as a source defect or successful suite.

## 4. Cross-repository master findings carried forward

The R971 full estate crosswalk is the main source for these; R973 read it and uses it as a current crosswalk, not as a new full audit of all subsystems.

### 4.1 Studio → Jobs
Studio #198→#201 form a stacked producer correction chain:
- #198 immutable positive GCS generation.
- #199 sourceStartMs/timeline offset preservation.
- #200 strict type/allowlist normalization.
- #201 tenant/project output-prefix traversal boundary.
Reported candidate results in the Labs crosswalk: R926 15/15, R927 33/33, R930 34/34, R931 35/35; R936 frozen install/typecheck/full suite 56/56 plus build. These are reported on exact earlier candidates, not current Jobs main or deployed render authorization.
Jobs #390 reports candidate Zod producer-consumer contract 15/15 and correctly rejects missing canonical consent. Jobs main lacks candidate generation/sourceStartMs/consent contract paths. #391 changes one test path but ancestry diverges. Do not transfer #390/#391 to main by PR number alone.

### 4.2 Cross-model / Communications
The Labs master corrects an earlier overstatement:
- Communications has a merged five-provider sequential failover router; it is not simultaneous Council specialist debate, voting or synthesis.
- Provider registry reports provider runtimeCertified=false and liveSmokeThisPass=false for all five in the crosswalk snapshot.
- Spatial Orb is a separate OpenAI-specific user-facing conversation with bounded local history.
- Route-level memory/thread/person/place/replay context is passed internally; it is not durable cross-session model-neutral memory.
- Public video-comment/social-platform AI-to-AI conversations are requirements/design only; no verified adapter or governed comment loop.
- Jobs is governed async execution, not a model memory store.
- Labs #262 is an engineering knowledge registry and successor worker handoff, not autobiographical user memory.

Accurate state: multi-provider routing foundation plus separate Orb conversation, route context and governed workers. Missing: canonical durable model-neutral conversation memory, live provider certification and authorized social platform adapters.

### 4.3 Shared Firebase Rules
Spatial, Admin and B2Bportal source configs select `urai-4dc1d/(default)` with three different Rules files. This is source-level competing publisher authority only. Admin source has capability to deploy Firestore Rules; execution not established. Privacy has no root .firebaserc at inspected main; #186 guarded path is `functions:privacy` only.
Privacy #186 and Spatial #1964 have different C1 first-time consentRecords read semantics. Spatial #1964 is a large 1,489-commit-ahead stack; never merge whole PR for a small Rules fragment.
No effective provider Rules/IAM/deployed release read occurred. No full Ruleset should be deployed or overwritten in discovery.

## 5. Core open release gates — latest status

### Jobs
- [#252 P0](https://github.com/LifeLoggerAI/urai-jobs/issues/252): storage-enforced post-revocation write fence, stale/alternate privileged writer 403, upload drain, exact-generation delete and durable physical purge ACK. Open.
- [#376 P1](https://github.com/LifeLoggerAI/urai-jobs/issues/376): data-rights executor post-admission operator withdrawal/continuation authority. Open. Prior 12/12 in-memory diagnostic receipt is not live provider proof.
- [#380 P1](https://github.com/LifeLoggerAI/urai-jobs/issues/380): server-owned profile field binding; `dataRightsDeletionRequestId` missing in main and R940 source guard. Open.
- [#345 P2](https://github.com/LifeLoggerAI/urai-jobs/issues/345): possible pre-transaction quota read race; native concurrent Auth/Firestore/Functions acceptance outstanding. Open.

### Privacy
- [#83](https://github.com/LifeLoggerAI/urai-privacy/issues/83) remains open. Canonical consent and revocation source exists, but protected deployed runtime, registered downstream consumer ACKs, provider-call suppression, project/region/deployed SHA and rollback remain unproven.
- R27 #257 denial-only scoped Life Movie endpoint remains an unmerged candidate.

### Other independent Genesis gates
- Protected branch/CI and independent eligible reviewer.
- Actual deployed Firebase/GCP resource inventory and effective IAM.
- Same-SHA owner-authorized consent → Studio producer → Jobs parser/renderer → private output → owner-only Replay → revocation → provider suppression → physical purge → downstream ACK.
- Device acceptance Windows/web/iOS/Android/XR, accessibility/reduced motion/haptic/blind workflows, localization and AAA visual acceptance.
- Operational rollback, store declarations, billing, backups/restore, legal/privacy/security approval and explicit Founder GO.

## 6. R973 execution ledger

Performed:
- Refreshed Jobs forensic #379 and changed-file list, Jobs main, Jobs #389, Labs #304, Labs master #262, Privacy main, Privacy #257 and Spatial main.
- Read R971 full 19-repository estate crosswalk and machine checkpoint.
- Read exact current R27 #257 changed-file list and exact source blobs for workflow, consent API/decision, Functions export, Life Movie verifier and boundary tests.
- Queried six Actions run records for exact current #257 SHA.
- Refreshed Jobs #252/#345/#376/#380 and Privacy #83 state.
- Reconfirmed Jobs main SHA/tree and branch protection metadata.

Not performed:
- no clean Git checkout or dependency install;
- no Node/Vitest suite;
- no root or Functions typecheck/build;
- no Firebase Auth/Firestore/Functions/Storage emulator;
- no full Jobs 78-command acceptance;
- no R647/R836/Jobs #371 test execution;
- no Firebase/GCP provider inventory or effective Rules/IAM read;
- no Rules publisher test or deploy;
- no GCS late-write 403, upload drain, exact-generation purge or downstream ACK;
- no deployment, dispatch, merge, IAM/Rules mutation, billing, paid compute or private media access.

## 7. R974 exact next-Chalk execution plan

1. Read R973 report, machine checkpoint and R974 start prompt, then R971 full estate crosswalk, R972 source-authority report and R970 consolidated stack.
2. Refresh current main refs and exact PR #257, #262, #379, #304, #378, #389, #390, #391; refresh Jobs #252/#345/#376/#380 and Privacy #83.
3. Diagnose #257 six failed Actions runs from raw check-run/job/runner metadata and artifact availability. Exact source head is `a3f711...`; don't use `e219343...` stale logs. Run exact candidate tests/typecheck/build only on clean, network-capable, protected and credential-safe runner. Run Java21 four-emulator denial suite only with approved demo project/no production credentials.
4. Preserve R27 denial-only behavior. Obtain Privacy/legal/security approval before any registration/positive Life Movie grant design. Hash receipt != signature, trusted source rights or human authorization.
5. Resolve main governance and Actions runner evidence through authorized admins. Do not use CI bypass or infer absence of organization rules from an API 403.
6. Resolve shared Rules authority using owner-authorized read-only provider evidence: project number, exact database, deployed Rules release/etag, deployment principals, deploy history and rollback. Decide one publisher or approved database split before Rules deploy.
7. Create separate Jobs #380 isolated Rules repair, protect `dataRightsDeletionRequestId` and full server-owned field matrix; run authenticated native Rules emulator add/change/remove tests plus ordinary owner profile regression.
8. Preserve PR stack ancestry; #371 remains on R891 base. #391 compare divergence must be reconciled. Do not retarget stacked PRs to main.
9. Execute R647 donor suites, Jobs #371 harness and R818/R836 acceptance separately. Do not transfer test receipts.
10. Close #252 with real nonproduction stale/alternate privileged writer 403, in-flight/resumable drain, generation-pinned delete, final object absence and durable downstream physical purge ACK.
11. Complete #376 continuation policy and #345 concurrency acceptance. Then run same-SHA positive owner consent → private render → Replay → revoke → suppression → purge/ACK.
12. Finish deployed source/image/identity/ingress/secret/IAM verification, rollback rehearsal, devices/accessibility/AAA visual, legal/operational readiness, independent review and explicit Founder GO.

## 8. Non-authorizations and final disposition

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

R973 does not authorize:
- merge or retarget of any stacked engineering PR;
- deployment of source Rules or Functions;
- registration of Life Movie purpose or positive grant issuance;
- enabling Studio consent authority/private output;
- revocation dispatch or real customer job creation;
- private-media access, user-data inspection or external provider processing;
- IAM/Rules changes, CI bypass, billing or paid compute;
- Production GO.

Preserve historical branches, source blobs, failed CI evidence, test receipts and contradictions. Unknown is not absent; a source candidate is not deployed code; a test declaration is not a test receipt; Jobs ACK is not physical purge.

---
*R973 is a source/metadata reconciliation and successor-worker handoff. All hashes/heads are exact snapshots, refresh before any action. No runtime acceptance was performed.*
