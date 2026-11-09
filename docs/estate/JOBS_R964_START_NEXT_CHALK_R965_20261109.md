# NEXT CHALK — ONE URAI GENESIS R965 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis effort. Preserve original implementations, branches, source history and forensic records. Do not restart the project.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read:
1. `docs/estate/JOBS_R964_ACK_RECEIVER_AND_EVENT_IDENTITY_REVIEW_HOLD_20261109.md`
2. `docs/estate/JOBS_R964_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R963_CANONICAL_REVOCATION_EVENT_ACK_DESIGN_PROPOSAL_20261109.md`
4. `docs/estate/JOBS_R963_MACHINE_CHECKPOINT_20261109.json`
5. `docs/estate/JOBS_R962_R647_DONOR_EXECUTION_READINESS_HOLD_20261109.md`
6. R961 master handoff and R960–R953 reports.
7. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and original START NEXT CHALK.
8. Privacy #214 and #253–#256; Jobs #371, #377, #388–#390 and #379.

## Exact source refs to refresh before action

- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs R923 #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs R900 #377: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs R951 #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs R952 #389: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs R932 #390: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- Privacy R647 #214: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- Privacy R17 #253: `90a4e581e8494f52d85eab3c576d02b926e7d0d9`
- Privacy R18 #254: `dbc193763dc112210c20b5b680e8eb08fdf8396c`
- Privacy R19 #255: `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`
- Privacy R20 #256: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`

All review PRs were open/draft/unmerged at R964 readback. Re-fetch current state. These SHAs do not prove deployment.

## Immediate blocker — donor tests

R647 donor identities:
- Dispatcher: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher test: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`

Two donor test files have 10 and 16 top-level test declarations. They use Node test, TypeScript transpileModule, VM, fake Firestore and mocked transport/HTTP; not Firebase emulator or real network acceptance.

R962 and R964 both tried `git ls-remote`; both failed with exit 128, DNS “Could not resolve host: github.com”. No checkout, dependency installation, test, typecheck or emulator run took place.

At R965:
1. Check whether GitHub DNS/network is available.
2. If yes, clean detached checkout exact R647 head; verify commit/tree and all source blobs before execution.
3. Use locked install and do not modify dependency versions or donor source.
4. Run separately:
   `node --test tests/consent-revocation-jobs-contract.test.mjs`
   `node --test tests/consent-revocation-dispatcher-contract.test.mjs`
5. Run Functions typecheck separately.
6. Capture Node/TypeScript versions, lock identity, commit/tree, raw TAP, exit codes and SHA256 logs.
7. If network still fails, say NOT RUN and preserve exact blocker. Do not synthesize results.

## New R964 design refinements

The R963 v3 event proposal is not approved or implemented. R964 found three issues that need explicit owner review:

1. Privacy R20 ACK callable validates detailHash format but does not recompute it against the Jobs receipt/action; it checks eventId and schemaVersion but not the full immutable outbox digest. v3 must either add receiver-side recomputation or have an explicitly approved trusted-consumer attestation model.
2. R20 eventId digest excludes priorGrantReceiptHash/priorGrantEvidenceState while its integrityHash and replay classifier include them. Decide whether v3 eventId includes the full prior lineage or a separate immutable envelope digest; provide fixed canonical serialization/test vectors.
3. ACK idempotency currently binds actorUid. Define stable service actor identity across retries/deploy rollovers. A successful Privacy ACK commit followed by lost HTTP response must be recognized on retry; a new lease owner must read the identical ACK and safely finalize delivery without creating or overwriting it.

The proposal currently recommends:
- New explicit `consent.revoked.v3`.
- Current source receipt and prior grant receipt/evidence.
- Source transition time with provenance, never outbox createdAt.
- Immutable event/digest separate from mutable delivery leases/retries.
- Privacy per-consumer ACK subdocument as canonical consumer application ACK.
- Jobs HTTP response as transport receipt only.
- Outbox delivery fields as a projection, not independent truth.
- Jobs ACK does not certify storage write denial, upload drain, physical deletion or downstream purge.

This is a proposal, not approved policy. Obtain Privacy/legal/security review before code changes.

## Canonical protocol build order after approval

1. Agree event identity, canonical serialization, digest inputs, source-time provenance and legacy/missing-lineage disposition.
2. Upgrade Privacy publisher and replay classifier.
3. Preserve R647 bounded lease/retry/stale-worker and pinned HTTPS mechanics as donor code, adapted under new envelope.
4. Upgrade Jobs strict Zod receiver and durable local receipt to preserve all lineage.
5. Upgrade Privacy ACK callable to verify full event and Jobs receipt/action binding; define stable token-bound service actor identity and identical-ACK retry semantics.
6. Dispatcher reads canonical ACK before final delivery projection.
7. Add system-only scheduled/task wrapper only after least-privilege identity, secret access, endpoint, retry and deployment provenance are reviewed.
8. Keep separate immutable outbox facts and mutable delivery metadata.
9. Run same-SHA native Firebase Auth/Firestore/Functions/Storage emulator producer → outbox → dispatcher → Jobs block/receipt → Privacy ACK. Include duplicate, stale lease, timeout after Jobs commit, timeout after ACK commit, conflicting ACK, changed consent during transit, missing prior lineage, source time unknown, wrong token consumer and retry exhaustion.
10. Separately run protected nonproduction GCS stale/alternate writer 403, active upload/stream drain, exact generation deletion and durable purge ACK.

## Other independent release gates — do not conflate

- Jobs #377 post-admission operator withdrawal still needs Privacy/legal/security policy.
- Worker auth #388/#389 remains review-only and does not prove deployed HTTP behavior.
- Rollback correction is source-only; exact previous healthy revision restoration is not rehearsed.
- Studio Life Movie consent and private output-write authority remain hard-off.
- R879 58 source pins and 78 command segments are not executed acceptance.
- Protected CI, branch rules, independent reviewer and actionable GitHub logs remain outstanding.
- Deployed source/image, service accounts, ingress, secrets metadata and effective IAM remain unknown.
- Physical GCS denial, upload drain, generation-bound purge and final downstream ACK are separate gates.
- Authenticated C6 lifecycle, devices/accessibility/visual acceptance, vendor/operations and explicit founder GO remain required.

## Work discipline

Classify evidence as immutable source, executed test, prior report, failure/HOLD or unknown. Do not add overlapping historical tests. Do not describe emulator success as effective privileged Storage IAM. Do not equate Jobs ACK with physical deletion. Quarantine source mismatch, missing lineage, unknown source time, ambiguous lease, forged/conflicting ACK or any late-write success.

No cherry-pick unchanged. No merge. No deployment. No dispatch. No private media. No IAM change. No paid compute. No production GO.

Resume R965 with donor execution if network permits; otherwise continue design review and document the exact blocker.
