# ONE URAI GENESIS — Jobs exact-source next-Chalk handoff (R872–R891)

**Prepared:** November 7, 2026, America/Chicago (GitHub commits/issue comments may be November 8 UTC).  
**Scope:** `LifeLoggerAI/urai-jobs`, with dependencies on Labs registry, Privacy, Studio, Storage, Replay and physical devices.  
**Main next-worker entrypoint:** [Jobs draft PR #368](https://github.com/LifeLoggerAI/urai-jobs/pull/368), review branch `review/chalk-r891-jobs-quota-owner-runtime-convergence-20261107`.  
**Source snapshot BEFORE this documentation-only handoff:** `47a881dd32826ac4705c5509eb67a61881aae54b`. A documentation commit after that SHA does not constitute a retest. Re-fetch latest PR head and compare before acting.  
**Related registry:** [Labs draft PR #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), `docs/estate/00_START_HERE.md` and `docs/estate/08_NEXT_WORKER_HANDOFF.md` at the registry PR head; [Genesis release issue #247](https://github.com/LifeLoggerAI/urai-labs-llc/issues/247).  
**Decision:** **PRODUCTION NO-GO / HOLD**. No owner/private-film activation, no release or IAM approval inferred from this document.

This is a **continuity and evidence-index artifact**, not a fresh exhaustive all-branch/all-byte audit, full native test report, new source-security certification or authorization. Treat every test as tied to its original exact source/ref and environment. Historical “PASS” cannot be transferred to a newer PR head.

## 1. Resume here, not from older worker branches

1. Read THIS file and the existing [R891 convergence details](R891_UNIFIED_JOBS_QUOTA_OWNER_SECURITY_HOLD.md); fetch and inspect PR #368 head, its parents, its full diff, the guarded runner, package verify command and all parent PRs. The branch is a **review-only** child of R890, NOT merged to `main`.
2. The actual *two-parent convergence commit* is `578608d627b878b208f9331a46cbcc71bcd3842a` with first parent R890 `2cca2e75cf8ddaab6c1e40d4e0d8c39831382473` (PR #367) and second parent independent quota/emulator review `3438eb5e675923d8149bc4d9672617bb389148d7` (PR #364). **Do not redo the merge or overwrite either worker.**
3. PR #368 pre-handoff head `47a881dd32826ac4705c5509eb67a61881aae54b` is a real GitHub commit containing the converged code and `docs/security/R891_UNIFIED_JOBS_QUOTA_OWNER_SECURITY_HOLD.md`; GitHub confirmed PR OPEN/DRAFT/MERGEABLE/UNMERGED with 19 changed paths relative to R890. Re-check all state in the next session.
4. After a new committed handoff, distinguish **documentation HEAD** from the immutable source baseline; redo changed-test verification only when actual source/test/runner bytes change. Never count documentation-only readback as full native acceptance.

## 2. Source work completed — historical ledger

| Round / original PR | Actual change and protection | Verified evidence / limits |
|---|---|---|
| R871–R872; review #331/#332 | Two competing original Jobs reviews reconciled; functional trees reported byte-identical except additional review document. Eight physical-generation scenarios identified, security tests retained. | Staging security regression **19/19** previously reported. Exact native frozen suite **NOT RUN**; private Storage P0 remained OPEN. R872 executable was only a prepared review artifact. |
| R873; PR #333 | Object generation / replacement detection distinguishes true deletion from live replacement and rejects forged/replayed generation evidence; direct private writer remained disabled. | Earlier source offline **27/27**, exact blob checks; later peer updates changed source, so prior 27/27 does not certify subsequent branch. Original nine-case Firebase integration not certified. |
| R874; PR #335 | Independent adversarial generation/revocation tests enrolled alongside peer tests; preserved other writer changes. | Source-level combined **17/17**, six adversarial groups passed at their original source. GitHub Actions reports with zero executed steps cannot certify native run. |
| R883; PR #352, HEAD `497cfc15f68f4f0abbb95e85c12762c4c25e4e64` | Admin v1/v2 retry handlers now recheck current owner, current tenant/org and protected-job restrictions before requeue. Prior admin retry path could revive revoked private jobs. | Pre-fix negative reproduction reported 20 failing assertions; repaired source tests **24/24**, combined regression **57/57** locally. Not a full Firebase native result. |
| R884–R885; PR #355, HEAD `c607c9dc6959be5f13d8fed2dc8e269f3ae35513` | Manual callable `processQueueNow` no longer relies solely on stale token operator role; rechecks current Firestore operator before queue read and in lease transaction. R885 repaired a missing closing brace in committed test fixture and refreshed runner pin. | Corrected exact committed 16-case source/controlled-stub regression **16/16**, TAP SHA256 `6af8a99846425b44901b12bef1b6acb19a3f893aa21a7bc7e13abf9202ffd4a2`. Later R886 fixture edits require a fresh full rerun. |
| R886; PR #359, HEAD `dacb265107a1e4cbf25f099a33b256e1f5c594bd` | Scheduled leasing, manual leasing and Pub/Sub worker start transaction must recheck current owner account, tenant/org and privacy/deletion veto. Original no-consent-context queued jobs otherwise lacked uniform owner admission. | **15/15** pure owner-helper cases executed and **14/14** static structure checks; original 19-case full test and real Firebase work **NOT RUN**. Legacy ownerless jobs now fail closed and may need legitimate policy/migration. |
| R887; PR #362, HEAD `761ea5f01e8c9b3439f51c580b53e75677975dd4` | Guard legacy Admin SDK queue/requeue/lease recovery and generic synthetic poll worker behind explicit loopback disposable Firestore emulator and matching `demo-*` project. Unconditionally retire unsafe raw production queue drain; preserve original scripts in history. | Original exact-source offline refusal **19/19**, TAP SHA256 `fe22b70b525992df866407e123153672c73adeca83495e42fc4adc41cd90c2f5`. **No IAM removal, deployed worker proof, or cloud GCS denial**. |
| R888; PR #363 | Long-form Studio plan/child/assembly jobs inherit server-read owner organization; org mismatch blocks status, assembly, resume, cancellation, cleanup and playback preflight. Idempotent old-plan reads recheck org. Do not weaken current-owner scope to accept legacy mismatched jobs. | Pure helper **12/12** at unchanged blob, TAP SHA256 `ffa0d951c1e5d0b31f03e4a3e7c55fc59ba24cdf168c1e1bb00580c0bf89df87`; **22/22** first static bridge checks and further targeted checks. Real private media delivery remains disabled. |
| R889; continued PR #363 HEAD `31879bdab599f699cb527e16c99bda3dda8cb5bc` | Original R417 VM-derived resume fixture and modern resume fixture wired to the **real** new owner/org helper. Exact-source acceptance runner pins both rather than permissive mock. | **13/13** static wiring/source checks; both full transaction suites **NOT RUN** at this commit. |
| R890; PR #367 HEAD `2cca2e75cf8ddaab6c1e40d4e0d8c39831382473` | Normal long-form movie cancellation checks current user existence, deletion/pending privacy deletion, tenant and org *inside the same Firestore transaction before child-job reads or writes*. Separate central Privacy deletion cleanup remains separately authorized. | Original handler under controlled transaction substitutes **14/14**, TAP SHA256 `ab8ec8f836a0f5c956fd89896f9b510b38468a71e588fd6f3c702cbd698354ac`; exact committed maintained source/ordering test **14/14**, TAP `9124d831645e9e1b40aecc62b86b1d4398473926e9e9637a7692bcc77f06205d`. **Not native Firebase**. |
| Peer quota/emulator PR #364 HEAD `3438eb5e675923d8149bc4d9672617bb389148d7` | Separate atomic owner-bound job-create sliding-minute quota, server-only Firestore profile field, ascending owner/time migration index, original four-emulator Auth/Firestore/Functions/Storage runner, secret/dotenv/symlink refusal and nested demo project isolation. | Peer source/test fixtures and 11 connector static invariants documented; original ten-case peer fixture earlier reported separately. **No executed native four-emulator acceptance on PR #364 or R891**. |
| **R891; PR #368** | True two-parent convergence. 16 exact disjoint peer blob paths overlaid on owner/private Jobs review source. Only `package.json` and `scripts/run-r879-unified-native-acceptance.sh` manually reconciled. Retains original test logic, source identities, both parent histories and strict release gates. | **11/11 targeted STATIC checks** on combined source/runner, **74 individual verify COMMANDS** enrolled (not 74 passing tests). Real native/frozen build **NOT RUN**. |

All these PRs are **reviews**, not evidence the changes are merged, deployed or remotely enforcing policy. Earlier snippets may describe an intermediate PR head; current authoritative review source is PR #368 (fetch fresh).

## 3. R891 exact-source manifest (pre-handoff source)

| File / role | Git blob SHA |
|---|---|
| `functions/src/jobs/createJob.ts` — atomic quota and current owner admission | `c52f09900bb76a1fa71445a7fceb39c177c2c568` |
| `functions/src/jobs/jobCreateRateLimit.ts` — pure server ledger | `9b7a53c41c56681dfdf4cebbc00de9a962adf5d2` |
| `firestore.indexes.json` — owner/createdAt ASC migration index | `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd` |
| `firestore.rules` — server-only quota field among protected user fields | `cfa77a8fa5e69327ab352b31450c59a036d21e38` |
| `functions/src/jobs/currentJobCallerAuthority.ts` | `b791017fcb291e8a793b2b85fa9ee37991277c9d` |
| `functions/src/jobs/studioLifeMovieLongformBridge.ts` | `888e9645e78d1bd723df883e0a73f042143f1e03` |
| `functions/src/jobs/lifeMovieLongformOwnerOrg.ts` | `36b809a8e599b288480800f4fc3248eb828b5911` |
| `package.json` — 74 enrolled commands | `0e6dcac476c8e54b3b49e0d9e3e517b49d0ae058` |
| `scripts/run-r879-unified-native-acceptance.sh` | `5e5f4d8523dcc1607637589c2f149d5a91ddc793` |
| `scripts/run-r879-jobs-native-auth-acceptance.sh` — original peer inner runner | `67ae8515bd206456c8d181ff52ef173e67f65cc2` |
| `scripts/r887-disposable-project-handoff.test.mjs` | `5d6aa48ab8111280f983f05821209c60b9a92299` |
| `docs/security/R891_UNIFIED_JOBS_QUOTA_OWNER_SECURITY_HOLD.md` | `8eedc1d7fbf88b534593f1645f2749cc30c94925` |

These are **Git object hashes**, not proof every blob or all historical branches have been read. GitHub peer recursive tree was not truncated (1,428 entries), but this was a selective semantic and conflict reconciliation, **not** a complete all-object/byte audit. The peer source had 16 nonoverlapping paths imported from its original Git tree, with only package and runner combined. R891 original convergence commit `578608d627b878b208f9331a46cbcc71bcd3842a` remains immutable even after later docs.

## 4. What is actually implemented, versus NOT activated

- Existing Jobs: authenticated create/read/cancel/admin callables, queue/scheduler/worker leasing, consent-revocation/deletion gates, tenant/org owner scoping, idempotency, retry authority, Studio long-form plan/child/assembly contracts, private output metadata and review-only generation ledger, legacy CLI guards and atomic quota in **review source**.
- Untrusted token claims alone must not authorize current operator/admin actions; current server-owned owner/account/tenant/org checks are required at admission, leasing, worker start, long-form assembly, cancellation and other private reads.
- Existing positive owner-signed C6 consent authority is NOT established end to end. Long-form private `deliver` and legacy `playback`/`download` remain HTTP 503 hard-off in reviewed source; legacy signed-URL delivery is NOT a certified revocation-safe alternative.
- R854 and physical-generation emulators deliberately reproduce a possible privileged *late write after revocation* at the Storage layer. App-side reservations and generation consistency do NOT prove a retired privileged identity gets GCS 403.
- A server-side privileged writer outside the broker may bypass its denial. An upload begun before revocation might finish afterward. Neither preflight owner checks nor admin-side emulator tests solve exclusive IAM or physical in-flight drain.

## 5. Evidence boundaries & CI facts

- Latest checked PR #368 source snapshot: `47a881dd32826ac4705c5509eb67a61881aae54b`, **draft/open/mergeable/unmerged**. Source/runner assertions **11/11 STATIC**, not full unit/native build.
- Root verification string includes 74 shell-joined commands; they have **NOT all executed together** against this converged head. Quota helper source test count 12, index 5, env 10, project handoff 4 are **configured run stages**, not new pass receipts.
- Latest GitHub Actions runs on R891 reported failures, but sampled Runtime CI, Typecheck and Final CI jobs reported **zero executed steps** (callable E2E skipped). This is infrastructure/execution **non-evidence**, not a source failure nor a passing build.
- Last local environment seen: Node 22.16, TypeScript 5.8.3, Java 21; **pnpm 8.15.9 unavailable**, no complete original Jobs checkout and `github.com`/npm package DNS unavailable. Do not claim a frozen install, full build, source coverage, or successful native emulator test from that environment.
- Prior actual local test logs and SHA256 receipts belong to exact prior source; retrieve original GitHub evidence/comments or surviving artifacts, not chat summaries alone. Where raw logs no longer accessible, mark **reported/unreproduced** rather than fabricated.

## 6. Exact release blockers — ordered

**P0 / critical and still NOT MET**
1. [Jobs Storage P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): independently authorized real, physical GCS data-plane denial (HTTP 403) for **every retired or alternate private writer identity after revocation**. Inventory current IAM, sole authorized writer, live generations and alternate writer paths. Prove that existing in-flight uploads are drained/aborted and exact generation cleanup completed **before** deletion acknowledgement. Never perform IAM changes or touch real customer media without separate explicit authority.
2. Authenticated, complete Firebase Auth + Firestore + Functions + Storage native acceptance at the **same** exact R891 commit, including current-role downgrade, owner deletion, cross-tenant/org denials, idempotency races and **14 concurrent** quota admissions; original R854 Storage negative suite and nine physical-generation scenarios.
3. Full frozen monorepo install, verify/typecheck/build and initial runner shell syntax and fail-closed preflight on a capable trusted host. No step may silently use real project or provider billing.

**Additional MUST-PASS before GO**
4. Positive signed C6 owner/source-rights receipt issuance and independent verification across Privacy→Jobs→Studio→Replay; invalid, stale, forged, duplicate and revoked consent blocked at all relevant boundaries. Current private writer and delivery remain hard-off.
5. Revocation-safe private media creation, generation-specific deletion, owner-only authenticated replay/delivery (not a 5-minute legacy signed URL), account deletion and data-rights proof; real cross-service source provenance.
6. Real supported devices, accessibility, reduced-motion/captions, physical-memory Replay, operational monitoring, rollback and independent designated security/release authorization.
7. Legitimate ownerless legacy system job policy/migration and historical long-form org-mismatched plans require explicit independent governance. Do not weaken current owner binding or use normal user cancellation to bypass central privacy cleanup.
8. Review other deployed/legacy direct-Admin writers, particularly `workers/index.ts` / `workers/index.js` and any independently deployed worker services. R887 restricted only identified CLI entrypoints; existing IAM and deployed processes were not changed.
9. Source version drift, other worker PR changes, provider project/identity permissions, and index readiness must be rechecked; registry docs and prior PASS claims do not replace real verification.

## 7. The safe next execution — exact order

1. **Read** current [PR #368](https://github.com/LifeLoggerAI/urai-jobs/pull/368), this handoff, R891 convergence doc and both original parent PRs #367 and #364. Re-fetch all heads, check diff and raw Git parents. Reconcile any fresh peer changes **without rewriting either branch**.
2. Obtain a **full original Git checkout with history** at the fresh review HEAD, compare `git hash-object` for pinned files and working tree clean. Read and run `bash -n scripts/run-r879-unified-native-acceptance.sh` and the nested `scripts/run-r879-jobs-native-auth-acceptance.sh`; run safety refusal preflight with missing/wrong parameters. Pin Node 22, `pnpm 8.15.9`, Java >=21 and Firebase Tools 15.24.0 in isolated no-credential environment.
3. Do source-only tests first, then `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck` and `pnpm build`; collect exact exit codes, actual step counts and SHA256 for raw logs.
4. **Only in a disposable, air-gapped-from-production emulator environment**, run original R879/R854 unified exact-source runner. Set externally independently reviewed `URAI_JOBS_ACCEPTANCE_SHA` to complete Git HEAD and `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY`; invoke `bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only`. **Do not invoke with real cloud credentials, real projects or media**. Outer project `urai-staging-test` replays negative Storage proof; nested `demo-urai-jobs` runs full Auth/Firestore/Functions/Storage. Confirm its real-host/emulator/version/test-count receipts.
5. Separately seek approved production-equivalent **real GCS denial** and in-flight drain evidence; do **not** ask an offline emulator to certify IAM. Document explicit identity, bucket, exact object generation and denied operation with safe redaction and independent approver.
6. Close the remaining Privacy, Studio, Replay and device proofs with independent review and only then request an owner-authorized GO. Do not merge, deploy, change IAM or enable paid compute proactively.

### Example preflight commands (do not skip explicit safety guards)

```bash
git rev-parse HEAD
git status --porcelain --untracked-files=all
git show -s --format='%H %P %s' 578608d627b878b208f9331a46cbcc71bcd3842a
bash -n scripts/run-r879-unified-native-acceptance.sh
bash -n scripts/run-r879-jobs-native-auth-acceptance.sh
node --version
pnpm --version
java -version
# Only after a trusted no-credential, disposable reviewed checkout exists:
URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY \
  URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)" \
  bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

**Guard warning:** `urai-staging-test` is an old emulator-specific project string, *not* a `demo-*` prefix; prove every actual Firebase test's emulator host binding and no remote identity/network. A malformed or inherited Firebase Functions `.env` file, symlink, bucket/config override or credential is a mandatory refusal, not a reason to bypass preflight.

## 8. Permanent links and responsible queues

- [Jobs unified R891 review PR #368](https://github.com/LifeLoggerAI/urai-jobs/pull/368) (latest working lane).
- [Jobs R890 protected cancellation PR #367](https://github.com/LifeLoggerAI/urai-jobs/pull/367) and [R888/889 Studio org PR #363](https://github.com/LifeLoggerAI/urai-jobs/pull/363).
- [Peer quota/emulator PR #364](https://github.com/LifeLoggerAI/urai-jobs/pull/364), [R887 legacy writer PR #362](https://github.com/LifeLoggerAI/urai-jobs/pull/362), [R886 owner lease PR #359](https://github.com/LifeLoggerAI/urai-jobs/pull/359), [R884/885 operator PR #355](https://github.com/LifeLoggerAI/urai-jobs/pull/355), [R883 retry PR #352](https://github.com/LifeLoggerAI/urai-jobs/pull/352).
- [Storage critical P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252); [Jobs role/ownership P1 #337](https://github.com/LifeLoggerAI/urai-jobs/issues/337); [long-form end-to-end #129](https://github.com/LifeLoggerAI/urai-jobs/issues/129).
- [Genesis master release HOLD #247](https://github.com/LifeLoggerAI/urai-labs-llc/issues/247), [Labs shared registry draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) and its [worker handoff standard](https://github.com/LifeLoggerAI/urai-labs-llc/blob/docs/genesis-estate-registry-20261106/docs/estate/WORKER_HANDOFF_TEMPLATE.md).

## 9. Protocol for next Chalk

Do not start from zero, recode existing security implementations, conflate simulated/local tests with native/emulator/GCS/device proof, treat a review PR as merged, or rely on GitHub Actions “failure” with zero job steps as a code failure. First reconcile **current** Git refs against this immutable snapshot, verify the original test suites and exact source, then document only the evidence delta. Keep P0/P1 issues OPEN and production/private writing **HOLD**. Preserve exact checksums, branch SHA, executed command, environment, runtime, negative results and approval status. If blocked by missing runtime/tools, say precisely where and do not invent success.

**NEXT CHALK starting instruction:** “Continue One UrAi Genesis Jobs from R891 review PR #368 and this handoff. Reconcile peer #364 without losing R883–R890 owner/consent safeguards. Execute the full frozen source and original native tests at an exact Git commit, and independently resolve Storage #252 before any GO. No paid compute or production changes without authorization.”

**Release owner decision at handoff:** **NO-GO / HOLD**, with review-only source convergence complete and full native/real Storage/private Replay acceptance still pending.
