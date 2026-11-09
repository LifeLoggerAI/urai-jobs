# ONE URAI GENESIS — R966 emulator-harness lineage, derivative cleanup boundary and donor execution HOLD

**Date:** 2026-11-09 UTC  
**Disposition:** PRODUCTION HOLD / NO-GO  
**Scope:** refreshed Jobs/Privacy review metadata; read-only GitHub source-tree and file readbacks; retry of R647 Git checkout; characterization of existing Jobs emulator integration harness and Jobs derivative cleanup; documentation only. No runtime changes, local Firebase emulators, tests, endpoint dispatch, provider inventory, IAM, merge, deployment, paid compute or private-media processing.

## 1. Executive result

R966 produces one important correction to the integration map:

**The Jobs repository contains a substantial three-case local Privacy→Jobs Storage-revocation emulator harness, but it is NOT wired to the recovered R647 dispatcher file.** The harness expects a separate Privacy module set:
- `consent-jobs-delivery.ts`
- `consent-jobs-http.ts`
- `consent-jobs-dispatch.ts`

Its loader also requires the separately installed Privacy checkout to provide:
- `consent-revocation-transition.ts`
- `consent-revocation.ts`

The R647 and R20 immutable Privacy trees inspected in R966 contain the publisher/transition files and the historical file `consent-revocation-jobs-dispatcher.ts`, but they do not contain those three `consent-jobs-*` modules. The R647 dispatcher filename and exported API differ from the emulator harness's `consent-jobs-dispatch.ts` / `deliverJobsConsentRevocation`. Do not call these the same dispatcher.

The harness is valuable and should be preserved. It uses real local Firestore and Storage emulators for synthetic records, starts an actual loopback HTTP server, loads the Jobs `ingestConsentRevocation` handler and exercises a separate Privacy delivery callable through mocked Firebase wrapper/auth layers. It does **not** prove hosted Privacy/Jobs delivery, deployed identities, privileged GCS future-write denial or real-user consent authority. It cannot be claimed executed in R966.

R966 also retried `git ls-remote` for the R647 branch. It still fails with exit 128: DNS cannot resolve `github.com`. Donor tests and emulator tests remain NOT RUN.

## 2. Refreshed review graph

All inspected PRs remained open, draft and unmerged at the R966 metadata refresh:

| Repo / PR | Head SHA | Meaning |
|---|---|---|
| Jobs #379 | `dc15eb588d1779600583d932d7b81baa8625311b` before R966 docs | Forensic handoff PR |
| Jobs #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | R923 Jobs convergence |
| Jobs #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | R900 operator-withdrawal reproduction |
| Jobs #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | R951 worker auth |
| Jobs #389 | `b865209cc352241602d8b9714672f3401aed7669` | R952 worker auth regression enrollment |
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | R932 actual Jobs Zod parser test |
| Jobs #386 | `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` | R949 rollback hard stop |
| Jobs #387 | `04592f8573c708954f95f87ddca1e168efde51f4` | R950 Narrator auth |
| Jobs #384 | `fd05a376f876f9b835929a2074c09f47638659e2` | R946 source pins |
| Privacy #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | R647 dispatcher donor |
| Privacy #253 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | R17 stored subject |
| Privacy #254 | `dbc193763dc112210c20b5b680e8eb08fdf8396c` | R18 grant identity replacement |
| Privacy #255 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | R19 prior grant evidence |
| Privacy #256 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | R20 replay collision refusal |

Jobs main remained the prior readback `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. These are source/review identities, not deployment fingerprints.

## 3. Existing Jobs local emulator harness — exact source

File:
`LifeLoggerAI/urai-jobs/tests/emulator/privacy-jobs-storage-revocation.test.mjs`

Immutable Jobs #371/R923 blob:
`e9662a979a72a0e39a61fe896a79f8379658d963`

Size: 14,469 bytes. Contains three top-level Node tests:

1. **Privacy-to-Jobs delivery deletes a referenced object before acknowledging.** Synthetic pending job; invokes a Privacy delivery callable; verifies Privacy per-consumer ACK, active Jobs consent block, derivative receipt object deletion, Jobs output reference removed, queue CANCELLED and local Storage emulator object absent.
2. **Privacy refuses an acknowledgement while an in-flight Jobs attempt is unresolved.** Seeds a RUNNING job, expects delivery to reject with unavailable, confirms no Privacy ACK, active consent block and persistent `consentRevocationInFlightUnresolved`; expires the delivery lease for retry; after retry it confirms the referenced Storage object can be gone while the output reference/marker remain unresolved.
3. **A larger synthetic account completes delivery despite modeled per-transaction latency.** Seeds 110 synthetic jobs and 30 plans and injects 85ms before Jobs Firestore transactions. This is a modeled latency fixture, not a production latency or arbitrary-account scaling guarantee.

### 3.1 Exact harness wiring

The test requires `URAI_PRIVACY_SOURCE_ROOT` pointing to an installed Privacy checkout. It builds a separate `createRequire` from each repository's Functions package and loads TypeScript files with `ts.transpileModule` and a VM loader.

The external Privacy source root must supply all five modules:
- `functions/src/consent-revocation-transition.ts`
- `functions/src/consent-jobs-delivery.ts`
- `functions/src/consent-jobs-http.ts`
- `functions/src/consent-revocation.ts`
- `functions/src/consent-jobs-dispatch.ts`

The Jobs side loads:
- `functions/src/privacy/consentBlocks.ts`
- `functions/src/privacy/lifeMovieArtifactRefs.ts`
- `functions/src/privacy/lifeMovieDerivativeRevocation.ts`
- `functions/src/privacy/consentRevocation.ts`

It then:
- requires local Firestore and Storage emulator hosts;
- creates separate demo Privacy and Jobs Firebase app IDs;
- wraps the real local Firestore Admin calls in adapters;
- transpiles and VM-loads the Jobs receiver and cleanup source;
- wraps the Jobs HTTP handler in a Node loopback server;
- passes a synthetic event token and synthetic system/consumer actor;
- points the Privacy transport at the loopback HTTP endpoint;
- calls the separate Privacy callable `deliverJobsConsentRevocation`.

**This is not the R647 donor dispatcher.** R647 exports library method `dispatchPendingJobsRevocations(transport, dependencies)` in `consent-revocation-jobs-dispatcher.ts`; the emulator harness expects `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`. They have distinct file/module names, API shape, queue model and call path.

### 3.2 Module availability comparison

The R966 recursive tree readback for:
- Privacy R647 #214 head `cc0692053db3b1b8df8267d43856b1a3357de8a0`;
- Privacy R20 #256 head `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`;

found:
- R647 `consent-revocation-jobs-dispatcher.ts` and `consent-revocation-jobs-contract.ts`;
- no `consent-jobs-delivery.ts`, `consent-jobs-http.ts` or `consent-jobs-dispatch.ts`;
- R20 tree does not contain either the R647 dispatcher/contract modules or the `consent-jobs-*` modules.

Other historical Privacy PR trees #192 and #232 were also checked; those contained the R647 dispatcher name but not the three modules expected by this Jobs harness. The exact compatible Privacy checkout/branch from which the three modules were meant to be loaded remains UNKNOWN.

Do not assume the current R647 or R20 checkout will satisfy `URAI_PRIVACY_SOURCE_ROOT`. First recover and source-pin the exact matching Privacy module set and package dependencies, or adapt the harness through a reviewed change. Do not rename or substitute R647 dispatcher code just to make the test load.

## 4. Emulator test evidence boundary

The harness uses real local Firestore and Storage emulator APIs for synthetic fixture data and operations. However:
- it mocks Firebase Functions trigger/callable/HTTP wrappers;
- it uses a synthetic system token/actor;
- it creates a synthetic purpose `life-movie.render` directly in the fixture; its own comments say Privacy does not register this purpose and this is not an authorized grant;
- it uses a local HTTP server rather than a hosted Jobs endpoint;
- the Privacy sender/dispatcher implementation is external to the Jobs repository and must be recovered via `URAI_PRIVACY_SOURCE_ROOT`;
- it does not run Cloud Run/Firebase deployed IAM or Google Cloud Storage production permissions.

The exact Jobs repo documentation `docs/CONSENT_REVOCATION_REPLAY.md` (blob `31886c5ce46a39f2a0424aa377c157874a62ac84`) explicitly documents this limitation and gives the command:

```bash
URAI_PRIVACY_SOURCE_ROOT=/path/to/compatible/privacy-checkout \
firebase emulators:exec --project demo-urai-jobs-cleanup \
  --only firestore,storage \
  'node --test tests/emulator/privacy-jobs-storage-revocation.test.mjs'
```

Use the exact documented project/config prerequisites from the repository and verify the external Privacy source files before running. The command above is a reproduction template, not an execution receipt.

## 5. Jobs derivative cleanup — source-level strengths and open gap

Jobs #371 file:
`functions/src/privacy/lifeMovieDerivativeRevocation.ts`
blob: `d441b4971d456f2e861b2640067cbde6a2dfff32`

Verified source behavior:
- Cancels matching Jobs and long-form plans and marks matching derivative access revoked.
- Validates output references and binds each to server-owned job tenant/project and allowed bucket.
- Pins observed GCS object generations and deletes using an `ifGenerationMatch` precondition.
- Handles already-absent generations idempotently; generation mismatch with a replacement object produces reconciliation error.
- Scans canonical tenant/project attempt prefixes for unattributed outputs; does not delete unknown objects.
- Refuses completion when list permission is missing, scope is invalid/excessive, or unknown objects remain.
- Marks RUNNING/LEASED and unresolved attempts with `consentRevocationInFlightUnresolved`; keeps the marker on retries until separately reconciled.
- Waits for bounded Firestore/Storage batches to settle before erroring to avoid retry racing in-flight mutations.
- Returns `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false` even in its summary type.

The module itself comments that a successful Storage prefix listing is only a point-in-time check, not a future-write fence.

### 5.1 The in-flight unresolved case is intentionally nonterminal

The emulator test explicitly confirms an unresolved RUNNING attempt does not receive the Privacy ACK even though the known referenced object can be deleted. The output reference and unresolved marker remain for reconciliation. This is safer than falsely completing deletion, but a durable, source-pinned reconciliation owner/procedure remains required; clearing the marker by hand is not proof.

### 5.2 Full historical erasure is not covered

The Jobs replay documentation explicitly states this candidate does not prove:
- all unrecorded artifacts from past attempts were found;
- every object version or soft-deleted object was purged;
- signed URLs were invalidated;
- backups were removed;
- all unpaginated owner-wide scans complete at arbitrary account size/hosted latency;
- a stale privileged writer cannot finalize a future/late upload.

This is selected derivative cleanup, not total data erasure.

## 6. Relation to R647/R20 and v3 design

The R647 donor remains a distinct prepared dispatcher with bounded scan/lease/retry and pinned Jobs HTTPS transport. R960 incompatibilities remain:
1. R20 publisher omits R647 query queue fields.
2. R20 integrityHash includes prior grant evidence; R647 contract validates the older digest.
3. R647 v2 mapping drops priorGrantReceiptHash/priorGrantEvidenceState.
4. R647 maps outbox createdAt into revokedAt.

The three-module `consent-jobs-*` path referenced by the Jobs emulator harness may embody a different delivery/ACK architecture from the R647 donor. Before any implementation, recover that exact Privacy source lineage and compare it against R647 and R20:
- delivery projection / event mapping;
- HTTP endpoint/auth/timeout;
- lease and retry semantics;
- canonical Privacy ACK creation;
- Jobs receipt interpretation;
- source timestamp handling;
- replay/identity checks.

Do not combine both dispatcher architectures implicitly or allow two active delivery loops on one outbox. Decide which mechanics and data model survive in a new reviewed version.

R963/R964 proposal remains design only: v3 immutable envelope, prior-grant lineage, explicit source time, separate delivery metadata, canonical Privacy ACK with full digest/Jobs receipt/action binding, stable consumer identity and crash-safe idempotent ACK recovery. Not approved or implemented.

## 7. R966 Git/network attempt and actual execution status

Attempted:
`git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104`

Actual result: exit code 128, `Could not resolve host: github.com`.

Therefore R966 performed:
- PR metadata refresh;
- exact source/tree/file readbacks;
- 3-case harness source inspection;
- Jobs derivative-cleanup and replay-document inspection;
- no-checkout DNS retry.

R966 did **not**:
- clone or checkout Privacy/Jobs;
- run donor Node tests;
- run the three-case emulator harness;
- install dependencies or typecheck;
- start Firebase emulators;
- call any HTTP provider;
- inspect deployed GCP resources/IAM;
- dispatch a revocation or process media.

Do not report any new test pass from R966.

## 8. Next Chalk R967 exact priorities

1. Recover the exact compatible Privacy revision expected by the Jobs harness. Search historical branches/commit ancestry for all three modules `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, `consent-jobs-dispatch.ts`. Verify commit/tree/blob IDs and exact package-lock/dependencies. If no source revision exists, report that and create a review-only harness alignment plan; do not invent module substitutes.
2. Compare the historical three-module dispatcher with R647's `consent-revocation-jobs-dispatcher.ts`. Document source ancestry, publisher fields, ACK model, token/endpoint and lease/retry behavior. Choose one delivery architecture only after review.
3. On a Git-connected host, clean detached checkouts and locked dependency installs; execute the R647 10 + 16 original Node tests separately. Keep them separate from the Jobs three-case Firebase emulator harness.
4. For the emulator harness, supply a Privacy checkout containing its exact required modules; use exact Jobs #371 source, local Firestore+Storage emulators and the documented demo project. Capture each test TAP, emulator log, exit code, Node/TS versions, commit/tree and file hashes. Do not call synthetic direct fixture insertion a positive consent grant.
5. Preserve the tested split: Jobs consent-block receipt; Privacy per-consumer application ACK; physical Storage purge evidence.
6. Add explicit tests for ACK timeout after commit, duplicate/retry ACK, conflicting ACK, new lease owner after lost response, unknown/in-flight derivative cleanup and persistent reconciliation markers.
7. Separately obtain authorized read-only cloud inventory, then approved nonproduction GCS stale/alternate writer 403, upload drain, generation-bound purge and durable final absence ACK.
8. Continue worker auth, operator-withdrawal policy, CI/protection, deployment/rollback, C6 lifecycle, devices/accessibility/visual and founder GO as independent release gates.

## 9. Final R966 classification

**Confirmed:** Jobs three-case local cross-service emulator harness exists and its exact wiring requires a different five-module Privacy source set; R647 dispatcher is not that module; current R647/R20 trees do not contain the three expected `consent-jobs-*` modules; Jobs derivative cleanup is generation-aware and fails closed on unresolved attempts/unknown objects, but cannot certify future-write denial or full historical erasure.

**Unknown:** exact compatible Privacy source revision for the harness; whether another unindexed branch/checkout contains its modules; deployed dispatcher/Functions revisions; actual GCS effective IAM and stale/alternate writer behavior.

**NOT RUN:** R647 donor Node tests, Jobs emulator harness, typecheck/build, cloud/provider inventory and real GCS acceptance.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. ONE URAI GENESIS — PRODUCTION HOLD.**
