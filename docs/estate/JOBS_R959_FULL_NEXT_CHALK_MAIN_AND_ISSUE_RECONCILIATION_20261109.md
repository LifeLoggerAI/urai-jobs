# ONE URAI GENESIS — Jobs R959 Full Continuity, Main-Branch Reconciliation and Open-Issue Audit

**Checkpoint:** R959 · November 9, 2026  
**Release decision:** **PRODUCTION HOLD / NO-GO**

## 0. Executive disposition

R959 performed read-only GitHub reconciliation and documentation. No application source, workflow, branch-protection setting, Ruleset, CI run, cloud resource, IAM, Firebase Rules, customer job, or private-media data was changed.

Newly verified:

1. Jobs main now points to **2bcdbcf34da4a3fe58619286d6917e2d4fa624e1**, not the earlier 9d29be1bcd3a45a4b9a743df9c9706c00811f38b.
2. The new commit message is “Revert accidental default-branch R933 test-file update; keep review changes isolated.”
3. Its patch deletes exactly one 90-line test file: scripts/studio-life-movie-actual-producer-zod-contract.test.mjs. The resulting tree SHA 282bd75464cc23d9a6add6a1340c6ae7d3adfc9a is identical to the tree SHA reported for earlier main. The tracked main tree is restored to its earlier content, while history now contains the add-then-delete commits.
4. The revert commit is unsigned (verification false, reason unsigned). This is not evidence of malicious activity; it is a governance/evidence fact.
5. Main remains unprotected: protected false, protection disabled, required checks enforcement off, no required contexts/checks. Rulesets including parents returns an empty array.
6. Engineering PR #389 remains open/draft/unmerged at b865209cc352241602d8b9714672f3401aed7669. No new Actions runs appeared; the same ten prior failures remain. Their pre-runner-allocation cause is unknown.
7. Jobs #252, #376, #380 and #345 are all still open. No new substantive resolution was found in the issue comments inspected.

The R958 canonical handoff remains the primary historical entrypoint, with R959 as the latest status supplement.

## 1. Current exact GitHub state

### 1.1 Jobs main reconciliation

Current live main branch:
- SHA: 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1
- Parent: 792d063b9d894bb9cb872e2c3c6dd71e37804f6a
- Tree: 282bd75464cc23d9a6add6a1340c6ae7d3adfc9a
- Message: Revert accidental default-branch R933 test-file update; keep review changes isolated
- Signature: unverified / unsigned.

Parent commit #R933:
- SHA: 792d063b9d894bb9cb872e2c3c6dd71e37804f6a
- Message: R933: repair over-escaped source matcher regexes in producer-consumer regression
- Patch added scripts/studio-life-movie-actual-producer-zod-contract.test.mjs, 90 lines.

Revert commit #2bcdbcf deletes only that same 90-line file. Its resulting tree SHA 282bd754... exactly matches the tree SHA reported for earlier main commit 9d29be1bcd3a45a4b9a743df9c9706c00811f38b. Thus the accidental addition is removed from the current main tree; no other tracked-tree change is shown in this revert patch. Do not rewrite history.

Direct links:
- https://github.com/LifeLoggerAI/urai-jobs/commit/2bcdbcf34da4a3fe58619286d6917e2d4fa624e1
- https://github.com/LifeLoggerAI/urai-jobs/commit/792d063b9d894bb9cb872e2c3c6dd71e37804f6a

### 1.2 Main branch governance — still a release blocker

Current branch API:
- protected=false
- protection.enabled=false
- required_status_checks.enforcement_level=off
- contexts=[]
- checks=[]

Repository Rulesets endpoint queried with inherited rules returned [].

No active branch protection or required-check enforcement is reported. Authorized repository administration must configure approved policy and verify it by fresh API readback. R959 did not change settings.

### 1.3 Engineering PR state

| PR | Head SHA | State | Scope |
|---|---|---|---|
| #387 | 04592f8573c708954f95f87ddca1e168efde51f4 | Open draft | Narrator canonical Docker/HTTP auth checker |
| #388 | 17b8f53ac1f4c75ac2abdd50a3bd631e61196c38 | Open draft | Production/staging-first bearer guard corrections |
| #389 | b865209cc352241602d8b9714672f3401aed7669 | Open draft | Mandatory auth test enrollment in root + R879 |

#389 is based on the R951 review branch, not main. Its exact three-file patch is unchanged. The root 78 command segments are enrolled but not executed. R879 pins source and requires the four-case test stage, but the full guarded runner remains unexecuted on a complete checkout.

### 1.4 Documentation PR state

At R959 readback before writing this report:
- Jobs #379: open/draft/unmerged; docs branch docs/genesis-jobs-firebase-forensics-20261109; observed head 01a0266674e05cd8ec2d6f69e3dfba15b7c6e746.
- Genesis #304: open/draft/unmerged; docs branch docs/genesis-jobs-r944-crosschat-handoff-20261109; observed head fbebc70e9d1f9fca346ddebd0487a0400a3d895c.

Refresh exact documentation branch heads after R959 commits.

## 2. Actions/CI status

The workflow-run query at #389 head b865209... still returns the same ten prior runs:
- System Audit 42589887660
- Production Verify 42589887640
- Typecheck Diagnostics 42589887621
- Runtime CI 42589887656
- Career Surfaces CI 42589887624
- CI 42589887604
- Final CI 42589887690
- Defined Gitlink Guard 42589887581
- Firebase CLI Pin Guard 42589887663
- Visual Proof 42589887599

R956 raw job details showed 12 executed job records with runner ID 0, empty runner name/group, zero steps and 2–4 second job lifetimes. Runtime callable emulator E2E was skipped. R957 inspected five workflow YAMLs; all use ubuntu-latest, not a self-hosted runner selector.

CI is not green/certified. Source tests/builds are not proven to have failed because no steps ran. Exact GitHub-side runner provisioning cause is UNKNOWN. Do not attribute the failure to billing, plan, hosted-runner outage, concurrency, permissions or YAML absent evidence. No reruns were initiated in R959.

## 3. Central unresolved Jobs issues — freshly checked

All four issues remain OPEN.

### P0 — Jobs #252: Storage-enforced post-revocation write fence and active-upload drain

https://github.com/LifeLoggerAI/urai-jobs/issues/252

The issue describes the fundamental P0:
- Studio worker writes private objects through privileged Storage createWriteStream sites.
- Prior in-memory tracking of pending writes/written objects is not a durable, transactional upload lease.
- A point-in-time object inventory/deletion does not guarantee that an old or alternate writer cannot create a new object immediately afterward.
- No real live GCS IAM negative proof establishes that every stale/alternate writer receives 403 after consent withdrawal.

Required acceptance:
1. Monotonic server-owned revocation epoch/fence.
2. Durable writer admission/lease reservation before any upload bytes.
3. Remove/restrict unrestricted privileged worker GCS write authority in the approved design; exact scoped write authority only.
4. Prove every stale, alternate, retry, resumable and in-flight write is denied or fenced.
5. Drain/cancel/finalize every admitted upload.
6. Delete exact object generation and obtain durable downstream purge acknowledgement.
7. Preserve Studio render and private-output hard-offs until independent proof.

The last visible issue discussion inspected remained an R891-era note; no new R959 P0 completion evidence.

### P1 — Jobs #376: Data-rights executor post-admission revocation/continuation policy

https://github.com/LifeLoggerAI/urai-jobs/issues/376

Initial Firestore admission rechecks current operator, but after commit the asynchronous Jobs export/delete side effect needs a durable authorization/finalization policy. Do not blanket-abort legitimate user deletion just because an initiating operator later loses a role; policy must define persisted approval authority, lease/epoch, cancellation and safe completion semantics. Existing R900 in-memory reproductions are diagnostic, not live Firebase/GCS proof. Issue remains OPEN.

### P1 — Jobs #380: user self-update Rules leave server-owned data-rights request binding mutable

https://github.com/LifeLoggerAI/urai-jobs/issues/380

The issue body records that the R940 candidate protected tenant/account/deletion lifecycle fields but omitted dataRightsDeletionRequestId from the affected-key protection list. This is a source-level Rules gap; effective deployed Rules and native authenticated emulator behavior remain unverified. Next action: source convergence plus native signed-ID-token Rules tests proving denied add/change/remove of the server-owned binding while normal allowed owner profile edits continue to work. Issue remains OPEN.

### P2 — Jobs #345: concurrent createJob rate-limit admission

https://github.com/LifeLoggerAI/urai-jobs/issues/345

The source review identifies a possible race: rate-limit count is read before the create transaction, so concurrent distinct-key admissions may observe the same count. This remains a potential overshoot, not a proven deployed bypass. Acceptance is a disposable Auth/Firestore/Functions emulator test with limit-1 warm state and multiple concurrent create attempts, late-window boundary, retries, same-key idempotency, tenant isolation and no partial side effects. Verify installed index parity. Issue remains OPEN.

## 4. Authentication source gate — evidence grades

#389 includes scripts/r951-worker-emulator-auth-precedence.test.mjs in root urai-jobs:verify and the guarded R879 runner with exact blob pin and mandatory # pass 4 stage.

Exact blobs:
- package bd50af6bead1c62f36ada6c012123fe0c5d94da7
- R879 runner 8a42dcad4416d5896b4886d6c5bad079463d5324
- original R951 test d27cc3880aa2ae0387f81bb660ca340d830e22dc

The original test reads four implementation files:
- workers/asset-worker/index.js
- workers/studio-worker/index.js
- workers/private-source-worker/src/index.ts
- workers/spatial-worker/index.js

It compares exact bypass expressions, checks for bearer-guard text, and evaluates expression behavior over six environments × two emulator flag settings. It is not an HTTP middleware test or invocation of deployed routes.

Evidence:
- R951/R952 48/48 source-extracted expression matrix: reported PASS, same source-excerpt matrix; not HTTP.
- R953 4/4 original test using matched abbreviated source excerpts; mutation detected; not full source modules or native Firebase.
- R954 4/4 adapted harness using complete source files reported; deliberate mutation detected. Preserve as historical reported receipt. Do not describe as five worker files; original test consumes four worker implementation files, with the fifth byte-checked object possibly the test itself. Recover exact R954 manifest before stronger claims.
- R955–R959 source/readback audits; no new fresh execution of original test.
- 78 root command segments are enrolled, not executed.
- Native four-emulator R879 acceptance is not executed on current reviewed head.

## 5. R949–R950 deployment and worker boundaries

- Canonical production deployment workflow has approval/source/identity/secret-version controls in source.
- Legacy Firebase deployment, generic IAM bootstrap and generic managed-worker deploy paths are blocked in reviewed source. This does not revoke historic live IAM grants.
- Legacy manual smoke rollback workflow was a false-success placeholder; review PR #386 changes it to fail explicitly, original offline hard-stop test 3/3. A separate Cloud Run rollback script contains traffic-update logic but has not been live-rehearsed/certified.
- Studio lifeMovieConsentAuthorityAvailable() returns false; render path fails closed with 503.
- Studio privateOutputWriteAuthorityAvailable() returns false before private MP4/SRT GCS write sites.
- Narrator canonical Docker selects authenticated src/index.ts; legacy root file retained unprotected. Live deployed image/ingress remains unknown.
- Asset, Studio, Private Source and legacy Spatial production-first bearer-guard changes are review candidates, not production deployment evidence.

Do not disable hard-offs to make readiness green.

## 6. Full acceptance and release taskbook

### P0
- Real GCS 403 after revoke for all stale/alternate/privileged identities.
- Durable upload attempt reservation and in-flight drain.
- Exact generation deletion and durable downstream ACK.
- Positive owner consent → Privacy → Studio → Jobs private MP4/SRT → Spatial owner-only Replay, then revocation/deletion/purge ACK.

### P1
- Original auth test on full clean checkout and immutable reviewed SHA.
- All 78 root commands with raw logs, SHA-256, exit codes and tool versions.
- Full build/typecheck.
- Four disposable Firebase emulators under guarded R879, no production credentials.
- Real worker HTTP tests: missing, malformed, wrong, revoked, valid token; production/staging with emulator flag true.
- Resolve #376 and #380.
- Main branch protection/rulesets and required checks.
- Independent eligible reviewer and governed rollback rehearsal.

### P2
- #345 concurrent quota race; installed composite index parity.

### P3
- Authenticated read-only live Firebase/GCP inventory: project, databases, Rules, installed indexes, Functions, Cloud Run images/revisions/traffic/ingress/service identities, Storage buckets and inherited IAM, Tasks/Scheduler/PubSub/Eventarc, logs, quotas and billing. Record deployed source/image digest.

## 7. Next Chalk exact order

1. Read R958 canonical report and machine checkpoint, then this R959 report.
2. Re-fetch #387/#388/#389, #379/#304, main branch, Rulesets, issues #252/#376/#380/#345 and latest workflow runs. SHAs here are snapshots.
3. Verify main commit #2bcdbcf and tree 282bd754...; preserve unsigned status and one-file revert. Do not rewrite history or re-add the R933 file to main.
4. Resolve main governance through authorized admin only: configure main branch protection/ruleset, PR requirement, exact required CI checks, independent review and no-bypass policy; read back settings. No such mutation was done in R959.
5. Resolve Actions runner failure with full GitHub-side diagnostics. Do not rerun ten jobs blindly. First establish whether GitHub can assign a hosted runner, then perform a single narrow review-only run if approved.
6. On an already authorized, free, credential-free complete Jobs checkout at immutable #389 source SHA, run the original standalone auth test, all 78 commands, typecheck/build, and guarded R879 four-emulator suite. If no such host exists, state the precise blocker; remote source inspection is not execution.
7. Add actual HTTP auth tests, and resolve #252/#376/#380/#345 as separate criteria.
8. Verify real provider resources and IAM; do not treat UNKNOWN as absence.
9. Update Jobs #379 and Genesis #304 plus #389 description with exact receipts, review branch state, open issues and blockers.

## 8. Governance and execution boundaries

- No default-branch code edits; use isolated branches and exact reviewed source ancestry.
- Preserve original PR donor branches; do not overwrite a peer branch.
- Do not merge #387/#388/#389 or historical work into main without source reconciliation, independent review, passing protected CI and explicit release authority.
- Do not disable Studio consent/private output hard-offs.
- No paid compute/provider credits, real job dispatch, private user media, customer data, cloud writes or IAM changes in this R959 pass.
- Keep one evidence grade per result: source inspected, Git object matched, isolated test, native emulator, HTTP integration, provider IAM proof, production acceptance.

## 9. Final disposition

**ONE URAI GENESIS — JOBS: PRODUCTION HOLD / NO-GO.**

R959 improved continuity and explained the current main-branch revert. It did not pass runtime acceptance, certify live storage revocation, fix branch governance, establish CI health or authorize launch.

---
*All metadata snapshots were refreshed through GitHub at R959. Re-fetch before any mutation.*
