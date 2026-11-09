# ONE URAI GENESIS — R971 Firebase Rules Authority, Jobs Owner-Field and Release Gate Reconciliation

**Checkpoint:** R971 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Additive source/metadata reconciliation after R970. The purpose is to make three concrete source-level risks unambiguous for the next Chalk: shared Firestore Rules publisher collision, Privacy Functions-only deployment boundary, and Jobs server-owned deletion-request field protection. This pass is read-only except for documentation.

## 0. Executive determination

R971 confirms and sharpens R970; it does not establish provider reality or production safety.

1. R970's 19-repository main ref inventory remains the latest broad census in the shared ledger; R971 refreshed the key Jobs/Privacy/Spatial/Labs PR and main refs, but did not repeat all 19 branch reads. R970 said 19/19 refs matched the Round 24 manifest. Do not claim R971 independently repeated all 19 reads.
2. The source-configured collision remains: Spatial, Admin and B2Bportal each select `urai-4dc1d` and Firestore database `(default)`, but each selects a different Rules file. This is **potential source-level competing publisher authority**, not proof that any Rules file was deployed or overwritten.
3. Privacy main and Privacy #186 current head have no root `.firebaserc` in the checked refs. Privacy `firebase.json` selects Firestore/Storage Rules and Functions codebase `privacy`; #186's guarded deployment wrapper explicitly limits deploy scope to `functions:privacy`. Therefore that wrapper does not deploy the changed Privacy `firestore.rules`. A separate, explicit and owner-approved Rules deployment authority is missing from the inspected path.
4. Jobs #380 is still open. Jobs main `firestore.rules` blob `7dc63626c6e1a2e7b20ded280ea2dd070f16abc9` leaves several server-owned fields unprotected by the user self-update field-preservation predicate, including `dataRightsDeletionRequestId`. The R940 review stack's `firestore.rules` blob `cfa77a8fa5e69327ab352b31450c59a036d21e38` still omits `dataRightsDeletionRequestId` from its protected changed-field list.
5. Exact distinction: Jobs PR #378's current live changed-file list contains seven documentation/test files and **does not include `firestore.rules`**. The Rules blob `cfa77a8...` at #378 head is inherited from its base branch `review/chalk-r924-original-studio-transaction-fixture-repair-20261108`; #378's test-only diff does not itself repair the Rules gap. Do not claim #378's seven-file test diff is a Rules fix.
6. Privacy #186 and Spatial #1964 remain separate draft Rules candidates with different semantics and ancestry. Spatial #1964 is 1,489 commits ahead of Spatial main but 13 commits over its intended #1962 parent across six paths. Never merge/retarget the full stack merely to take its Rules fragment.
7. Current Actions evidence remains inconclusive: sampled workflow conclusions are failure; step summaries are null/empty and job log retrieval returned BlobNotFound 404. No application-level failure cause or passing acceptance is established.

No tests, emulator commands, builds, typechecks, deploys, provider inventory, Rules/IAM mutations, real job dispatch, customer media access or paid compute were performed in R971.

## 1. Exact live refs refreshed

### Main refs
- Jobs main: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; branch metadata `protected:false`, required checks off.
- Privacy main: `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`; branch metadata `protected:false`.
- Spatial main: `da94837c2457b0a7590e26a7a644cd728de8afb8`; branch metadata `protected:false`.

### Current PR refs
| Repository / PR | Head SHA | State |
|---|---|---|
| Jobs #378 R940 test review | `5881a650230c55245c87a001c58f3ebc6835196b` | Open/draft/unmerged |
| Jobs #379 forensic documentation | `e3a16bfcbb281cbcfed32cf121a23a0ac579a928` at R971 read | Open/draft/unmerged |
| Jobs #389 R952 auth-gate candidate | `b865209cc352241602d8b9714672f3401aed7669` | Open/draft/unmerged |
| Jobs #390 Studio→Jobs Zod candidate | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open/draft/unmerged |
| Jobs #391 R932 regex correction | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Open/draft/unmerged |
| Labs #261 federated Rules source-authority guard | `2980ca804fe04c37256a00af6e291a79a05004e4` | Open/draft/unmerged |
| Labs #284 project/repository source registry | `6e1f9c8ae8ac2d80835da008d46cf1d6d089ef23` | Open/draft/unmerged |
| Privacy #186 shared-profile / deletion Rules candidate | `2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc` | Open/draft/unmerged |
| Spatial #1964 Rules/C1 candidate | `e3347d0e1ee57eaabafcfd50e2b033f7476aecf8` | Open/draft/unmerged |
| Labs #304 cross-chat handoff | `5ee650d6df1e1bbb46aeff7371d21a6232863864` at R971 read | Open/draft/unmerged |

All SHAs are snapshots, not permanent authority. Re-fetch before any source or governance mutation.

## 2. R970 shared Firestore Rules publisher collision — source-only, still unresolved

R970 freshly read the root `.firebaserc` and `firebase.json` from current main for three repositories:

| Repository | Source alias target | Database | Rules file |
|---|---|---|---|
| `urai-spatial` | `urai-4dc1d` | `(default)` | `firebase/firestore.rules` |
| `urai-admin` | `urai-4dc1d` | `(default)` | `firestore.rules` |
| `B2Bportal` | `urai-4dc1d` | `(default)` | `firestore.rules` |

Exact blobs and commit identities are in `JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md` and its JSON checkpoint:
- Spatial `.firebaserc` `0d4fc68d65f23254829cc0502621a6ffe2215788`; `firebase.json` `2466dd32ddb52c672f9d6700cf1470c451c55b7c`.
- Admin `.firebaserc` `48b58a1e42c3554ead35cba801e980f0afdeaf2f`; `firebase.json` `9cdb6bfa298c46376fbdd1b1604df5b530ccd39b`.
- B2Bportal `.firebaserc` `ea4ae23452b00fea090b411114cfd164200205fd`; `firebase.json` `f93da458dc32acd6b4217a24f0d2db902deb086a`.

Labs PR #261 contains an explicit source-only detector:
- `governance/one-urai-federated-firestore-source-snapshot-2026-11-06.json`
- `scripts/check-federated-firestore-authority.mjs`
- `scripts/check-federated-firestore-authority.test.mjs`
- `docs/release/R841_FEDERATED_FIRESTORE_AUTHORITY_HOLD_2026-11-06.md`

The detector asserts that every required repo is represented, exact commit/blob hashes are well-formed, aliases are deduplicated per repository and shared `project/database` targets are surfaced even if the rules bytes match. Its comments explicitly state it is source configuration only and cannot prove provider effective Rules.

The test source has eight Node test cases in the PR patch, but R971 did not execute them. A code 2 from the detector means the snapshot sees competing Rules publishers; it is not proof of actual deployment or data exposure.

**Required resolution:** owner-authorized read-only Firebase provider inventory must identify the actual project number, database identities, deployed Rules release/etag/source, deploy principals and project/directory owners. Then choose one accountable Rules publisher for a shared database or explicitly separate services into approved database/project boundaries. Only after that can combined cross-service Rules tests and an approved deployment plan be written.

## 3. Privacy root project and deployment boundary

R970 inspected Privacy main:
- Main SHA `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`.
- Root `.firebaserc` was not found at that exact ref (contents endpoint 404).
- `firebase.json` blob: `04a0a54c96abde147a61ab800d924a8c56130109`.
- It names Firestore Rules path `firestore.rules`, Storage Rules path `storage.rules`, Functions source `functions`, codebase `privacy`, runtime Node 22.
- Labs #284's 23-project registry includes a supplied seed ID `urai-privacy`; this is a registry input, not proof of project existence, actual account ownership or deployment target.

Privacy #186 current head `2d0c7b6...` adds `scripts/guarded-firebase-deploy.mjs`. R970 inspected the script and package config; its deployment command is constrained to:
`--only functions:privacy`
with explicit `--project`, approved project environment, exact source commit and clean-tree requirements. It rejects caller-supplied deployment scope flags.

This means #186's changed `firestore.rules` is not deployed by that wrapper. That is an intentional safety boundary against accidentally replacing Spatial-owned shared Rules; it also means no claim can be made that the Privacy #186 Rules change is active. A separate owner-approved Rules publishing procedure, project/database identity and actual deployed Rules readback are prerequisites.

Do not create a root `.firebaserc` or guess `--project urai-privacy` to make deploy work. A seed ID is not provider evidence.

## 4. Jobs #380 — current field protection gap and #378 test-only diff distinction

Issue [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) remains OPEN.

### Main Rules source
- Jobs main exact SHA: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- `firestore.rules` blob: `7dc63626c6e1a2e7b20ded280ea2dd070f16abc9`.
- The user self-update predicate on `users/{uid}` protects only a narrow unchanged set in the source; fields including `tenantId`, `accountStatus`, `deleted`, `markedForDeletion`, `dataRightsDeletionPendingCentralPrivacy`, `dataRightsDeletionRequestId`, and `jobsCreateRateLimit` are not all protected by the original main predicate.

### R940 review stack
- #378 exact head: `5881a650230c55245c87a001c58f3ebc6835196b`.
- `firestore.rules` at that head: blob `cfa77a8fa5e69327ab352b31450c59a036d21e38`.
- That same blob is present at #378's declared base `review/chalk-r924-original-studio-transaction-fixture-repair-20261108`; it is inherited from the base in this PR.
- The live #378 changed-file list has exactly seven paths: one source/test handoff doc and six scripts/test files. It does **not** include `firestore.rules`.
- The #378 patch updates original-source security test fixtures/contracts; do not call this PR a Rules repair.

The issue #380 body records that the R940 Rules candidate's affected-key list protects a subset of the privileged profile fields but leaves `dataRightsDeletionRequestId` omitted. R971 directly fetched the exact #378 head/base Rules bytes and confirmed the field name is not present in that Rules file. The main Rules file also lacks it.

### Risk classification and next action
This is a source-level user self-update Rules gap. It does not prove a deployed exploit or that a malicious mutation will succeed under the complete Rules engine. Execution-side ID/request equality may fail closed and disrupt legitimate deletion processing rather than grant access. Do not overstate.

Required fix: a separately reviewed Rules candidate must include the complete server-owned field set, including `dataRightsDeletionRequestId`, and authenticated native Firebase Rules emulator tests must deny add/change/remove for every protected field while retaining permitted owner profile edits and server/admin actions. Verify deployed Rules and field contract with Privacy/Studio/Jobs owners.

## 5. Four core Jobs issues — all still OPEN

| Issue | Priority | Fresh R971 status | Acceptance requirement |
|---|---|---|---|
| [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) | P0 | Open | Durable future-write fence; stale/alternate GCS writer 403; in-flight/resumable upload drain; exact-generation delete; downstream physical-purge ACK |
| [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) | P1 | Open | Durable authority/lease or approved continuation policy after operator withdrawal; synthetic 12/12 evidence is not live provider proof |
| [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) | P1 | Open | Complete protected field set, especially dataRightsDeletionRequestId; native authenticated Rules emulator and deployed Rules proof |
| [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) | P2 | Open | Concurrent createJob quota admission under original transaction; same-key idempotency/tenant/late-window checks |

#376's body reports 12/12 diagnostic cases under in-memory synthetic stubs after transpiling the original executor/helpers, including admitted operations continuing after simulated operator role withdrawal. It explicitly is not Firebase, GCS, deployed runtime, protected staging or proof of an authorized central continuation policy. Preserve that exact evidence grade.

#345 remains a potential race based on pre-transaction rate counting, not a proven deployed bypass. Requires native Auth/Firestore/Functions emulator concurrency reproduction.

#252 remains the P0. Local derivative cleanup and prefix listing are not a future-write fence. No live GCS stale-writer 403, upload drain or physical purge ACK was shown in R971.

## 6. Current CI interpretation

R970 queried current candidate workflow metadata:
- Privacy #186: 8 sampled PR workflow runs with completed/failure conclusions; sampled release job steps null; job log 404 BlobNotFound.
- Spatial #1964: 12 sampled runs completed/failure; sampled private-memory emulator job steps null; log 404 BlobNotFound.
- Jobs #390/#391: 9 sampled runs each completed/failure; #391 runtime job steps null; Callable emulator E2E skipped; log 404 BlobNotFound.

These are workflow conclusions, not application test receipts. R971 did not rerun any workflow. Do not describe them as tests passed or failed; record exact status with unavailable step/log evidence.

Earlier #389 failures also remain nonpassing; no protected CI certificate exists.

## 7. R971 execution ledger

Performed:
- Refreshed Jobs #379/#378/#389/#390/#391 metadata and changed-file scope.
- Refreshed Labs #261/#284 and Privacy #186 / Spatial #1964 candidate metadata.
- Refreshed Jobs main, Privacy main and Spatial main branch heads/protected metadata.
- Read the full Jobs #380 and #252 issue bodies, Jobs #376 and #345 issue bodies.
- Fetched Jobs main `firestore.rules`, R940 #378 head `firestore.rules`, and #378 base `firestore.rules`; confirmed exact blobs and field omission.
- Read Labs #261 patch; confirmed it is a source-config collision detector and docs/snapshot, not a provider query.
- Re-read R970 Firebase topology and Rules/CI report/checkpoint.

Not performed:
- no local clone/checkout or dependency install;
- no R841 static detector or eight-case test execution;
- no Jobs #378 tests, Rules emulator, or actual Firestore Rules evaluator;
- no build/typecheck;
- no Firebase/GCP provider inventory, deployed Rules readback or effective IAM;
- no Cloud Run/Functions deployment or rollback;
- no GCS 403/upload drain/purge test;
- no CI rerun;
- no merge, deploy, source, IAM, Rules or billing mutation;
- no private media or customer records accessed.

## 8. R972 exact next-worker sequence

1. Read the R970 19-repository / Firebase Rules report and machine checkpoint, then this R971 report and R971 machine checkpoint.
2. Refresh all 19 main refs plus Jobs main, #378/#379/#389/#390/#391, Labs #261/#284/#304, Privacy main/#186/#183/#214/#224/#232, Spatial main/#1962/#1964 and Studio #198–#201.
3. Ask the authorized Firebase owner/admin for a read-only provider A inventory of project numbers, actual database identities, deployed Rules releases/etags, deployment principals and Firebase CLI deployment history for `urai-4dc1d`. Do not infer effective state from source aliases.
4. Reconcile Spatial/Admin/B2Bportal Rules authority. Determine one accountable publisher for the shared default DB or approved separate database/project topology. Preserve each service's collection ownership and combined authorization requirements.
5. Confirm Privacy's actual intended project and deployment region. Keep #186's `functions:privacy` wrapper scope; create no separate Rules publish command until project and owner authority are explicit.
6. Prepare a server-owned user-profile field matrix for Privacy/Jobs/Studio/Spatial; include uid/userId/ownerId, all ten privileged fields, `dataRightsDeletionRequestId`, tombstone/lease markers, admin/founder/service authority.
7. Implement a separate review-only #380 Rules candidate with the complete field set, then run native signed-in Auth/Firestore Rules tests for attempted add/change/remove per protected field. Verify existing owner-safe profile edits remain possible and server operations are correctly scoped.
8. Run Labs #261 static source detector/tests on its exact head; retain classification as source-only, not provider deployment proof.
9. Recover protected CI step logs or establish a protected clean runner. Do not infer application failure from missing logs and do not rerun blindly.
10. Keep R647, Jobs #371 and R818/R836 separate. Preserve source pins and test scope.
11. Independently close Jobs #252: actual nonproduction GCS 403 for every privileged/alternate writer, upload drain, exact-generation physical deletion, final absence and durable downstream ACK.
12. Complete #376 continuation policy, #345 concurrency acceptance, deployed source/image/revision/IAM inventory, rollback, private Replay/C1 lifecycle, accessibility/device/visual and founder GO.

## 9. Final disposition

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

R971 adds exact source facts and clarifies which PR contains tests versus inherited Rules code. It does not establish that any Rules file is deployed or that the shared project is currently overwritten. It does not prove a customer exploit, and it does not make the source gap harmless.

No merge, deploy, Rules/IAM mutation, CI bypass, C6 enablement, revocation dispatch, private media, paid compute or production GO.
