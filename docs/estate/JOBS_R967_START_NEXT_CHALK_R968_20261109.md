# NEXT CHALK — ONE URAI GENESIS R968 CONTINUATION COMMAND

**R967 addendum / correction:** Live Jobs `main` is `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`, not the stale `9d29be1...` repeated in some earlier R967 source tables. Commit #2bcdbcf reverts the single accidental 90-line R933 test file; resulting tree matches the earlier main tree. The revert is unsigned. Branch protection remains disabled and required checks off.

The R967 machine checkpoint was corrected with this live main SHA/tree, governance readback, zero GitHub code-search results for the three missing module names, and 12 extra branch-path checks. Those branch checks found no matching files; absence is scoped to inspected refs, not every possible Git object.

Canonical Jobs R967 full source report: [JOBS_R967_PRIVACY_DISPATCHER_HARNESS_RECOVERY_AND_NEXT_CHALK_HOLD_20261109.md](JOBS_R967_PRIVACY_DISPATCHER_HARNESS_RECOVERY_AND_NEXT_CHALK_HOLD_20261109.md). Supplemental reconciliation: [JOBS_R967_PRIVACY_DISPATCHER_HARNESS_RECOVERY_AND_NEXT_CHALK_HOLD_20261109.md](JOBS_R967_PRIVACY_DISPATCHER_HARNESS_RECOVERY_AND_NEXT_CHALK_HOLD_20261109.md). Machine record: [JOBS_R967_MACHINE_CHECKPOINT_20261109.json](JOBS_R967_MACHINE_CHECKPOINT_20261109.json).

---

# NEXT CHALK — ONE URAI GENESIS R968 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis. Preserve original code, histories, branches and forensic records. Do not restart or rebuild known implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read in order:
1. `docs/estate/JOBS_R967_HISTORICAL_PRIVACY_HARNESS_PROVENANCE_AND_RUNTIME_GATE_HOLD_20261109.md`
2. `docs/estate/JOBS_R967_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R966_EMULATOR_HARNESS_AND_DERIVATIVE_CLEANUP_RECONCILIATION_HOLD_20261109.md`
4. R965 receipt/ACK/purge report, R964 ACK/event identity report, R963 v3 design proposal.
5. R962 donor execution readiness, R961 master, R960–R953.
6. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and original START NEXT CHALK.
7. Privacy #83, #192, #213/#214, #229/#230/#232, #253–#256.
8. Jobs #371, #377, #379, #384, #386–#390.

## R967 result: three different integration lineages

### A. Jobs #371 three-case emulator harness

Exact Jobs test blob:
`tests/emulator/privacy-jobs-storage-revocation.test.mjs`
`e9662a979a72a0e39a61fe896a79f8379658d963`

Requires `URAI_PRIVACY_SOURCE_ROOT` with five modules:
- `consent-revocation-transition.ts`
- `consent-jobs-delivery.ts`
- `consent-jobs-http.ts`
- `consent-revocation.ts`
- `consent-jobs-dispatch.ts`

It expects `deliverJobsConsentRevocation` from the last module. Three tests exercise local synthetic delivery, unresolved in-flight work refusing ACK, and a synthetic 110-job/30-plan workload with injected latency.

It uses real local Firestore/Storage emulator APIs and an actual loopback HTTP wrapper around Jobs `ingestConsentRevocation`, but Firebase trigger/callable wrappers, token and actor are mocked. The grant fixture is directly inserted synthetic data, not a real positive consent grant. It is not production or IAM acceptance.

**Critical:** R967 found no `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, or `consent-jobs-dispatch.ts` in the exact trees for Privacy R506/#192, R583/#213, R647/#214, R818, R819, R823–R826, R834, R836 or R20/#256. GitHub path-specific commit-history queries for all three paths returned empty arrays. Do not substitute a similar module and call it recovered.

### B. Privacy R647 donor dispatcher

Exact Privacy #214 head:
`cc0692053db3b1b8df8267d43856b1a3357de8a0`

- `consent-revocation-jobs-dispatcher.ts`: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- `consent-revocation-jobs-contract.ts`: `6cca2b9456319927cf22511c7d51c1f16ddf051c`

Exports `dispatchPendingJobsRevocations`, not `deliverJobsConsentRevocation`. It is prepared donor code explicitly NOT DEPLOYED. Keep it separate from A until source history proves equivalence or the owners select an integration path.

R960 incompatibilities with R20 remain: absent legacy delivery queue fields, changed integrity-hash inputs, dropped prior-grant evidence, and `createdAt` wrongly used as revocation time. Never cherry-pick unchanged.

### C. Privacy R818/R836 maintained native acceptance lineage

Important exact refs:
- R818 `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed`
- R819 `dbe0b9df13cf7c25f1390fe13ae649908c695a15`
- R823 `2fe7ae334eb669af7d45cd1f4741a1be87ce9f73`
- R824 `03e48cbe8e1aaf25934b0e6cbf504552472f03bb`
- R825 `3f336b346ea899062ede6f41bb8dad44ba6de7e3`
- R826 `ccf5f5b2a2370ec25f5c32f37ce5d33e29ed2da9`
- R834 #229 `79e71fd6137947d2ed7c416a2596090572fef978`
- R836 #232 `e1e2dee63c39590d343d727aa53618ac97a52691`

Contains `scripts/run-r818-native-jobs-privacy-acceptance.sh` and `tests/integration/life-movie-jobs-native-transport.emulator.mjs`, not the missing `consent-jobs-*` modules.

R836 runner requires exact clean Privacy/Jobs source, frozen installs, Jobs owner/status regression, complete Jobs typecheck/build and its original callable-denial/review-only issuer emulator path. Its PR body reported full 4-emulator acceptance NOT RUN on R836 because Functions worker Unix socket creation returned EPERM; CI had no executable-step certificate. Do not transfer earlier parent passes to R836.

## Immediate R968 priority

1. Recover exact provenance of the three missing `consent-jobs-*` modules from an identified original workspace/archive/repository. Search only with grounded evidence. Do not recreate and claim recovered.
2. Inspect GitHub issue #83 and keep it open until protected deployed decision service, downstream revocation ACK and provider-call prevention are evidenced. The original July issue body is stale as source status; later comments say canonical source exists but protected runtime remains a gate.
3. Compare A, B and C as separate source/contract lineages. Choose one after exact file, API, queue, lease, timestamp, ACK and ancestry reconciliation.
4. When GitHub connectivity is available, clean detached checkouts at exact heads; verify commit/tree/blob hashes and lockfiles.
5. Run separately: R647 dispatcher Node test (10 top-level tests), R647 contract Node test (16 top-level tests), Jobs #371 three-case emulator harness only if compatible Privacy source is recovered, and R818/R836 maintained native runner. Capture raw logs, source SHAs/trees, Node/TypeScript/Java/Firebase versions and exits.
6. Do not call synthetic direct fixtures positive consent grants.

## R967 environment limitation

Direct container command:
`git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104`

Result: exit 128, DNS `Could not resolve host: github.com`. No clone, installs, tests, typecheck or emulators. This is an access blocker, not a test failure. Retry only when environment/network changes.

## Exact current baseline refs to refresh

- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs #377: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs #389: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs #390: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- Privacy #214 R647: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- Privacy #232 R836: `e1e2dee63c39590d343d727aa53618ac97a52691`
- Privacy #256 R20: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`

All review branches were open/draft/unmerged at R967 readback. Re-fetch before action; none proves deployment.

## Independent Jobs derivative cleanup boundary

Jobs #371 `functions/src/privacy/lifeMovieDerivativeRevocation.ts` blob `d441b4971d456f2e861b2640067cbde6a2dfff32`:
- generation-pinned deletion;
- scope validation to tenant/project/approved buckets;
- unknown/unattributed objects are not deleted;
- unresolved RUNNING/LEASED attempts keep a persistent marker;
- listing is point-in-time, not future-write denial;
- `privateOutputDeletionAcknowledged=false` and `storageWriteFenceVerified=false`.
Full historical erasure, object versions/soft deletes, signed URLs, backups and late privileged writes remain unproven.

## Other independent release gates

- Privacy #83 protected deployed consent decision/revocation, downstream ACK and provider-call suppression.
- Canonical v3 event/ACK proposal R963/R964/R965 is not approved or implemented.
- Operator-withdrawal behavior #377 needs Privacy/legal/security policy.
- Worker auth #388/#389 remains review-only.
- Rollback exact healthy revision restoration unproven.
- Studio private render consent/output-write authority remains hard-off.
- R879 58 source pins and 78 command segments are not completed test execution.
- Protected CI, branch rules, independent reviewer, deployed source/image, service identities, secrets, ingress and effective IAM unknown/open.
- Real nonproduction GCS stale/alternate writer 403, upload drain, generation purge and durable final ACK separate.
- Authenticated C6 lifecycle, physical devices/accessibility/visual acceptance, external operational gates and founder GO remain.

## Documentation requirement

Create R968 full report, JSON machine checkpoint and R969 copy-paste start prompt in Jobs forensic PR #379 branch `docs/genesis-jobs-firebase-forensics-20261109`. Include exact readback hashes, newly recovered source provenance, raw test logs if actually run, and explicit NOT RUN statuses. Read all three artifacts back from GitHub before reporting complete.

No merge, deployment, dispatch, private-media processing, IAM change, paid compute or production GO.
