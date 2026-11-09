# NEXT CHALK — ONE URAI GENESIS R970 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis. Preserve source history, review stacks and forensic evidence. Do not restart, flatten, or rebuild surviving implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read in order:
1. `docs/estate/JOBS_R969_FULL_STACK_BRANCH_CI_GOVERNANCE_RECONCILIATION_HOLD_20261109.md`
2. `docs/estate/JOBS_R969_MACHINE_CHECKPOINT_20261109.json`
3. R968 consolidated cross-lineage ledger and machine checkpoint.
4. R967 historical Privacy harness provenance report/checkpoint.
5. R966 emulator harness and derivative cleanup report.
6. R965 receipt/ACK/purge report.
7. R964 ACK/event identity review.
8. R963 v3 design proposal.
9. R962 donor execution readiness report.
10. R961 master handoff, R960–R953 and R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and original START NEXT CHALK.
11. Relevant Jobs #371/#377/#379/#384/#386–#390, Privacy #83/#192/#213/#214/#229–#232/#253–#256.

## Exact branch topology and safe handling

As refreshed at R969:

### Jobs
- main: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`
- R923 #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- #371 declared base branch `review/chalk-r891-jobs-quota-owner-runtime-convergence-20261107`:
  `ebdf5f62338822f99b7293bdd5b9a0cda4917dd9`
- #371 is exactly 60 commits ahead / 0 behind its declared base, with 13 scoped file changes.
- Against current main #371 is 629 commits ahead / 2 behind and 236 net changed paths. Two main-only commits are a test-file add and explicit revert:
  - `792d063b9d894bb9cb872e2c3c6dd71e37804f6a` R933 regex repair/add test.
  - `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` reverts that same test file.

**Do not retarget or merge #371 directly to main.** Preserve its intended R891 stack, reconcile the predecessor chain and main-only commits deliberately, verify full tree identity.

Other Jobs review heads:
- #377 `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- #388 `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- #389 `b865209cc352241602d8b9714672f3401aed7669`
- #390 `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- #384 `fd05a376f876f9b835929a2074c09f47638659e2`
- #386 `fd1c8d85acd5cc96ef9fcb300173e362b004eb54`
- #387 `04592f8573c708954f95f87ddca1e168efde51f4`

### Privacy
- main: `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`
- R506 #192: `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc`
- R583 #213: `4a4656d6283aa7e627bf220b447436df82865f99`
- R647 #214: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- R834 #229: `79e71fd6137947d2ed7c416a2596090572fef978`
- #230 / R836 declared base: `846d2ffa469af5634374bd77fbdc2d41bca8e964`
- R835 #231: `42aad96404c4f0de01a448031df80f7b5c06f7c0`
- R836 #232: `e1e2dee63c39590d343d727aa53618ac97a52691`
- R17–R20 #253–#256: `90a4e581...`, `dbc193...`, `a4d7e4...`, `cfc9de...` respectively (refresh complete values from R969 checkpoint).

Privacy R836 is one commit ahead / one behind its #230 base in compare metadata, with one reported path `next-env.d.ts`; exact blob is identical at both refs (`ce4e94a6b10f160ee021fe18939af160d2927dcf`). Preserve its two-parent ancestry and exact pin; do not rebase just to clean compare metadata.

## Governance / CI finding — release blocker

GitHub branch metadata returned `protected:false` for:
- Jobs main;
- Jobs R891 review base;
- Privacy main;
- Privacy #230/R836 base.

Repository-level rulesets endpoints returned empty arrays for Jobs and Privacy. Direct branch protection detail endpoints returned 403 to the integration; organization-level rulesets were not accessible. Therefore **effective governance remains NOT CERTIFIED**. An authorized administrator must verify directly:
- effective classic protection and inherited org rules;
- required checks and exact workflow names;
- independent non-author approval;
- bypass permissions and admin exemptions;
- required signed commits / conversation resolution if applicable.

No bypass or merge is authorized.

### Actions run evidence
Sampled Jobs R923-associated runs and Privacy R836-associated runs show completed/failure conclusions, but job-step summary API returned empty arrays. One job-log attempt returned BlobNotFound. This does NOT prove app test commands ran or assertions failed. Do not state “the tests failed” without actual step/log evidence; state “workflow conclusion failed, execution steps/logs unavailable.”

Representative Jobs run IDs:
- Runtime CI `42562565924`, job `128981975229`, steps empty; callable E2E skipped.
- System Audit `42562565556`, job `128981974507`, steps empty.

Representative Privacy:
- Release Verification `42333455401`, job `128284947159`, steps empty.
- Build/test/QA `42333455466`, job `128284946772`, steps empty.

Retrieve usable logs/job steps from authorized GitHub Actions access or reproduce the workflows on a protected runner. Do not rerun blindly until failure stage is understood.

## Technical integration baseline — three distinct tracks

A. Privacy R647 dispatcher donor:
- exact head `cc0692053db3b1b8df8267d43856b1a3357de8a0`;
- dispatcher blob `4126167b4350ba8afe6b19d7b60dec1ca891189f`;
- contract blob `6cca2b9456319927cf22511c7d51c1f16ddf051c`;
- test blobs `def1048aa4838f7ff990d792a27d1fb94e7f6441` and `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`.
Prepared, explicitly NOT DEPLOYED; exports `dispatchPendingJobsRevocations`. Preserve batch/lease/retry/stale-worker/pinned transport/ACK mechanics as donor only.

B. Jobs #371 three-case synthetic revocation/Storage emulator harness:
- test blob `e9662a979a72a0e39a61fe896a79f8379658d963`;
- expects Privacy modules `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, `consent-jobs-dispatch.ts`;
- exact modules not recovered from inspected Privacy branch trees/history; expects `deliverJobsConsentRevocation`, not R647's API. Do not fake recovery.
- local Firestore/Storage emulator + loopback Jobs HTTP; wrappers/auth mocked; direct synthetic fixture is not an authorized consent grant.

C. Privacy R818/R836 native callable acceptance:
- runner blob `589fbbb8cb4903946b3adc1b2aa707038e61d3df`;
- test blob `cafd32784b4c95f72214938290637b819557f3bb`;
- tests Jobs compiled identity/transport to actual Privacy consent callable in demo Auth/Functions/Firestore/Storage emulators, denial and review-only issuer.
- distinct from revocation dispatcher and Jobs #371 harness.
- R836 full runner not executed on exact candidate due Functions Unix socket EPERM; no transferable pass from prior parents.

R960 compatibility defects remain: R20 missing legacy queue fields; integrity hash changed; R647 drops prior-grant evidence; R647 uses outbox createdAt as revokedAt.

Jobs derivative cleanup is generation-pinned and refuses unknown objects, but point-in-time listing is not a future-write fence; unresolved in-flight markers remain; full historical erasure is not certified.

R963–R965 v3 event/ACK is proposal only. Needs Privacy/legal/security approval for identity digest, prior lineage, source time, legacy disposition, full event/Jobs receipt/action ACK binding, stable service identity and crash-safe retry.

Privacy issue #83 remains OPEN for protected deployed consent authority, downstream ACK and provider-call suppression.

## R969 source and test execution status

R969 refreshed PR metadata, compared branch graphs, inspected commits, queried branch governance and Actions runs/jobs/steps, and retried Git network.

Git command still failed exit 128:
`Could not resolve host: github.com`.

No clone, dependency install, donor tests, emulator harness, R836 runner, build, typecheck, cloud inventory, GCS IAM or dispatch executed.

## R970 next operations

1. Have an authorized GitHub administrator inspect and evidence effective protection/rulesets and bypass settings for Jobs/Privacy.
2. Get actual Actions job-step logs or run protected CI in a clean controlled runner; classify setup failures separately from application test results.
3. Preserve Jobs #371 declared stack base, reconcile the 60-commit PR and its predecessor chain; investigate main R933 add/revert via exact tree identity.
4. Preserve Privacy #232 R836 two-parent source lineage and exact pins.
5. Recover the Jobs #371 harness's exact missing Privacy module source from an identified archive/workspace; if impossible, draft a transparently labelled harness rewrite.
6. On Git-connected host, clean-checkout exact R647/Jobs #371/Privacy R836 refs and verify commit/tree/blob/lockfiles.
7. Execute R647 10-test and 16-test suites separately, Jobs #371 3-case harness only with compatible source, and R836 runner separately. Preserve TAP, logs, versions, source SHAs, exits, SHA256.
8. Review/approve v3 event/ACK design with Privacy/legal/security; then implement review-only and run same-SHA emulator producer→outbox→Jobs block→Privacy ACK acceptance.
9. Separately authorize read-only deployment inventory; then nonproduction GCS stale/alternate writer 403, upload drain, exact-generation purge and durable final ACK.
10. Close operator-withdrawal policy, worker auth, rollback rehearsal, protected CI, C6 lifecycle, devices/accessibility/visual, external operations and founder GO.

## Required R970 deliverables

- full reconciliation report;
- JSON machine checkpoint;
- copy/paste R971 start prompt;
- exact GitHub blob readbacks of all three artifacts;
- latest PR #379 head.

No merge, deployment, dispatch, private-media processing, IAM mutation, paid compute or production GO.


---

# R969 ADDENDUM — LIFE MOVIE SCOPED CONSENT AND C1 RULES RECONCILIATION

Read these R969 artifacts before continuing:
1. `docs/estate/JOBS_R969_CURRENT_LINEAGE_SECURITY_AND_C1_RULES_RECONCILIATION_HOLD_20261109.md`
2. `docs/estate/JOBS_R969_MACHINE_CHECKPOINT_20261109.json`

This addendum supersedes older generic R970 phrasing where it conflicts with the fresher R969 source readback above. Refresh PR heads before action.

## Current exact source pointers

### Privacy #183 — scoped Life Movie verifier
Current observed head: `389aa638f99a6394b46be335ee0465168a7a1a4c`.
- `functions/src/life-movie-render-authorization.ts` blob `a75e4f2297c331baa52b044f2842820adbdc7fc8`
- `functions/src/life-movie-scoped-receipt.ts` blob `a41f4cf9c2efb525115ec31359d936c8b2f66f6e`
- `functions/src/consent-api.ts` blob `43da4d49ccbee7cbe145d0729d921e10d859ba63`

The current source requires exact subject UID, purpose/tier/policy, tenant, render project/plan/source-set digests, receipt hash and explicitly inactive deletion-fence evidence. The receipt digest is SHA-256 integrity binding, not a signature or authorization. Generic purpose-wide Life Movie grant/evaluation remains fail-closed. A trusted positive scoped issuer and protected deployed runtime are not certified.

### Privacy #224 — R818 denial-only transport test
Current observed head: `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed`; test blob `51c5279295f07fde06c7f89b1472c5f147fdf8f0`.
It uses real local Firebase emulators and original compiled Jobs identity/transport to exercise denial/no-grant/no-render behavior. Stage two's ephemeral signer only re-signs local emulator claims for a negative test. This is not production service identity, not positive C6, and not successful render acceptance.

### Privacy/Spatial Rules heads
- Privacy main Rules blob `7c0051eb6d148791198127e625c99973abdc49c1` at main `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`.
- Privacy #186 Rules blob `295e5d27623cceddec8245759ff28128b17be28c` at `2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc`.
- Spatial main Rules blob `26330636a18a3675da049aa4bdadb34c82293882` at `da94837c2457b0a7590e26a7a644cd728de8afb8`.
- Spatial #1964 Rules blob `8b015a8bbe123bb7857bff5d98ba5a153067c41c` at `e3347d0e1ee57eaabafcfd50e2b033f7476aecf8`; its parent C1 bridge #1962 is `da2ee1ff6eed5b5cf0c8f3b762214fdb57c07c11`.

Privacy #186 adds strict tombstone/lease and ten-field profile authority rules. Spatial #1964 adds corresponding profile/deletion protections plus a first-time owner-only C1 `memory.storage` receipt read; missing may be observed as missing, existing record must match uid/purpose/C1/policy 1.0.0. Privacy main's generic consent record read does not implement the same missing-document path. Reconcile Rules fragments only after proving project/database topology and deployment ownership. Do not deploy either complete source Ruleset over the other.

Privacy issue #83 remains open.

## R970 mandatory execution order
1. Refresh Jobs #379/current main, Privacy main/#183/#186/#224/#214/#253-#256, Spatial main/#1962/#1964, Studio #198-#201, plus Jobs #371/#377/#384/#386-#391.
2. Inspect actual current diffs/ancestry and establish Firebase project/database topology and Rules deployment owners.
3. Produce collection/action/field matrix covering first-time C1 get, uid/userId/ownerId, ten protected fields, tombstone active/lease states, admin/founder authority and service-specific private data.
4. Keep R647 dispatcher, Jobs #371 harness, and R818/R836 callable runner as separate acceptance paths. Do not count results between them.
5. Recover exact original #371 `consent-jobs-*` module provenance only from a named archive/workspace/repository. If unrecoverable, create a new, differently named review-only harness rewrite.
6. Obtain a Git-connected clean host; verify exact refs/trees/blobs/lockfiles. Run R647 10/16 suites, #371 three-case harness (only with compatible source), and #224/#232 native denial paths independently.
7. Run Jobs #390/#391 real producer envelope against actual installed Jobs Zod dependency.
8. Resolve R20/v3 event, prior-grant digest, revocation timestamp provenance, receiver/action binding, workload identity, ACK authenticity and crash-safe idempotency with Privacy/legal/security owners.
9. Restore protected CI and independent non-author review; preserve raw logs and tool versions. A workflow failure with empty steps/404 logs is inconclusive.
10. Obtain authorized read-only Firebase/GCP runtime inventory; then controlled disposable staging GCS stale-writer 403, upload drain, generation delete, final absence and durable purge ACK.
11. Complete same-SHA authenticated owner C6 grant → private render → protected Replay → revoke → provider-call suppression → physical purge → downstream ACK; then device/accessibility/visual/legal/operations approvals and Founder GO.

**No merge, deploy, dispatch, C6 enablement, private media, IAM/Rules mutation, billing action, paid compute, or production GO.**
