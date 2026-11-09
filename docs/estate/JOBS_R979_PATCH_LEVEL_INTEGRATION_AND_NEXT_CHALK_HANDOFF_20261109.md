# ONE URAI GENESIS — R979 CURRENT PATCH-LEVEL INTEGRATION RECONCILIATION AND NEXT CHALK

**Date:** 2026-11-09; **release:** PRODUCTION HOLD / NO-GO.  
**Parent handoff:** docs/estate/JOBS_R978_COMPLETE_CROSS_CHAT_RECONCILIATION_AND_INTEGRATION_HANDOFF_20261109.md  
**Scope of this checkpoint:** connected GitHub PR metadata, three actual PR patches, previously verified Labs R946/R950 and R945 records, and documentation only. No native tests, source modifications, deployment, provider access, private media, CI dispatch or paid compute.

## 1. Verified PR source heads in this checkpoint

| Repository PR | SHA | State | Changed files per PR metadata |
| --- | --- | --- | --- |
| Jobs #379 forensic docs | 70689793fecb52cf92944239329880887d46cc88 | open/draft | 105 |
| Jobs #383 consolidated acceptance | 1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c | open/draft | 4 |
| Jobs #384 source-pin and late-write harness | fd05a376f876f9b835929a2074c09f47638659e2 | open/draft | 4 |
| Jobs #391 producer/Zod test correction | 9f5759f072370fbd42a82560ff6c5d4f37169c6b | open/draft | 1 |
| Jobs #253 direct worker hard-off | 0789c47a6cfd8c5c1bf0f978243c087f52b11076 | open/draft | 5 |
| Jobs #254 reservation emulator | 4b1f60998f01f3b2d659f1a7898a03984547ec6d | open/draft | 2 |
| Jobs #255 deterministic race model | cb34ec72afe5aa451e5f5102ec0dc0648183b970 | open/draft | 2 |
| Jobs #381 Rules correction | a295fd834c1cc01710a36b04523b023de2283240 | open/draft | 6 |
| Privacy #257 R27 | fbdc590376376b758be968f174d71709f326c61f | open/draft | 10 |
| Studio #201 path correction | a6187abfd12ffc8f534ddf66246da91ed032e1dc | open/draft | 2 |
| Labs #262 master | 5be84013d406299872610ca423090a16760e62b9 | open/draft | 200 |

These are snapshot heads, not immutable future claims. Re-fetch before write, merge or tests.

## 2. Actual patch inspected: Studio #201

Actual two-file patch (not just a PR title): apps/studio/lib/studio-life-movie-jobs-bridge.ts changes safeSegment validation from rejecting only exact '.'/'..' to rejecting **any embedded '..'**, while preserving whitespace, slash, backslash and UTF-8 byte-length checks. Test apps/studio/tests/life-movie-jobs-parser-normalization-boundary.test.mjs adds tenant 'tenant..one' with matching objectPath and expects life_movie_invalid_tenant; printed expected check count changes 34→35. This is a narrow producer-side path safety fix, not an issuance of consent or enablement of dispatch. Current exact-head native suite NOT RUN in this checkpoint. Preserve test coverage for projectId as well as tenantId in full native verification.

## 3. Actual patch inspected: Jobs #391

One-file patch scripts/studio-life-movie-actual-producer-zod-contract.test.mjs repairs over-escaped JavaScript regex literals matching the pinned Studio dispatch route: callStudioJobsBridge, tenantId, userId, idempotencyKey, payload and the absence of a consent field. This is a **test-correctness change**, not a consumer schema change. Labs R945 separately records 3/3 actual candidate-Zod tests passing at exact #391 head. The producer still omits canonical consent, while the consumer candidate requires it; current main schema also rejects generation and sourceStartMs. Therefore the true cross-service integration remains denied. Never synthesize consent or remove required schema checks merely to make tests green.

## 4. Actual patch inspected: Jobs #381

PR #381 includes docs/security/R942_DELETION_REQUEST_ID_RULES_FIX_REVIEW_HOLD_20261109.md, a real firestore.rules change to protect server-owned dataRightsDeletionRequestId in affectedKeys(), static authority tests, a native authenticated owner Rules test source and runner source pin updates. The PR's own R943 evidence explicitly distinguishes the **15/15 original Node static test** (run against exact returned blobs) from a syntax-only check of the native emulator test; native authenticated test was NOT RUN. No actual deployed Rules readback. The denial must apply to both mutation/removal on existing records and creation on legacy records, while authorized service updates and benign owner profile changes remain permitted. Rules denylist versus positive allowlist is a separate review concern.

## 5. P0 Storage boundary remains unresolved

Labs master R946/R950 actual recorded evidence: #253 hard-off 4/4; #254 reservation emulator 11/11; #255 race model 17/17; #384 negative late-write emulator 10/10, with privilegedBypassObserved=true, storageLevelFenceVerified=false, productionAuthorized=false. A privileged Admin Storage writer recreated bytes after revocation and empty inventory, including with zero outstanding reservations. Emulator generation-precondition behavior is not evidence of real GCS semantics. No real staging GCS 403, IAM retirement, durable in-flight upload drain, all-bucket generation reconciliation or deletion ACK. Jobs issue #252 OPEN P0; no private output writes.

## 6. Integration dependency and ownership map

| Dependency | Producer | Consumer / authority | Required exact next acceptance |
| --- | --- | --- | --- |
| Owner-scoped consent | Spatial/owner request + Privacy | Privacy R27 / Studio | Authenticated service-to-service denial tests and a reviewed positive-grant design, still hard-off |
| Normalized plan | Studio #201 | Jobs parser candidate | Native exact-head Studio 35-case test, exact producer+consumer Zod, immutable source refs and no traversal |
| Jobs admission | Jobs | Jobs Rules and service operator | Jobs #381 native Auth/Firestore Rules, Jobs #376 continuation, #337/#372 authority, #345 quota |
| Render/private output | Jobs worker | GCS sole broker | #252 real storage IAM 403, reservations, monotonic fencing, active upload drain, no stale writes |
| Replay | Spatial | Protected storage/Privacy | Fresh owner+scope+consent+epoch authorization per request; no public/cached bypass |
| Revocation/deletion | Privacy | Jobs/Storage/Replay downstream | Signed events, retries/idempotency, generation-pinned deletion, durable ACK, no post-revoke writes |
| Release | Labs registry + protected CI | Independent reviewer/founder | Same SHA source/build/deployed revisions, devices, accessibility, visuals, rollback, backups, legal |

**Integration decision:** do not merge or enable positive render in order to get superficial green tests. Resolve contracts and prove the negative security boundaries first.

## 7. Next Chalk sequence

1. Read R978 and R979; inspect Labs master #262, R945 and R946/R950, Jobs #379/#383/#384, Privacy #257, Studio #201 and open issues #252/#380/#376/#372/#337/#345.
2. Refresh main/PR SHAs, ancestry, effective protection and hosted job steps; identify current code versus unmerged donor.
3. Execute original Studio #201 exact-head normalization suite and Jobs #391 producer/Zod tests in clean source-pinned Node/pnpm environment; record command, exit, TAP, SHA256, lockfile, tree and clean worktree.
4. Run Jobs #381 original authenticated Firestore/Auth emulator test on disposable isolated credentials, then exact #383 17-case/77-command suite; preserve native failure evidence.
5. Implement the #252 sole broker/fence on a separate reviewed source branch; test late writes, stale principals, interrupted/resumed uploads and generation-pinned purge; real GCS negative IAM probe only with separate authorized disposable staging.
6. Reconcile consent and source generation schema through explicit reviewed contracts, not bypasses; preserve Privacy and Jobs hard-offs.
7. Reconcile 19 repository donor inventory, Firebase source publisher conflicts, protected CI, independent signoff, user-data backups and private-memory owner-only replay.
8. Document each new result in Labs master and Jobs forensic lane, with an exact-machine checkpoint and a next-worker start; do not overwrite parallel workers.

## 8. Work actually done

Read live PR metadata for eleven review branches, inspected actual patches of Studio #201, Jobs #391 and Jobs #381, reconciled them against the prior R978 report and source-pinned R945/R946/R950 receipts. Wrote documentation on the Jobs #379 forensic branch only. **No application source edits, native execution, CI dispatch, merge, deploy, provider/IAM/Rules changes, consent grants, private-media access or paid compute.**

**Final disposition: HOLD / NO-GO.**
