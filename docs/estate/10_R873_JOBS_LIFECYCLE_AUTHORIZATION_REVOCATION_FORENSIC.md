# R873 — Independent Jobs lifecycle, authorization and revocation forensic review
Checkpoint: 2026-11-07 UTC. Source review, new 1,011-byte original-file independent smoke, no application mutation.
**REVIEW ONLY — Jobs security #252 OPEN — PRODUCTION HOLD.**

## Exact ownership and source pins

- Master private estate registry: LifeLoggerAI/urai-labs-llc [draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), observed review head 3496b335ba3d71750900153c3b0e84c665c016c0. Consulted the registry start, worker protocol, inbox, evidence standard, cross-system ledger and next handoff. The newer master docs are on a DRAFT branch, not current Labs main.
- Jobs permanent main: 9d29be1bcd3a45a4b9a743df9c9706c00811f38b. Executable review candidate: [#320](https://github.com/LifeLoggerAI/urai-jobs/pull/320), ea8f0165ac74511a4e4196919ddd3109d0c1ff2e, tree 3e74b4b0d6e10df15f9ccd747e9e936218b7fc25.
- Prior historical handoff [#312](https://github.com/LifeLoggerAI/urai-jobs/pull/312) at cd1e46cb5a095dc6337c7d5c6bb4c74a403afcd9 preserves separate R825 receipts. Docs bootstrap [#323](https://github.com/LifeLoggerAI/urai-jobs/pull/323) f10592ca8af4e2d5f0d15179fc3637c457286038. Tracked-tree evidence [#324](https://github.com/LifeLoggerAI/urai-jobs/pull/324) 49d168350ef44f05e3af7fcd3f626741a3a53ca2; THIS R873 documentation branch extends #324, not runtime #320, and overwrites no peer.
- Current original metadata inventory: Git recursive tree truncated=false; 1,393 tree entries, **1,177 blob paths + 216 directories; 5,137,055 Git-reported bytes; 831 distinct blob IDs**. Main has 1,049 inventoried blob paths; #320 compared to main has 1,008 unchanged, 41 modified, 128 added, zero removed. The path/size/Git SHA/mode ledger is the existing [MANIFEST.json](MANIFEST.json), not regenerated here.
- Latest pinned R861 cumulative attestation from #324: **636/1,177 tracked path instances, 290/831 distinct blobs and 1,625,325 unique raw bytes** independently rehashed by prior workers, zero mismatch. 541 distinct blobs lack actual-byte certificate. R873 separately rehashed only the same known 1,011-byte write gate; DO NOT add 1 to 290 or 1,011 to 1,625,325.
- R859 complete visible ref-tip pagination: pages 100+100+100+100+100+100+95+0, **695 distinct refs: 303 branch heads, four tags and 388 other refs, 416 unique tip SHAs**, see [R859_VISIBLE_GITHUB_REFS.json](attestations/R859_VISIBLE_GITHUB_REFS.json). This is NOT all reachable commit contents, deleted/unreachable objects, external LFS payloads, local ignored files, complete history or actual binary inspection. R857 attempted full git mirror failed before tests due OCI disk quota. The archival _audit/20260416 objects must not be deleted as duplicate scaffolding.
- Relevant content directly read at the frozen original #320 source: functions/src/index.ts; core/auth.ts, core/types.ts, core/jobRegistry.ts, core/runtimeJobTypes.ts; jobs/createJob.ts, executeJob.ts, processQueueTick.ts, retryExpiredLeases.ts, cancelJob.ts, getJob.ts, getJobStatus.ts, admin.ts, admin-v2.ts, cleanupTerminalJobs.ts, executionGuards.ts, lifeMoviePrivateDeliveryContract.ts; events/onJobTerminalEvent.ts, publishJobTerminalEvents.ts; privacy/consentRevocation.ts, lifeMovieConsentGate.ts, lifeMovieDerivativeRevocation.ts, lifeMovieOutputGeneration.ts; workers/studio-worker/private-output-write-authority.js; Firestore/Storage rules; original package scripts, four-emulator and Studio bridge runners, production deploy workflow. Other original files including large source and historical bodies were NOT read word-for-word; complete semantic and history coverage is **partial**.

## Reconstructed processing lifecycle (from original candidate source)

1. **Admission:** createJob validates Firebase caller + current server-owned user profile and jobs:create permission/operator role, owner deletion flag, schema, idempotency fingerprint, payload size, per-user rate limit and opaque source/consent context. Within a Firestore transaction it rereads the owner and creates jobs/{id}, jobQueue/{id}, created log and optional jobIdempotencyBindings. Generic studio.render.video/assemble.video creation is denied; authenticated dedicated Studio bridges own the protected child/assembly path.
2. **Scheduling and dispatch:** processQueueTick selects eligible PENDING records; transaction reads job/queue and checks owner/consent blocks, leases both with an exact token, publishes to Pub/Sub job-execution, and compensates publish failure. Movies defer while lifeMovieConsentAuthorityAvailable() is false.
3. **Execution:** executeJob parses the message, checks start/terminal/token guards and current consent, chooses worker from runtimeJobTypes or supported provider path, records active progress and finalizes only with the current lease. Inline fallback is restricted to local testing and is disabled for all private-source jobs and production; synthetic gs://urai-jobs-inline-artifacts paths are NOT real output.
4. **Cancellation/retry:** cancelJob transaction marks PENDING/LEASED/RUNNING cancelled and the queue cancelled; long-form bridge propagates to pending children/assembly. retryExpiredLeases every minute requeues ONLY same-token expired *unstarted* leases. The executeJob local failure handler implements active transactional retry/dead behavior. Old functions/src/jobs/handleJobFailure.ts performs separate writes but is not the current exported execute handler; do not assume its path runs.
5. **Receipts:** onJobTerminalEvent watches status transitions to SUCCESS/FAILED/DEAD/CANCELLED, creates idempotent terminal event outbox records. publishJobTerminalEvents leases, retries and publishes bounded messages to job-terminal-events; cleanupTerminalJobs removes terminal queue entries. A durable outbox is NOT proof of production exactly-once consumers.
6. **Revocation:** ingestConsentRevocation verifies inbound bearer/event/ordering, atomically persists block/receipt, then calls lifeMovieDerivativeRevocation. The latter cancels attributable work, generation-fences known Storage objects, deletes exact generations, rechecks path absence and bounded owner/tenant/project orphan inventory; in-flight and unknown outputs fail closed. This is a point-in-time deletion guard, **not an enforceable future GCS-write denial**.
7. **Private film/Replay:** lifeMovieConsentGate.ts returns false, and workers/studio-worker/private-output-write-authority.js always returns false with a fixed denial. lifeMoviePrivateDeliveryContract.ts validates request shape ONLY; no positive owner/rights authorization or actual protected MP4/SRT delivery is shown. Old signed-download endpoints remain closed. Never call a synthetic negative acceptance a positive live film.

## Registry and job-type census

- Legacy jobRegistry.ts has **26 typed legacy jobs**, categorized Spatial 3 / Studio 3 / Narrator 3 / Asset Factory 4 / Career 10 / System 3, and older JobDoc state names CREATED, QUEUED, RETRY. Retain these historical implementations.
- Current runtimeJobTypes.ts contains **12 active named types**: narrator.tts; asset-render and asset.render; studio.render.video and studio.assemble.video; communications.message.send; memory.private-source.transcribe, .index and .reconstruct-place; web.search, web.fetch and web.agent. createJob permits only this active set, and Studio types additionally need dedicated bridge. Active type registry does NOT mean corresponding worker is deployed, provider spend approved or data permitted.
- Next authoritative census must link each older vs active type to Functions export, API admission, worker URL/route, callback, lease/failure/cancellation, artifact path, consent rights, cost class, current deployment and native test. Without this, do not call every historical job orphaned or successfully production-wired.

## Authorization matrix and review findings

| Surface | What source enforces | Remaining exposure / proof |
|---|---|---|
| Client Firestore rules | Owner/admin reads of jobs/logs; client writes false; queue/idempotency/outbox/consent/data rights server only | Original owner Rules 29/29 reported PASS; effective deployed Rules UNKNOWN |
| Client Storage rules | Owner/admin reads of jobs/exports, evidence admin; client writes false | Admin SDK/GCS principals bypass Firebase Rules; P0 no real Storage IAM fence |
| createJob | Callable auth + server profile role/permission + owner transaction and idempotency | Positive production owner/source rights and disabled-user edge unverified |
| getJobStatus | withAuthenticatedRole loads current users/{uid}; allows owner/operator | Returns job object; payload/protected-ref minimization check P1 |
| getJob and cancelJob | Callable auth; token.role/roles/uraiJobsAdmin operator checks; otherwise ownerUid matching | Unlike getJobStatus, does not re-fetch current user role/deletion in the callable. **P1** stale-operator and deleted-owner negative emulator REQUIRED; not a demonstrated bypass |
| admin.ts and admin-v2.ts | Token role claims permit list, logs and retry | **P1** revoked operator token, foreign-tenant isolation, stale job retry and sensitive payload exposure regression REQUIRED |
| Studio bridge/longform | Job/plan/project/source binding, lease and owner checks, rendering hard off | Negative synthetic proof only; C6 issuer and Replay unavailable |
| Privacy event ingress | Shared secret, strict event, duplicate/ordering receipt, block transaction | Signed positive consent and cloud identity not established |
| Worker private Storage output | Immutable runtime hard-off interlock, old generation-bound deletion | **P0** paused privileged writer can create late bytes; active drain and old/alternate identity 403 absent |
| Private MP4/SRT delivery | Strict canonical request parser, existing route fail closed | Protected server-side stream, owner/rights/consent on each request, cache/signed-URL withdrawal unproved |

Additional interoperability review: functions/src/privacy/lifeMovieOutputGeneration.ts and functions/src/jobs/lifeMoviePrivateDeliveryContract.ts reject generation values not representable as JS safe integers, whereas the later review-only #333 helper handles decimal uint64 with BigInt. Decide and test one canonical generation contract before actual GCS output signing.

**Documentation conflict:** docs/LIFE_MOVIE_LONGFORM_EXECUTION.md describes previously envisioned five-minute signed URLs; current lifeMoviePrivateDeliveryContract.ts explicitly says parsing is NOT delivery authorization. Historic prose is not a current delivery certification.

## Historical workers and exact original evidence ledger

| Work/source | Evidence witnessed in existing PR or prior runner | Interpretation |
|---|---|---|
| Jobs [#249](https://github.com/LifeLoggerAI/urai-jobs/pull/249) / [#250](https://github.com/LifeLoggerAI/urai-jobs/pull/250) | Reconciled historical same-realm VM Promise test harness and legacy jobType/type alias repair, both superseded by corrected parent #248 | Preserve the regression and evidence; duplicate child branches not merged |
| Jobs [#251](https://github.com/LifeLoggerAI/urai-jobs/pull/251) R517 at 358fa584ff814d9e58762dd21232daf1963e8cfa | Original frozen build and real Firestore+Storage derivative revocation **12/12 PASS**, including generation-before/after-delete, conflicting aliases, orphan/plan-only same-event reconciliation; Privacy cross-service separately reported **23/23** | Cleanup of *observed* objects works in these disposables, no future-write fence |
| Jobs [#320](https://github.com/LifeLoggerAI/urai-jobs/pull/320) ea8f0165ac74511a4e4196919ddd3109d0c1ff2e | Original Node22.23/pnpm8.15.9 frozen install, full 695-case urai-jobs:verify, typecheck, build reported PASS; owner Rules 29/29 and original Auth/Firestore/Functions/Storage run-four-emulator-acceptance PASS after Firestore JAR prewarming | Strong source-pinned original worker receipt, NOT independently rerun by R873, no real C6/output |
| Jobs #320 + Studio [#179](https://github.com/LifeLoggerAI/urai-studio/pull/179) 153d6c35557c66a8b9f8629778ca796b83730464 | Original real HTTP four-emulator Studio→Jobs bridge **10 negative checks PASS**, returned consent 503, positiveConsent=false, movieRendered=false | Negative integrated source proof, not film rendering |
| Jobs #320 + Privacy [#236](https://github.com/LifeLoggerAI/urai-privacy/pull/236) 5daa194148c1f0b157062ca09b8f1b6e629d6d29 | Original four-Firebase-emulator integration 16/16 stages and frozen source builds PASS; Runpod pod stopped after test | Real emulator boundary but review-only signer / no actual positive C6 |
| Jobs [#325](https://github.com/LifeLoggerAI/urai-jobs/pull/325) R854 16a7f49c089473fdc7fe6478039fedc6bda014a1 | Real original Auth/Firestore/Storage negative test 7/7 stages PASS, **privilegedBypassObserved=true, storageLevelFenceVerified=false, productionAuthorized=false, deletionAck=false**; original runner log SHA256 81f971ee6ec4bbb8391330e9a5708c58195aa06edc21e083803beb95123d0b62 on one independent rerun | **FAIL security property P0**, test itself intentionally green reproducing vulnerability |
| Jobs #326→#328 | Honest derivative ACK semantics, scoped Firestore reservation and review-only physical observation | Preserved as review, not production broker/IAM |
| Jobs [#329](https://github.com/LifeLoggerAI/urai-jobs/pull/329) 3b27aa5bb715224aeedb59e6e10915f29ec07e94 | 12/12 offline Node tests for staging zero-byte old-writer IAM denial probe; no actual staging data-plane 403 executed | Tool/procedure exists, cloud proof absent |
| Jobs #330→[#333](https://github.com/LifeLoggerAI/urai-jobs/pull/333) observed d19278a5167124c81926df4db859bf2c03c56986 | Review-only GCS metadata readback and *live replacement generation* rejection. R872 pure original Node 8/8 PASS (reported log SHA256 827bf60b9f3361e75359aad7fb3f340b2f330218b1e68b4e9fc55f2ee1d94889), helper typecheck PASS | 9-case amended Firebase emulator suite, full install/verify/build, real staged IAM and privileged writer 403 **NOT EXECUTED on latest head** |
| Spatial [#2069](https://github.com/LifeLoggerAI/urai-spatial/pull/2069) ad0dcf7412e6c6f84724b030660275f29ef4dfee | Fictional/demo 43/43 reported PASS; final production_go intentionally BLOCKED | No device/owner Replay proof |

Native receipts are original worker comments, not a fresh R873 clean repository rerun. Prior Cloud Shell Jobs install exit 137 and first Firestore JAR SIGTERM during 7% download happened before their intended full tests; keep failure evidence and separately sourced later PASS. GitHub Actions failed at both #320 and #333, but examined representative URAI Jobs Final CI job objects show **no runner_name, zero executed steps, completion within 2–3 seconds**; cause not established. These are neither test failures nor restored hosted CI.

## Independent original-source smoke (R873, reproducible but sharply scoped)

From exact candidate #320, fetched original workers/studio-worker/private-output-write-authority.js, **1,011 bytes**, Git object ID **ea6b25f3949ec2c17f65a9da68fa9cf937e86e76**. Copied exactly into a disposable local file and independently ran git hash-object (identical), sha256sum **a8a1a6fa86574bed3f1e2d9c7db305a12b3f238c066d37c023be199720cf6075**, node --check (exit0), then Node v22.16.0 four assertions: return false, denial throw, stays false with two separate environment overrides, denial persists. **4/4 PASS**. No repo clone or original multi-dependency native/emulator suite was run by R873; no accounts, cloud credentials, live media, provider costs, permissions, production files, deployments or IAM were used. The independently rehashed byte ID was already part of the existing original audit; do not double-count.

## P0–P3 backlog

**P0:** Jobs [issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) storage-enforced sole-writer broker + durable owner/purpose/project revocation epoch and pre-byte reservations + active upload drain + all historically capable service identities and alternate buckets denied at **GCS** data plane even after privileged pause. Actual metadata generation, atomically recorded attempts, late orphan reconciliation and no delete ACK before uploads cannot finalize. No Firestore-only lease, point-in-time list or GCS emulator replaces this.

**P0:** Real signed scoped owner C6/source-rights authority + current authenticated owner-only protected streaming for MP4/SRT, Replay denial on revoke/deletion, verified cache/signed-URL revocation, cross-user and stale-lease denial. Positive real film test only after approved safe writer and explicit authorization; keep intentional production hard-offs until then.

**P1:** Recheck server-owned operator/user deletion/disable role on getJob/cancelJob/admin/v2, and sanitize data/tenant exposure. Build negative regression at exact source before changing exported callables; avoid silent Gen1→Gen2 conversion.

**P1:** Re-run #333 exact current candidate full original workspace and amended 9-case real Firebase Storage metadata review; R854 original negative suite and all four emulators; then review merge ancestry against #312/#320/#324. Keep each PASS pinned to its own SHA; host CI currently no steps.

**P2:** Resolve legacy 26 vs active 12 job types with deployment, retry/cancel, orphan and paid-provider ledgers; standardize GCS uint64 generation and worker/Replay representations; source-prove every cross-repository identity and output contract.

**P3:** Finish remaining 541 un-hashed distinct current blobs, raw binary/LFS, all reachable history and cloud effective deployment mapping, physical device/browser/XR and accessibility acceptance.

## Exact next original acceptance commands — disposable and SHA-pinned

Require new approved clean source checkout, Node 22, pnpm 8.15.9, Java 21, FFmpeg/ffprobe, exact frozen lockfile, isolated HOME/cloud config, no live GCP/Firebase/Runpod/provider credentials, prewarmed Firebase 15.24.0 JARs and only original demo emulators. Recheck current PR head instead of reusing a moving branch:

~~~bash
git checkout --detach d19278a5167124c81926df4db859bf2c03c56986
test -z "$(git status --porcelain --untracked-files=all)"
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
node --experimental-strip-types --test scripts/life-movie-generation-evidence-review.test.mjs
URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r854-private-storage-p0-negative-native.sh
URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-four-emulator-acceptance.sh
~~~

For the original R815 Studio bridge: Studio source must be the exact 153d6c35557c66a8b9f8629778ca796b83730464 clean Git checkout, set URAI_STUDIO_SOURCE_DIR to that path and URAI_ACCEPTANCE_SHA to the tested Jobs commit, then run scripts/run-studio-jobs-real-bridge-acceptance.sh. Privacy #236 original scripts/run-r818-native-jobs-privacy-acceptance.sh requires its immutable embedded Jobs source pin; changing the pin requires a reviewed test change, not silent attribution of an old result to #333.

Subsequent protected staging IAM and real positive integrated owner authorization are **SEPARATE privileged acceptance stages** and must not be executed automatically: test forced pause pre-byte/revoke, post-byte/pre-generation/revoke, post-inventory/late-write, post-ACK old lease/alternate principal, generation replacement, absent/malformed metadata, mixed tenants/projects/buckets, duplicate/stale revocation, owner disabled/deleted, signed-stream access before/after revoke. Capture real GCS HTTP 403, precise observed generations, credentials/principal scoped evidence and independent approval/rollback. Never use real protected media, enable writer, deploy or grant C6 from this documentation assignment.

**Verdict:** Jobs is a real built engine with meaningful original native negative runtime evidence and source-inventory progress. The complete revocation-safe, signed-consent, private Replay, production IAM and device pipeline remains **UNPROVEN / HOLD**.
