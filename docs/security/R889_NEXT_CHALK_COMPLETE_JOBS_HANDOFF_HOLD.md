# ONE URAI GENESIS — R889 definitive Jobs next-Chalk handoff (SOURCE-PINNED / HOLD)

**Saved:** November 7, 2026, America/Chicago (November 8 UTC). **Scope:** `LifeLoggerAI/urai-jobs` complete continuing security/revocation-safe engineering handoff, not a production release certificate. **Instruction:** UrAi / LifeLogger / LifeOS were built systems. Preserve the existing Jobs engine, assets, tests, history and parallel Chalk workers; integrate and prove, do not rebuild.

> **BEGIN HERE next conversation.** This file is the compact durable index for the completed investigation, exact code/evidence refs, alternative branches and acceptance remaining. It is not itself an exhaustive all-history/all-blob inventory. For the wider estate start [Genesis registry](https://github.com/LifeLoggerAI/urai-labs-llc/blob/docs/genesis-estate-registry-20261106/docs/estate/00_START_HERE.md), [Jobs master Genesis intake #266](https://github.com/LifeLoggerAI/urai-labs-llc/pull/266), and source-pinned manifests and worker handoffs in the linked PRs.

## 1. Exact latest authoritative Jobs review sources

- **Current latest Jobs integrated/deletion candidate:** [draft PR #366](https://github.com/LifeLoggerAI/urai-jobs/pull/366), branch `review/chalk-r888-quota-privacy-deletion-20261107`, original **pre-handoff source** `c1c311affbf1ad57721cab4c778e90264c57b448`. It is five changed paths above [draft PR #365](https://github.com/LifeLoggerAI/urai-jobs/pull/365), `ad2044177e3c7bf2dd695107b07c2d920f080bd9`. This handoff is an ADDITIONAL DOCUMENT ONLY, so the actual draft #366 HEAD will advance once committed: read current head afresh before running/tests/repinning.
- **R887 immutable *real three-parent* Git merge:** `dfecf083cd8c92c859a5aa39a9b7ca27bbcd65a2`, Git tree `814ed80bb126d716335eb34d748d7cb030503c86`, with exact ordered parents: [Jobs #362](https://github.com/LifeLoggerAI/urai-jobs/pull/362) `761ea5f01e8c9b3439f51c580b53e75677975dd4` (owner/worker authority and legacy writers), [Jobs #361](https://github.com/LifeLoggerAI/urai-jobs/pull/361) `cd46650d87846b7f142a2c814c6b7eec20a7a8ff` (transactional owner-ledger quota), [Jobs #360](https://github.com/LifeLoggerAI/urai-jobs/pull/360) `453a6973bfded3115c5b5f2b05721a71e6912366` (local emulator environment isolation).
- **Source coverage at R888 pre-handoff:** full recursive Git tree `truncated=false`, **1,223 tracked file blobs / 1,440 entries**. This counts tracked Git objects, not ignored/untracked files, unavailable binary payloads, full history or executed tests. Exact unified-runner Git blob references **42/42 matched** the then-current source tree, and eight separate read-only original-source ordering assertions passed. Neither is a full build or native test.
- **Master Genesis documentation:** [Labs registry draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), [Labs intake draft #266](https://github.com/LifeLoggerAI/urai-labs-llc/pull/266), `docs/estate/submissions/R886_JOBS_PARALLEL_SOURCE_CONFLICT_LEDGER.json`, `R886_JOBS_SECURITY_BRANCH_CONVERGENCE_HANDOFF.md`, `R887_JOBS_THREE_PARENT_INTEGRATION_HANDOFF.md`, `R888_JOBS_QUOTA_OWNER_DELETION_HANDOFF.md`. Detailed Jobs source decision ledger: `docs/security/R887_THREE_PARENT_JOBS_SECURITY_CONVERGENCE_HOLD.md` and `docs/security/R888_QUOTA_LEDGER_DELETION_HOLD.md`.

## 2. What was built and is retained (not aspirational)

- Jobs source implements owner-authenticated callable admission, job-type validation, idempotency/fingerprints, owner/tenant/org binding, server-only create quota, transactional job+queue+log+binding creation, scheduled and manual queue leasing, workers and retries, cancellation, status/log retrieval, deletion fencing, protected-scoped data rights, and event/provenance hooks. Source implementations are REAL; complete live integration and production authorization are **not yet verified**.
- R875–R877 source fixes address stale operator claims, current server-owned roles/permissions, disabled/deleting owner status, tenant/org transfer and stale historical idempotency-bound job. Corrected and retained through later R887 integration.
- R887 parent #362 retains current owner check at **queue tick, manual dispatch and worker start**, private-source generic retry veto, and deny-by-default direct/legacy Admin SDK writer scripts. Do not lose these paths when merging.
- R887 chose **one provisional quota design** from parent #361: `users/{uid}.jobsCreateRateLimit` rolling 60-second admission ledger, updated inside the same Firestore transaction as creation of job/queue/log/idempotency. Legacy recent-job migration was implemented. Firestore client mutation of that server-owned field is denied. R880's *alternative* separate `jobCreateRateLimitLocks` document/counter and its lock-specific tests are **superseded for this candidate only**, not deleted from historical parent branches.
- R881 repaired six malformed TypeScript admin callable arrow declarations across v1/v2. R882 preserved historical owner/time indexes and added ascending composite for the selected historical migration query. R883 and R884 hardened synthetic native test teardown and inherited Functions dotenv/config/secret isolation; R885 archived actual raw TAP.
- R888 source correction: after Jobs-scope deletion safely reconciles/anonymizes terminal jobs/queues/logs, `functions/src/privacy/dataRightsExecution.ts` erases the Jobs-owned owner-field `jobsCreateRateLimit: FieldValue.delete()` while retaining `dataRightsDeletionPendingCentralPrivacy: true` and request ID. This is a source-visible omission repair; **actual Firebase deletion and concurrent-create race remain untested**.
- All parent PRs and original worker branches were left intact. No production IAM, deployment, media, paid compute or merge to `main` was performed by this Chalk lane.

## 3. Critical original source objects (pre-handoff R888 executable code)

| Exact original path | Git blob |
| --- | --- |
| `functions/src/jobs/createJob.ts` | `c52f09900bb76a1fa71445a7fceb39c177c2c568` |
| `functions/src/jobs/jobCreateRateLimit.ts` | `9b7a53c41c56681dfdf4cebbc00de9a962adf5d2` |
| `functions/src/jobs/currentJobCallerAuthority.ts` | `b791017fcb291e8a793b2b85fa9ee37991277c9d` |
| `functions/src/privacy/dataRightsExecution.ts` | `756547684397788d8051acace70ac0e5c03e2e17` |
| `firestore.rules` | `cfa77a8fa5e69327ab352b31450c59a036d21e38` |
| `firestore.indexes.json` | `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd` |
| `scripts/r888-quota-ledger-deletion-contract.test.mjs` | `54ec923386f973ecae75554accf802b4c280d656` |
| `scripts/run-r879-unified-native-acceptance.sh` | `d96156e331a3d2ac00432cef2195fb637a5a40ad` |
| `scripts/run-r879-jobs-native-auth-acceptance.sh` | `67ae8515bd206456c8d181ff52ef173e67f65cc2` |
| `package.json` root `urai-jobs:verify` | `0e13c1e1c389bcdbb99938aeaa588bf08c71b589` |

Read the exact source AND the relevant parent patch, not just these object IDs. Recheck **the current PR HEAD and object hashes** before touching files; parallel workers may have advanced branches.

## 4. Chronological work map and what the green claims actually mean

| Review lane | Work / evidence | Actual verification class |
| --- | --- | --- |
| R875–R877, Jobs [#338](https://github.com/LifeLoggerAI/urai-jobs/pull/338) | Current caller/owner and tenant/org idempotent-binder safeguards | **25/25 local source-level/mock/pure** in predecessor lane; NOT native Firebase |
| R878, [#344](https://github.com/LifeLoggerAI/urai-jobs/pull/344) | Two-parent authorization+Storage review convergence; original byte 25/25 local tests | Git trees and source-level tests, not full build |
| R879, [#347](https://github.com/LifeLoggerAI/urai-jobs/pull/347) | Real Firebase token/native owner-role and 14-way quota runner authored | **PREPARED, not executed** |
| R880, [#351](https://github.com/LifeLoggerAI/urai-jobs/pull/351) | Alternative per-owner lock quota, later superseded for R887 | **6/6 pure helper tests**, NOT selected quota's native safety |
| R881–R882, [#354](https://github.com/LifeLoggerAI/urai-jobs/pull/354), [#356](https://github.com/LifeLoggerAI/urai-jobs/pull/356) | Six admin syntax fixes and index source regression | Exact-original **2/2 TS parser PASS** on Node 22 + locally available TS 5.8.3; 7/7 source assertions; NOT full Functions build |
| R883–R885, [#358](https://github.com/LifeLoggerAI/urai-jobs/pull/358), [#360](https://github.com/LifeLoggerAI/urai-jobs/pull/360) | Emulator cleanup/env secrets isolation | Exact-original **10/10 local Node fixture PASS**, raw TAP `docs/security/attestations/R885_R884_exact_node_test.tap`, log SHA256 `ece548de8d50b7545849366d488ca4462e73e28da4a8a6679ede429824376e2b`; NOT Firebase |
| R886, Genesis #266 | Three-branch conflict map 9/9/7 plus independent tests of exact peer quota/owner helpers | **13/13 quota + 13/13 owner dispatch, 26/26 local pure helper PASS**, TAP SHA256 `8665cdaa5177990c28f51e7c623749f2f80cbdb11eb1dfbe35d30c1f8306c755`. These are *new independent local harnesses*, not complete repo native tests |
| R887, Jobs [#365](https://github.com/LifeLoggerAI/urai-jobs/pull/365) | Genuine three-parent integration; 40/40 Git source pins | SOURCE TREE only, full root verify/native pending |
| R888, Jobs [#366](https://github.com/LifeLoggerAI/urai-jobs/pull/366) | Remove quota ledger during approved deletion; 42/42 pins and 8/8 source assertions | Newly committed six-case Node contract **UNEXECUTED**, Firebase deletion **UNEXECUTED** |

**Never add these green counts into one end-to-end certification.** Earlier peer receipts, mocks, parser checks and pure helper tests have distinct SHAs and scopes.

## 5. Serious open safety and certification gates — DO NOT SAY GO

1. **P0 [Jobs issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) OPEN**. Privileged post-revocation private GCS future-write prohibition and *in-flight upload drain*. Old Studio worker service accounts/legacy Admin SDK/alternate service identities/buckets may bypass client Rules. Need durable admission/write reservation or storage-enforced broker, storage-level IAM deny/403 for ALL historically capable writers, prove no late byte after revocation ACK, exact generation reconciliation, and replay/delivery invalidation. Source-level owner checks, emulator Rules and point-in-time prefix lists do NOT prove this.
2. **P1 [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) OPEN**: actual native authenticated Firebase owner/status/callable/legacy operator demotion denials for v1/v2 functions, current roles and permissions, transfer and disabled/deletion cases, queue/manual dispatch/worker start. Mock runs alone insufficient.
3. **P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) OPEN**: real serializable Firestore transaction in selected sliding-window owner-ledger design: 14 parallel distinct-key creates must not exceed 10/min, prewarm to 9, rollover and clock skew, idempotent replay, migration, failed transaction retry, no orphan queue/log/binding; deterministic interleaving proof beyond one nondeterministic load test.
4. **Jobs scoped deletion**: R888 newly updated code and six-case source test need exact-current-SHA Node execution; then actual Firebase scoped deletion that removes the ledger, retains owner central fence/request, and rejects concurrent/replayed admissions. Check idempotency bindings, deletion receipts and cross-system provenance separately; do not claim full ecosystem deletion.
5. **Cross-repo positive consent and protected pipeline**: Privacy positive signed owner-purpose-source C6; Studio rendering/provenance/fingerprint and Jobs generation binding; protected GCS MP4/SRT, Replay owner-only delivery; revocation/deletion; physical-device and accessibility acceptance. No end-to-end private production evidence.
6. **CI/build**: no complete original frozen install, root `pnpm urai-jobs:verify`, full `pnpm typecheck`, `pnpm build`, four-native-emulator acceptance at current #366 HEAD. Repeated GitHub Actions checks failed *before executing steps* (runner name empty, 0 steps), so they are **infrastructure/CI eligibility**, not an original-code PASS or FAIL.

## 6. Current available environment, authorizations and safety

- Connected GitHub tool WORKS to read/create files/branches/draft PRs/comments; historical owner GitHub interactive 2FA unavailable. Do not assume this restores paid GitHub Actions or bypasses protected setup.
- Last directly observed local environment: Node v22.16.0, Java 21, Git, TypeScript available; **pnpm missing and `github.com`/`registry.npmjs.org` DNS blocked**. This blocks clean clone/frozen workspace CI/native acceptance in that local runtime. Attempt safe local proof where possible, but do not manufacture receipts or claim to run what is unavailable.
- Runpod connector may be connected, but no new paid pods/servers/compute, IAM changes, provider/API charges, production authentication, signed C6 or private-media writes without explicit permission. Existing archived isolated tests are not a reason to activate production.
- Other Chalk workers may be parallel. Before any new patch refresh #366, #365, #362, #361, #360 and master #266; compare complete trees and preserve existing fixes. Never force-push or silently merge a worker's PR.

## 7. Exact next-work acceptance, not another planning loop

1. Read this file, Genesis `docs/estate/00_START_HERE.md`, current Jobs `docs/security/R887_THREE_PARENT_JOBS_SECURITY_CONVERGENCE_HOLD.md` and `R888_QUOTA_LEDGER_DELETION_HOLD.md`, and PR #366 diff. Verify exact HEADs and all source pins.
2. **Execute** original six-case R888 Node test on a source-complete clean snapshot if possible; record environment, original bytes, stdout digest and exit code. Run the retained R875–R888 root verification and full frozen source build when dependency tooling exists. If blocked, record the actual blocker and work only on demonstrable conflicts, not speculative replacements.
3. Safely execute disposable-only Firebase Auth/Firestore/Functions/Storage native tests on a **source-pinned clean exact latest #366 checkout**, no real credentials. The unified runner checks the **42 original source blob pins** on the pre-handoff R888 code; documentation commits do not change those pins, but *any executable file amendment requires explicit revalidation*. On a clean reviewed runner:

```bash
git checkout --detach <EXACT_CURRENT_JOBS_PR_366_HEAD_SHA>
test -z "$(git status --porcelain --untracked-files=all)"
pnpm install --frozen-lockfile
node --test scripts/r888-quota-ledger-deletion-contract.test.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY \
URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)" \
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

4. Preserve original uncensored test log artifacts, SHA-256, tool versions and exact commit/lockfile SHA. Distinguish tests authored, executed, passed, skipped, failed, and blocked; do not relabel negative-denial tests as positive render acceptance.
5. Independently reconcile production-equivalent staging IAM evidence for all GCS writer identities and physical post-ACK future-write denial with express owner approval; **do not activate positive private consent or rendering as a shortcut.**
6. Publish any proven correction **on a new child review PR**, update master Genesis #266 and issue trackers, maintain HOLD until all categories pass.

## 8. Definition of DONE

One actual integrated, secure, working Jobs pipeline **at one exact reviewed source SHA**: full frozen original source build/typecheck; real authenticated create→queue→lease→worker→Studio derivative→private Replay→revocation/deletion, owner/tenant/source-consent validated at every boundary; native negative races and quota; physical GCS IAM post-revocation future-write denial for every privileged path; signed positive consent/provenance; protected owner delivery; raw source-pinned logs; independent reviewed production authorization. Until then, **Production HOLD**.

### The next Chalk's first sentence should be:

`Continue One UrAi Genesis Jobs from GitHub draft PR #366 and the R889 next-Chalk handoff. Read both exact source and master Genesis registry; confirm heads, test the complete converged engine, do not rebuild, preserve all workers. Keep P0 #252 and production HOLD until genuine privileged Storage revocation and full integrated native acceptance are proved.`
