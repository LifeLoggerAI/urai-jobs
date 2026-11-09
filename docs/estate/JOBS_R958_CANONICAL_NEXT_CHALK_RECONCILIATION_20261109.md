# ONE URAI GENESIS — Jobs R958 Canonical Next-Chalk Reconciliation

**Checkpoint:** R958 · November 9, 2026  
**Release decision:** **PRODUCTION HOLD / NO-GO**  
**Purpose:** Provide the next Chalk with one source-pinned entrypoint to the Jobs R944–R958 evidence, current GitHub state, CI/governance blockers, security boundaries, and exact continuation plan.

## 0. Executive disposition

R958 is a documentation and reconciliation checkpoint. It does not claim the Jobs test suite, native Firebase acceptance, production IAM, or private Replay flow has passed.

The most significant current findings are:

1. Jobs production `main` still resolves to `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. Live GitHub branch metadata reports `protected:false`, `protection.enabled:false`, required status-check enforcement `off`, and no required contexts/checks. The repository Rulesets API query with `includes_parents=true` returned an empty array. **Main-branch governance is not satisfied.**
2. The latest engineering candidate remains Jobs PR [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389), open/draft/unmerged at `b865209cc352241602d8b9714672f3401aed7669`, based on the R951 review branch, not main.
3. Ten Actions workflow runs for #389 failed before any recorded workflow steps. Raw job metadata has `runner_id=0`, blank runner/group names, zero steps, and 2–4 second job lifetimes. The workflows inspected specify `ubuntu-latest`; they do not select a self-hosted runner. This is a strong pre-runner-allocation signature. **The exact GitHub-side cause is unknown.**
4. The R952 authentication regression is enrolled into both root verification and the guarded R879 runner. **78 command segments are enrolled, not executed.** The original checked-in test is source-reading/expression-evaluation, not an HTTP middleware or deployed-service test.
5. Studio's Life Movie consent and private-output write authorities remain deliberately hard-off. Effective GCS IAM, post-revocation 403, in-flight upload drain, exact-generation deletion, downstream ACK, authenticated owner Replay, and live deployed revision parity remain unverified.

No merge, deployment, production IAM/Rules change, workflow rerun, paid compute, customer job, or private-media operation was performed by R958.

## 1. Canonical read order — do not repeat discovery

Jobs repository: `LifeLoggerAI/urai-jobs`.  
Master Genesis estate registry: [Labs PR #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), entrypoint `docs/estate/00_START_HERE.md`.  
Jobs cumulative audit/archive PR: [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379).  
Genesis cross-chat continuity PR: [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).

Read in this order:

1. This document: `docs/estate/JOBS_R958_CANONICAL_NEXT_CHALK_RECONCILIATION_20261109.md`.
2. `docs/estate/JOBS_R958_MACHINE_CHECKPOINT_20261109.json`.
3. Updated `docs/estate/JOBS_R944_START_NEXT_CHALK_20261109.md` (now points to R958 first).
4. `docs/estate/JOBS_R957_BRANCH_PROTECTION_ACTIONS_GOVERNANCE_HOLD_20261109.md`.
5. `docs/estate/JOBS_R956_ACTIONS_RUNNER_ALLOCATION_FORENSICS_HOLD_20261109.md`.
6. `docs/estate/JOBS_R955_INDEPENDENT_REVIEW_R952_GATE_AND_CI_HOLD_20261109.md`.
7. `docs/estate/JOBS_R954_FULL_SOURCE_RECONCILIATION_NEXT_CHALK_HOLD_20261109.md`.
8. The original cumulative R944 inventory, test ledger, P0–P3 taskbook and the R953 canonical report/checkpoint, all retained in #379's documentation branch.
9. Inspect live PR metadata and tree before acting; all SHAs below are observed checkpoint identities, not permanent assumptions.

The R944 matrix is still important for the 27 exported Functions, 12 active runtime job types, legacy taxonomy differences, Firebase source configuration, and live-resource unknowns. The R944 evidence ledger preserves historical receipts without adding unlike tests together. The R944 P0–P3 taskbook contains original safe execution contracts. R953 machine checkpoint is historical baseline; R958 JSON supersedes its latest-status fields without deleting R953 evidence.

## 2. Current GitHub state — refreshed R958 readback

### 2.1 Jobs production main

Live branch API at R958 readback:
- Branch: `main`
- SHA: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- `protected=false`
- `protection.enabled=false`
- required status check enforcement: `off`
- required contexts: empty
- required check list: empty

Repository Rulesets endpoint queried with inherited rules included returned `[]`.

**Meaning:** no active branch protection or required-check enforcement is reported by the GitHub API. Do not call main “protected.” Authorized repository administration must configure the approved governance policy and then verify exact readback. R958 did not change branch settings.

### 2.2 Engineering PR chain

| PR | Purpose | Base | Head SHA | Current state |
|---|---|---|---|---|
| [#387](https://github.com/LifeLoggerAI/urai-jobs/pull/387) | R950 Narrator canonical entrypoint and protected execution-route contract | R949 rollback review | `04592f8573c708954f95f87ddca1e168efde51f4` | Open draft |
| [#388](https://github.com/LifeLoggerAI/urai-jobs/pull/388) | R951 production/staging-first bearer guards for four worker modules | #387 branch | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Open draft |
| [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389) | R952 mandatory authentication regression enrollment | #388 branch | `b865209cc352241602d8b9714672f3401aed7669` | Open draft |

#389 exact file set:
- `package.json`
- `scripts/run-r879-unified-native-acceptance.sh`
- `docs/security/R952_AUTH_REGRESSION_ENROLLED_VERIFICATION_HANDOFF_HOLD_20261109.md`

Exact source objects:
- package blob: `bd50af6bead1c62f36ada6c012123fe0c5d94da7`
- R879 runner blob: `8a42dcad4416d5896b4886d6c5bad079463d5324`
- original R951 standalone test blob: `d27cc3880aa2ae0387f81bb660ca340d830e22dc`

#389 is review-only and not production-authoritative.

### 2.3 Documentation PRs

At last live readback before the R958 writes:
- Jobs #379 was open/draft/unmerged, base main at the recorded main SHA, documentation branch `docs/genesis-jobs-firebase-forensics-20261109`.
- Genesis #304 was open/draft/unmerged, documentation branch `docs/genesis-jobs-r944-crosschat-handoff-20261109`.

R958 adds this report, its machine checkpoint, the updated START NEXT CHALK entrypoint, and a Genesis continuity note. Re-fetch actual PR/branch heads after these commits; do not reuse prior documentation branch SHAs.

## 3. R954–R957 reconciliation, with evidence grades

### R954 — complete-source auth check (reported evidence)
User-provided R954 report stated five complete original source files were Git-blob verified, four authentication regression groups passed in an adapted harness, the unsafe mutation was detected (3 pass / 1 expected fail), and the corrected condition was restored to 4/4. Preserve as R954 historical evidence.

**Clarification:** R955's direct inspection of the original R951 test shows that test reads four worker implementation files:
- `workers/asset-worker/index.js`
- `workers/studio-worker/index.js`
- `workers/private-source-worker/src/index.ts`
- `workers/spatial-worker/index.js`

The fifth file in the reviewed source set may be the standalone test itself; do not describe this as five distinct worker implementations. R954's per-file receipt/hash list should be consulted before assigning the exact five-object identity. R955 did not rerun the R954 harness.

### R955 — source and CI readback
Confirmed #389 was open/draft/unmerged, exact SHA and three-file scope. Confirmed test enrollment in root verification and guarded R879. Ten Actions runs failed; step-list API returned zero steps for all sampled jobs. The checked-in R951 test is source-reading/expression evaluation, not HTTP integration.

### R956 — raw runner metadata
Representative/raw run and job queries showed:
- all ten workflows were pull-request runs against #389's exact head;
- 12 non-skipped job records had `runner_id=0`, blank runner and runner group, zero recorded steps;
- jobs completed about 2–4 seconds after start;
- Callable emulator E2E was skipped;
- combined commit status contained no status entries.

This supports a pre-runner-allocation failure. It does **not** identify GitHub's exact cause. Do not claim billing, quota, GitHub outage, or source failure without matching diagnostic evidence.

### R957 — workflow and governance inspection
Five relevant workflow files were read at #389's head:
- `.github/workflows/urai-jobs-runtime-ci.yml`, blob `296bbf93a543724d6b834e5efdf6c6e34cc579e5`
- `.github/workflows/urai-jobs-final-ci.yml`, blob `ad6e4d882c18d6a6032c666cbddbfd1e69262bc4`
- `.github/workflows/urai-production-verify.yml`, blob `e7b50462126fa0db072addec183a9005cfe36973`
- `.github/workflows/system-audit.yml`, blob `987320c6bb4f18d7461b30dfa19c83a8928e7dcc`
- `.github/workflows/ci.yml`, blob `93d21e147170dc1923ecb2ebb843d02c8962bc28`

They use `runs-on: ubuntu-latest`, not a custom self-hosted runner selector. The main branch API reported protection disabled and Rulesets returned empty.

## 4. Authentication test contract — what it proves and does not prove

Original test: `scripts/r951-worker-emulator-auth-precedence.test.mjs`.

The test reads four worker files and:
1. Finds each `localBypass` or `local` expression.
2. Requires the expression to equal the expected production-first predicate.
3. Checks that the expected bearer guard text exists in the file.
4. Evaluates the extracted expression for six environments (`prod`, `production`, `staging`, `local`, `test`, `development`) with emulator flag false/true.

The root `urai-jobs:verify` package command includes the original Node test once. R879 includes its exact blob pin and a mandatory stage requiring `# pass 4` before later native stages.

**Limitations:** this test does not create an Express app, invoke worker middleware, hit /execute-job or other routes, test bearer parsing with HTTP, inspect actual deployed environment variables, verify deployed image, or read live Cloud Run ingress/IAM. The `source.includes` bearer guard check confirms source text presence, not all route wiring. Add HTTP integration tests as a separate requirement.

Evidence reported across prior checkpoints:
- R951/R952 source-extracted matrix 48/48 PASS, same matrix and same receipt; not 48 HTTP calls.
- R953 original test executed against abbreviated/source-matched excerpts 4/4, mutation detected, then restored 4/4; not complete worker files or full checkout.
- R954 reported complete-source adapted harness 4/4 and mutation detection. This is a distinct reported evidence grade; do not collapse it with R953.
- R955/R956/R957 inspected source/diffs but did not freshly execute the original test.

### 78-command status

78 unique command segments are enrolled in the reviewed `package.json`. They have not been executed together on the exact #389 SHA. Enrolled is not passed.

R879 guarded acceptance additionally demands:
- explicit `--run-exact-review-only`;
- `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY`;
- immutable `URAI_JOBS_ACCEPTANCE_SHA` equal to HEAD;
- clean complete Git checkout and required ancestry;
- source-pin verification;
- Node 22, pnpm 8.15.9, Java and required tools;
- no inherited production credentials, bucket selectors, or forbidden environment;
- disposable emulator project only;
- fail-closed stage result checks and original storage negative test.

Do not relax its guardrails or invoke it with production credentials.

## 5. Actions failure diagnosis — exact remaining uncertainty

Ten prior workflows:
- System Audit: run `42589887660`
- Production Verify: `42589887640`
- Typecheck Diagnostics: `42589887621`
- Runtime CI: `42589887656`
- Career Surfaces CI: `42589887624`
- CI: `42589887604`
- Final CI: `42589887690`
- Defined Gitlink Guard: `42589887581`
- Firebase CLI Pin Guard: `42589887663`
- Visual Proof: `42589887599`

At last inspected metadata these were completed with failure. The executed job records had runner ID zero, blank runner name/group and zero steps; runtime's callable emulator E2E job was skipped.

**Do not rerun blindly.** Next Chalk should obtain complete run/job/check-run diagnostics and any GitHub UI failure text, runner service availability/usage information exposed to an authorized admin, and account/repository Actions restrictions. Correlate exact UTC window with GitHub Status only as corroboration. The GitHub connector could read run/job records but did not provide sufficient evidence to establish precise scheduling/provisioning cause. This stays UNKNOWN.

## 6. Branch governance hard blocker

Current GitHub API readback for Jobs `main`:
- SHA `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- `protected=false`
- protection disabled;
- required status-check enforcement `off`;
- no required contexts/checks.

Rulesets API with inherited rules requested returned an empty array.

**Required authorized action:** a repository administrator must define and implement the approved policy. Minimum acceptance criteria:
- protection/ruleset demonstrably applies to `main`;
- pull requests required; direct pushes restricted;
- selected checks required for the exact HEAD;
- independent eligible approval required;
- stale approvals dismissed or re-approval policy enforced as appropriate;
- required conversations resolved;
- no bypass that defeats the governance model;
- readback verifies active enforcement after save.

R958 is read-only; no rule settings were changed. Do not infer that this governance requirement is met by a workflow file existing.

## 7. Cumulative Jobs source/security/runtime inventory

Historical R944 audit located:
- 27 exported Functions in reviewed source;
- 12 active runtime job types, with legacy registry taxonomy differing;
- earlier source index count main 8 vs review candidate 9;
- Firebase source config includes a Jobs alias and configured Hosting site `urai-jobs-563121397472`;
- two privileged Studio worker GCS write-stream sites;
- client Firestore/Storage Rules deny direct client writes in inspected source.

These are source facts at the recorded commits. They are not actual live resource inventory, installed index proof, deployed function/revision proof, or effective GCS IAM.

### R949 deployment and rollback
- Canonical production deployment workflow has approval, source, identity and secret-version checks in source.
- Legacy Firebase deployment, generic IAM bootstrap and generic managed-worker deployment paths are explicitly blocked in reviewed source.
- The legacy manual `rollback-on-smoke-failure` workflow was a false-success placeholder. [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) corrects it to fail explicitly. Original offline checks reported 3/3 pass.
- A separate Cloud Run rollback script contains a traffic-update operation but has not been operationally rehearsed or live-certified.
- Do not say production IAM is safe just because the generic bootstrap refuses to create new broad grants. Existing grants require readback and revocation proof.

### R949 Studio hard-off
- `lifeMovieConsentAuthorityAvailable()` returns false; render path fails closed with HTTP 503.
- `privateOutputWriteAuthorityAvailable()` returns false before private GCS MP4/SRT writes.
- Original isolated private-output guard checks reported 3/3 pass.
- These hard-offs are deliberate. Do not enable them for demos or readiness scores.

### R950 Narrator and workers
- Older legacy Narrator root `workers/narrator-worker/index.js` has an unprotected endpoint.
- Canonical Dockerfile selects compiled authenticated `src/index.ts`; checker covers `/execute-job` and `/authz` auth and Docker entrypoint.
- Actual deployed image and Cloud Run ingress remain unknown.
- Asset, Studio, Private Source and legacy Spatial production-first auth guards are in #388 review branch.
- Captured Reality dispatch, callback credentials and consent require runtime proof.
- No deployed services were certified.

## 8. Remaining P0–P3 release gates

### P0 — Private storage and end-to-end consent/revocation
1. Under real effective GCS IAM, demonstrate every privileged/stale/alternate writer receives 403 for any new write after revocation.
2. Fence/drain in-flight and resumable uploads.
3. Pin object generation/version; verify exact-generation physical deletion.
4. Obtain durable deletion/purge acknowledgement from each downstream consumer.
5. Prove positive, owner-authorized consent → Privacy authorization → Studio plan → Jobs render → protected private MP4/SRT → Spatial owner-only Replay.
6. Revoke consent and prove future writes/playback are denied and purge is acknowledged.
7. Keep render/output hard-offs until independent review passes.
8. Jobs issue [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) remains the central Storage P0.

### P1 — Execution, authentication, governance and rights
- Run original R951 test unchanged on full complete checkout at immutable SHA.
- Run all 78 root commands at the same SHA; capture command list, exit codes, TAP/logs and SHA256.
- Complete builds/typechecks and four disposable Firebase emulators.
- HTTP route tests for missing, malformed, wrong, revoked and valid tokens across production/staging/emulator settings.
- Resolve post-admission data-rights authority/revocation semantics [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376).
- Run Firestore deletion-request user-binding Rules acceptance [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380).
- Restore main protection/rulesets, required CI, independent reviewer and no-bypass policy.
- Certify rollback rehearsal in governed non-production.

### P2 — Data correctness and concurrency
- Atomic quota concurrency [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345), with native concurrent test and effective index parity.
- Verify main/review index source and installed index configuration.

### P3 — Live provider inventory/provenance
Authenticated read-only inventory of actual Firebase/GCP:
- project IDs/numbers/apps/databases;
- installed indexes and deployed Rules;
- Functions Gen1/Gen2 revisions;
- Cloud Run services, revisions, image digests, traffic, ingress and service identities;
- Storage buckets, effective IAM (including inherited bindings), object generation rules;
- Tasks, Scheduler, Pub/Sub, Eventarc, logs, quotas and billing;
- deployed source/build SHA and secret version metadata.

Unknown does not mean absent. Source config does not prove deployment.

## 9. Exact R958 next-worker execution plan

1. Re-fetch PR #387/#388/#389, #379/#304, Jobs main branch and Rulesets. Confirm no head moved.
2. Start with Actions runner diagnosis. Obtain direct GitHub failure text and admin-visible Actions runner entitlement/availability evidence. Do not rerun until the failure cause or controlled test rationale is established.
3. Have an authorized repository admin implement branch protection/ruleset policy; read it back and independently verify. This cannot be done by a documentation-only commit.
4. Obtain a complete clean Jobs checkout at exact immutable #389 SHA on an already-approved, free, credential-free CPU host with network/package access. If unavailable, record exact blocker; do not pretend remote source inspection is execution.
5. Run:
   ```sh
   node --test scripts/r951-worker-emulator-auth-precedence.test.mjs
   pnpm urai-jobs:verify
   pnpm typecheck
   pnpm build
   ```
   Record Node 22, pnpm 8.15.9, Java 21, frozen dependencies, SHA, clean tree, command exit codes and raw logs.
6. Only under the original R879 disposable scope and all its environment/credential guards, run:
   ```sh
   export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
   export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
   bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
   ```
   Do not relax project, identity, clean-tree, source pin, version or credential checks.
7. Add actual HTTP route/middleware tests; source-expression tests alone are insufficient.
8. Independently prove P0 real Storage write denial, upload drain, exact-generation purge ACK and owner-authorized private Replay.
9. Verify live cloud resource/deployment/IAM and rollback evidence.
10. Update this handoff and Genesis master with exact receipts; do not overwrite historical records or merge review work without independent approval.

## 10. Cross-repository Genesis context

This Jobs audit is a component of ONE URAI GENESIS, not the whole product. Canonical consumer identity remains UrAi; RuAi is the B2B/professional hub. The broader system includes Spatial, Privacy, Jobs, Studio, Staging, Asset Factory, Content and governance/estate repositories. Use Labs #262 as the repository/estate registry and Labs #304 as the cross-chat relay. Do not conclude overall Genesis is launch-ready because this Jobs source set passes a local test.

Core product path remains Home → Ascent → Life Map → Focus → Replay → Escape → Focus → Life Map → Home. Privacy commitments and hard boundaries remain: user memories are private; no ads; no selling memories; consent and deletion must be enforced across the actual system. The nine-state journey and accessibility/device/global-language acceptance remain separate Genesis release gates.

## 11. Final status and non-authorizations

**ONE URAI GENESIS — JOBS: PRODUCTION HOLD / NO-GO.**

R958 grants no authorization to:
- merge #387/#388/#389 or any donor to main;
- deploy or change Cloud Run/Firebase resources;
- modify production IAM, Firestore Rules, Storage Rules or secrets;
- rerun or bypass CI to manufacture a green result;
- spend paid compute or provider credits;
- create real jobs, access private media or process customer data;
- enable Studio consent authority or private-output writes;
- declare release GO.

Lift HOLD only after the applicable P0/P1/runtime/governance/deployment gates are independently verified and founder authorization is explicit.

---
*R958 is a reconciliation and handoff, not a certification. All exact PR heads, source blobs and run IDs are snapshots and must be refreshed before further mutation.*
