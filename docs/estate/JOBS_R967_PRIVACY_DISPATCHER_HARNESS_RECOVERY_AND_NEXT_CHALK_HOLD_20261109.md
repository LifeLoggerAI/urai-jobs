# ONE URAI GENESIS — R967 Privacy Dispatcher Harness Recovery and R966 Continuity Reconciliation

**Checkpoint:** R967 · November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Continue from the actual R966 handoff discovered in Jobs forensic PR #379. This is a source-recovery and documentation pass. No code, dispatcher, emulator, cloud or production operation was executed.

## 0. Executive finding

The live Jobs forensic PR #379 had advanced beyond the previous R959 checkpoint and already contained R960–R966 reports. R966's own start page directs the next worker to R967. R967 therefore follows that existing lineage rather than creating a duplicate R960/R966 history.

The central R966/R967 issue is a **source-lineage mismatch**:

- The Jobs R923 emulator harness expects a five-module Privacy implementation, including three files named `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, and `consent-jobs-dispatch.ts`.
- The recovered historical Privacy R647 donor contains a different dispatcher API: `consent-revocation-jobs-dispatcher.ts` plus `consent-revocation-jobs-contract.ts`, exporting `dispatchPendingJobsRevocations`.
- Privacy R20 contains the current publisher/transition lineage but not the three `consent-jobs-*` files.
- The R647/R20 trees are not compatible drop-in sources for the Jobs harness. Do not rename, fabricate or substitute a module to force a test to load.

R967 searched GitHub's indexed code for each missing filename and received zero results in the Privacy repository. It also checked direct file paths across twelve named historical branches in two batches; none of the three files were found in those checked branch trees. This narrows recovery but is **not proof that no dangling or unindexed historical Git object exists**.

The safe next action is exact recovery of the compatible source revision, including its dependency manifest, before any donor or emulator test execution.

## 1. Latest actual handoff lineage

Jobs forensic PR [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) contains:
- R960 R647 → R20 compatibility audit;
- R961 master handoff and machine checkpoint;
- R962 donor readiness audit;
- R963 canonical event/ACK design proposal;
- R964 ACK receiver and event-identity review;
- R965 receipt/ACK/purge-boundary reconciliation;
- R966 emulator-harness and derivative-cleanup reconciliation;
- R966 machine checkpoint and R967 start instructions.

R966 is the latest completed checkpoint found in the live docs tree before this R967 pass. R966 source report blob: `e914bbf9d29a89d3e8e35ab619510cb8340433fa`. R966 machine checkpoint blob: `ec122217bc97e50f67e5aaed5eb782a797e3f57e`. R966 next-Chalk start file blob: `bea2ab091e93a1ee5ff39bca09a476baf942229c`.

Read first:
1. This R967 report and machine checkpoint.
2. R966 emulator harness and cleanup report and checkpoint.
3. R965 ACK/purge boundary report and checkpoint.
4. R964 ACK receiver/event identity report.
5. R963 canonical event/ACK proposal.
6. R962 donor execution readiness.
7. R961 definitive master handoff.
8. R960 dispatcher compatibility report.
9. R959 historical dispatcher recovery, R958 deployment manifest/dispatcher verification, R957 dispatcher discovery, R956 protocol gap, R955 cross-service revocation continuation.
10. R954–R944 Jobs source/runtime/cloud matrix, evidence ledger, taskbook and prior reports.

## 2. Current live GitHub state refreshed by R967

### Jobs
- Main SHA: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- Main tree: `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`.
- Main protection: `protected=false`; protection disabled; required status checks enforcement `off`; no contexts/checks.
- Rulesets query including inherited rules returned `[]`.
- PR #371 Jobs R923: open/draft/unmerged, head `df19633466eaebdda844569ed0d562245bd31dc6`.
- PR #377 Jobs R900: open/draft/unmerged, head `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`.
- PR #388 Jobs R951: open/draft/unmerged, head `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`.
- PR #389 Jobs R952: open/draft/unmerged, head `b865209cc352241602d8b9714672f3401aed7669`.
- PR #390 Jobs R932: open/draft/unmerged, head `e8ba07fc26f154169f2e065d9aa65e77014635d2`.
- PR #386 R949: open/draft/unmerged, head `fd1c8d85acd5cc96ef9fcb300173e362b004eb54`.
- PR #387 R950: open/draft/unmerged, head `04592f8573c708954f95f87ddca1e168efde51f4`.
- PR #384 R946: open/draft/unmerged, head `fd05a376f876f9b835929a2074c09f47638659e2`.

### Privacy
- PR #214 R647 donor: open/draft/unmerged, head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.
- PR #253 R17: open/draft/unmerged, head `90a4e581e8494f52d85eab3c576d02b926e7d0d9`.
- PR #254 R18: open/draft/unmerged, head `dbc193763dc112210c20b5b680e8eb08fdf8396c`.
- PR #255 R19: open/draft/unmerged, head `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`.
- PR #256 R20: open/draft/unmerged, head `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`.

The exact refs are snapshots. Refresh them before any execution. Review PRs are not deployment evidence.

### Jobs documentation PR
At R967 readback before this document write, PR #379 was open/draft/unmerged at head `49d0c611d6b700189236f9b5ae863306dd93021f`, with 58 changed files. Earlier R966 checkpoint and start docs still cite older #379 heads; those are historical snapshots. Refresh after R967 commits.

## 3. R966 Jobs emulator harness — exact required source

Jobs R923 test:
- path: `tests/emulator/privacy-jobs-storage-revocation.test.mjs`
- Git blob: `e9662a979a72a0e39a61fe896a79f8379658d963`
- three top-level tests.

It requires `URAI_PRIVACY_SOURCE_ROOT` to reference a complete installed Privacy source tree containing:
1. `functions/src/consent-revocation-transition.ts`
2. `functions/src/consent-jobs-delivery.ts`
3. `functions/src/consent-jobs-http.ts`
4. `functions/src/consent-revocation.ts`
5. `functions/src/consent-jobs-dispatch.ts`

The harness expects the export `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`.

Test scenarios:
1. Synthetic Jobs delivery performs referenced-object cleanup before Privacy per-consumer acknowledgement.
2. Privacy refuses ACK while a RUNNING/in-flight Jobs attempt remains unresolved, preserves the unresolved marker, and allows retry after lease expiry.
3. Synthetic 110-job / 30-plan workload completes with modeled 85ms per-transaction delay.

Harness behavior/evidence boundaries:
- Uses local Firestore and Storage emulator APIs with synthetic fixtures.
- Wraps actual Jobs `ingestConsentRevocation` in a local loopback HTTP server.
- Mocks Firebase Functions callable/HTTP/trigger wrappers and uses synthetic system token/actor.
- Directly seeds a synthetic `life-movie.render` fixture; this is not an authorized owner grant.
- The Privacy sender/dispatcher source is external and supplied by `URAI_PRIVACY_SOURCE_ROOT`.
- Not live Cloud Run, production IAM, or GCS permissions; not a production consent or physical purge certificate.

Documented reproduction template:
```bash
URAI_PRIVACY_SOURCE_ROOT=/path/to/compatible/privacy-checkout \
firebase emulators:exec --project demo-urai-jobs-cleanup \
  --only firestore,storage \
  'node --test tests/emulator/privacy-jobs-storage-revocation.test.mjs'
```
This is a command template only. R966/R967 did not execute it.

## 4. Historical source recovery results

### 4.1 Code search

GitHub indexed code search against `LifeLoggerAI/urai-privacy` returned zero results for each:
- `filename:consent-jobs-delivery.ts`
- `filename:consent-jobs-http.ts`
- `filename:consent-jobs-dispatch.ts`

Zero indexed results do not establish absence from all Git objects or unindexed history.

### 4.2 Direct branch-path checks

Direct content lookups for all three missing paths were attempted on these Privacy branches; all checked paths returned 404 / not found:

- `review/chalk-converged-jobs-native-source-20261106`
- `review/chalk-r818-native-jobs-privacy-callable-20261106`
- `review/chalk-r823-demo-project-r822-jobs-privacy-20261106`
- `review/chalk-r824-scoped-grant-lifecycle-profile-fences-20261106`
- `review/chalk-r825-privacy-issuer-transport-demo-convergence-20261106`
- `review/chalk-r826-privacy-jobs-r823-immutable-pin-20261106`
- `review/r495-jobs-rights-to-privacy-review-bridge`
- `review/r506-privacy-revoke-to-jobs-storage-derivative`
- `review/r548-current-jobs-private-derivative-four-emulators-20261104`
- `review/r575-jobs264-privacy-native-bridge-20261104`
- `review/r579-jobs264-privacy208-crossrepo-bridge-20261104`
- `review/r583-jobs264-dual-artifact-attestation-convergence-20261104`

The attempt to check the next R647 branch in that batch was cut off by the tool call limit before a complete result was returned; R647's own tree and its exact dispatcher files were independently read by R960–R966.

Remaining source recovery is not yet exhaustive. Continue across older branch pages, historical PR trees, commit ancestry and any referenced cross-repository handoff. Search exact module names and exports, but always fetch a specific source tree and verify full package manifests before classifying a match.

## 5. Why R647 is not a substitute

Privacy R647 #214:
- dispatcher: `functions/src/consent-revocation-jobs-dispatcher.ts`, blob `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- contract: `functions/src/consent-revocation-jobs-contract.ts`, blob `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- dispatcher test: blob `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: blob `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`
- publisher donor: `functions/src/consent-revocation.ts`, blob `5b069b79d657b5c2006dd0ab45c8e60709ff0a89`
- Functions entry: blob `f81171feb058be606be19134928c4baf9830f664`
- head `cc0692053db3b1b8df8267d43856b1a3357de8a0`

R647 exports `dispatchPendingJobsRevocations` via `consent-revocation-jobs-dispatcher.ts`; it is a prepared library, not an installed scheduled dispatcher. It is not the same API or module set expected by Jobs R923 harness.

R960 documented four R647↔R20 incompatibilities:
1. R20 lacks the old dispatch queue fields queried by R647.
2. R20 integrity hash includes prior grant receipt/evidence fields; R647 validates the older digest.
3. R647 projection drops `priorGrantReceiptHash` and `priorGrantEvidenceState`.
4. R647 uses outbox `createdAt` as Jobs `revokedAt`, losing source transition time provenance.

Preserve R647 as donor mechanics. Do not cherry-pick unchanged or run two dispatch loops.

## 6. R963–R965 protocol design — proposal only

R963 proposes a versioned immutable event with full digest, current/prior grant lineage, source transition time and provenance, stable event identity, explicit consumer scope and separate delivery metadata.

R964 refines the ACK receiver:
- Jobs commits owner/purpose consent block and immutable local receipt.
- Jobs response binds event ID/schema/digest, consumer ID, local receipt ID/hash and exact action.
- Privacy trusted ACK callable verifies consumer identity, complete envelope, Jobs receipt/action and existing outbox identity.
- Dispatcher reads ACK back and verifies it before marking delivery projection delivered.
- Lost response after Jobs commit or Privacy ACK commit is recovered idempotently; conflicting ACK goes to needs-review.
- ACK must not imply physical storage purge.

R965 further separates three concepts:
1. Jobs local consent-block receipt.
2. Privacy canonical per-consumer application ACK.
3. Provider-level physical purge evidence.

These are design proposals, not approved/implemented protocol. Privacy/legal/security owner review is still required before new source changes.

## 7. Jobs derivative cleanup findings

Jobs `functions/src/privacy/lifeMovieDerivativeRevocation.ts`, blob `d441b4971d456f2e861b2640067cbde6a2dfff32`, has source-level protections:
- validates server-owned job/plan references, tenant/project/bucket scope;
- generation-pinned deletion with `ifGenerationMatch`;
- handles already-absent generation idempotently;
- refuses to delete unknown/unattributed objects;
- preserves unresolved in-flight attempt markers;
- blocks completion on missing list permission, invalid/excessive scope, or unknown paths.

However:
- prefix listing is point-in-time, not a future-write fence;
- unknown object is not deleted;
- live effective IAM and alternate writers are unknown;
- historical versions, soft deletes, backups, signed URLs and unrecorded derivatives are not comprehensively certified;
- Jobs receiver returns `privateOutputDeletionAcknowledged=false` and `storageWriteFenceVerified=false`.

Do not describe this as full historical erasure or storage revocation certification.

## 8. R966/R967 execution status

R966's `git ls-remote` attempt to Privacy failed with exit 128: `Could not resolve host: github.com`.

R966 therefore did not:
- clone or checkout complete Privacy/Jobs source;
- install dependencies;
- execute R647 10-case or 16-case original Node tests;
- execute the Jobs three-case emulator harness;
- run typecheck/build;
- start Firebase emulators;
- dispatch a revocation;
- inspect deployed GCP resources/effective IAM;
- prove real GCS 403 or physical purge.

R967 was GitHub source/API inspection only. It did not execute tests or run emulators. The Code Search zero-result response and direct 404 path checks are source discovery outcomes, not execution tests.

## 9. Exact R968 execution plan

1. Refresh all branch and PR metadata. Verify current main, forensic PR #379 and cross-chat PR #304; do not rely on R966's old main SHA `9d29be1...`. Current main at R967 readback is `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`; it reverts the one R933 file and its tree matches the prior main tree.
2. Continue searching remaining Privacy branches/PR trees for the exact three `consent-jobs-*` modules. Record complete checked refs and missing-file outcomes. Recover exact module source, package/lock and dependency set. If no exact historical source is found, report “not located in searched refs” rather than inventing code.
3. Compare the recovered three-module implementation, if found, against R647 dispatcher and R20 publisher. Document one canonical architecture, lease/retry behavior, token/endpoint, source-time provenance, immutable event identity and ACK protocol.
4. On a Git-connected host, clean detached checkout exact Privacy R647 and exact Jobs R923; verify commit/tree/blob IDs and lockfiles.
5. Run R647's original 10-case dispatcher-state test and 16-case contract/transport test separately. These are mocked Node tests, not emulators.
6. Run typecheck/build only after locked dependency install succeeds; capture full logs, exit codes, Node/TypeScript/pnpm versions and SHA256.
7. Run the Jobs three-case Firestore+Storage emulator harness only with a Privacy checkout that contains all five exact required modules. Keep this separate from the R647 donor tests. Record each TAP, emulator logs, project and commit identities.
8. Add crash/timeout/idempotency cases for Jobs commit with lost HTTP response, Privacy ACK commit with lost callable response, identical/conflicting ACK, stale lease owner, new lease owner, regrant during transit, unresolved cleanup and legacy missing-lineage.
9. Separately verify real authorized nonproduction GCS late-writer 403, in-flight upload drain, exact-generation deletion and durable final absence acknowledgement.
10. Preserve all other independent release gates: worker auth, post-admission data-rights policy, main branch protection, protected CI, deployed IAM/revision provenance, rollback, C6 consent, accessibility/devices/visual QA and explicit founder GO.

## 10. Release decision and prohibitions

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

No source merge, deployment, revocation dispatch, private-media processing, IAM/Rules mutation, paid compute, customer job or production GO is authorized by R967. Studio consent and private output hard-offs remain in force. Jobs ACK is not physical purge. Emulator success is not effective GCS IAM proof. Unknown does not mean absent.

---
*R967 adds source-recovery observations to R966. Exact branch/module search coverage is listed rather than overstated. Re-fetch all source refs before further mutation.*
