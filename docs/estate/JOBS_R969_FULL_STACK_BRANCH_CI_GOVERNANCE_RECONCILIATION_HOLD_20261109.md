# ONE URAI GENESIS — R969 full-stack source topology, governance and CI evidence reconciliation

**Date:** 2026-11-09 UTC  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository of record:** `LifeLoggerAI/urai-jobs`  
**Documentation branch:** `docs/genesis-jobs-firebase-forensics-20261109`  
**Forensic PR:** Jobs #379 (open, draft, unmerged at R969 metadata refresh).  
**Purpose:** Continue R968's cross-lineage reconciliation with live branch ancestry comparisons, main-vs-review drift, GitHub branch-protection/ruleset visibility, Actions execution evidence, and a consolidated release gate disposition.

This is source/metadata/CI-evidence reconciliation. No application source, workflow, IAM, deployed service or private data was changed. No test, build, emulator, provider API or dispatch operation was executed.

---

## 0. Executive result

R969 added four material findings:

1. **Jobs #371 is an intentionally stacked review, not a direct-to-main PR.** Its declared base branch is `review/chalk-r891-jobs-quota-owner-runtime-convergence-20261107` at `ebdf5f62338822f99b7293bdd5b9a0cda4917dd9`. The R923 head `df19633466eaebdda844569ed0d562245bd31dc6` is exactly 60 commits ahead and 0 behind that base; the scoped comparison shows 13 changed files. Its full comparison against current main is 629 commits ahead / 2 behind and spans 236 files, so reviewing or merging it directly as a standalone current-main change would ignore the intended stack.
2. **The key branches are not reporting protected status.** GitHub branch metadata reported `protected:false` for Jobs `main`, Jobs' R891 review base, Privacy `main`, and Privacy's R836 base branch. Repository-level rulesets endpoints returned empty arrays for Jobs and Privacy. Direct branch-protection detail endpoints returned HTTP 403 to this integration, and organization ruleset enumeration was not accessible. Therefore effective governance is NOT CERTIFIED; treat protected CI and no-bypass approval as open release gates.
3. **Recent Actions runs are not executable test receipts.** Sampled Jobs R923-associated runs and Privacy R836-associated runs have `completed/failure` conclusions, but their job-step APIs returned empty step lists. Job-log retrieval returned a BlobNotFound error in the attempted fetch. The run conclusions alone do not prove application assertions ran or failed.
4. **R836 is content-stable on its only compared base-path difference, but its ancestry is diverged.** Comparing Privacy R836 #232 against its declared #230 base reported 1 commit ahead / 1 behind and one changed file `next-env.d.ts`; reading the file at both exact refs produced the same blob SHA `ce4e94a6b10f160ee021fe18939af160d2927dcf`. This suggests an ancestry-only/reverted-path difference at the final file-content boundary, not a current content mismatch in that file. Do not silently rewrite its history; keep the source/runner's exact SHA pins.

The R647 donor tests, Jobs #371 three-case emulator harness and Privacy R836 native runner remain NOT RUN in this environment. GitHub DNS remains unavailable from the container.

---

## 1. Refreshed review graph

### Jobs

| PR / branch | SHA | Base / status |
|---|---|---|
| Jobs main | `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` | Branch metadata `protected:false` |
| Jobs #379 forensic docs | `bcb7c187a8c5f5d228721779d5479d6cebb224c6` before R969 docs | Open, draft, unmerged |
| Jobs #371 R923 | `df19633466eaebdda844569ed0d562245bd31dc6` | Base: R891 review branch below |
| Jobs R891 review base | `ebdf5f62338822f99b7293bdd5b9a0cda4917dd9` | Branch metadata `protected:false` |
| Jobs #377 R900 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | Open, draft; base R898 review line |
| Jobs #388 R951 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Open, draft |
| Jobs #389 R952 | `b865209cc352241602d8b9714672f3401aed7669` | Open, draft |
| Jobs #390 R932 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open, draft |
| Jobs #384 R946 | `fd05a376f876f9b835929a2074c09f47638659e2` | Open, draft |
| Jobs #386 R949 | `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` | Open, draft |
| Jobs #387 R950 | `04592f8573c708954f95f87ddca1e168efde51f4` | Open, draft |

### Privacy

| PR / branch | SHA | Base / status |
|---|---|---|
| Privacy main | `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | Branch metadata `protected:false` |
| Privacy #192 R506 | `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc` | Open, draft |
| Privacy #213 R583 | `4a4656d6283aa7e627bf220b447436df82865f99` | Open, draft |
| Privacy #214 R647 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | Open, draft |
| Privacy #229 R834 | `79e71fd6137947d2ed7c416a2596090572fef978` | Open, draft |
| Privacy #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | R836 declared base; branch metadata `protected:false` |
| Privacy #231 R835 | `42aad96404c4f0de01a448031df80f7b5c06f7c0` | Open, draft |
| Privacy #232 R836 | `e1e2dee63c39590d343d727aa53618ac97a52691` | Open, draft; two-parent merge commit |
| Privacy #253 R17 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | Open, draft |
| Privacy #254 R18 | `dbc193763dc112210c20b5b51189573a954873593` | Open, draft |
| Privacy #255 R19 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | Open, draft |
| Privacy #256 R20 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | Open, draft |

All listed review PRs remained open/draft/unmerged on the R969 read. Re-fetch metadata before future work; these refs are source/review identities, not deployed versions.

---

## 2. Jobs #371 branch topology

### 2.1 Declared review stack

PR #371 declares base branch:
`review/chalk-r891-jobs-quota-owner-runtime-convergence-20261107`

Live branch head:
`ebdf5f62338822f99b7293bdd5b9a0cda4917dd9`

R923 head:
`df19633466eaebdda844569ed0d562245bd31dc6`

GitHub compare of that declared base to the R923 head:
- status: `ahead`;
- ahead: 60;
- behind: 0;
- 13 changed files;
- files include R884/R885/R887/R888/R889/R891/R923 security handoffs, exact R885 test TAP, `functions/src/privacy/dataRightsExecution.ts`, root package.json, R881 parser test, R888 deletion contract test and R879 runner.

This is the intended stacked review boundary. The next Chalk must preserve the predecessor chain and not treat the 60 commits as changes authored only by R923.

### 2.2 Comparison to current Jobs main

Current Jobs main tip:
`2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`

R923 head compared to current main:
- status: diverged;
- 629 commits ahead;
- 2 commits behind;
- 236 net changed paths in the comparison;
- 52 modified / 184 added;
- 12,742 additions / 1,182 deletions in the returned diff summary.

The two main-only commits from the old merge base were:
1. `792d063b9d894bb9cb872e2c3c6dd71e37804f6a` — “R933: repair over-escaped source matcher regexes in producer-consumer regression”; added `scripts/studio-life-movie-actual-producer-zod-contract.test.mjs`.
2. `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` — “Revert accidental default-branch R933 test-file update; keep review changes isolated”; removed that same test file.

The compare from R923 head to current main reports 2 commits on main's side and no net files from those main-only commits. This is consistent with the add-then-revert pair, but ancestry remains diverged and the R923 tree still contains a large accumulated stack relative to main.

**Disposition:** R923 should be reviewed/advanced against its declared R891 stack, and the whole stack should later be reconciled to main in a controlled source-preserving sequence. Do not retarget #371 directly to main or merge it solely because its declared base compare is clean.

### 2.3 Jobs #371 current-base branch protection

GitHub branch endpoint reports:
- Jobs `main`: `protected:false`;
- Jobs R891 declared review base: `protected:false`.

Repo-level `/rulesets` API returned `[]`. The direct branch protection detail endpoint returned 403 “Resource not accessible by integration”. Organization-level ruleset endpoint was not accessible through the allowed GitHub API fetch path.

This does not authorize bypassing anything. Effective ruleset/policy state remains UNKNOWN beyond the above returned data and must be independently verified by an authorized administrator.

---

## 3. Privacy R836 branch topology

Privacy #232 R836:
`e1e2dee63c39590d343d727aa53618ac97a52691`

Declared base branch / #230:
`846d2ffa469af5634374bd77fbdc2d41bca8e964`

Compare result:
- status: diverged;
- ahead by 1 / behind by 1;
- one reported file path: `next-env.d.ts`.

Exact file readback at both refs:
- #230 blob: `ce4e94a6b10f160ee021fe18939af160d2927dcf`;
- #232 blob: `ce4e94a6b10f160ee021fe18939af160d2927dcf`;
- bytes identical.

R836 commit message describes a two-parent convergence: keep #230's Privacy full-build tree as first parent, import #231's strict native acceptance runner, original callable transport test and source-pin test as second parent. The R836 change list contains these three test/runner additions.

**Disposition:** R836's declared base has commit ancestry drift, but the compared `next-env.d.ts` content is identical. Preserve its two-parent lineage and exact Jobs #320 pin. Do not rebase/reset merely to clear a metadata comparison. The PR body previously stated the full R836 four-emulator runner was not executed because a Functions worker Unix socket operation returned EPERM and hosted CI had no executed-step certificate.

Privacy #230 base branch metadata reports `protected:false`; Privacy `main` also reports `protected:false`. Repository-level rulesets endpoint returned an empty array. Direct branch protection endpoint returned 403 to this integration.

---

## 4. GitHub Actions evidence audit

### 4.1 Jobs R923-associated sampled runs

Workflow-run query for Jobs R923 commit returned the first page of these runs, all `completed` with `conclusion=failure`:
- URAI Jobs Runtime CI, run #1992, ID `42562565924`;
- URAI Jobs System Audit, run #1732, ID `42562565556`;
- Firebase CLI Pin Guard, run #1277, ID `42562565589`;
- URAI Jobs Visual Proof, run #1158, ID `42562565770`;
- URAI Jobs Typecheck Diagnostics, run #1431, ID `42562565528`;
- CI, run #2026, ID `42562565570`;
- URAI Production Verify, run #1529, ID `42562565621`;
- Career Surfaces CI, run #1072, ID `42562565683`;
- URAI Jobs Final CI, run #2006, ID `42562565702`;
- Defined Gitlink Guard, run #1281, ID `42562565590`.

Focused job readback:
- Runtime CI job “Validate runtime” ID `128981975229`: completed/failure; step summary endpoint returned an empty array.
- Runtime CI job “Callable emulator E2E”: skipped.
- System Audit job ID `128981974507`: completed/failure; step summary endpoint returned an empty array.

### 4.2 Privacy R836-associated sampled runs

Workflow-run query for Privacy R836 returned five first-page runs, all `completed/failure`:
- URAI Privacy Release Verification #794, ID `42333455401`;
- URAI Production Verify #758, ID `42333455466`;
- Consent Export and Deletion Branch Validation #557, ID `42333455418`;
- Privacy package validation #1132, ID `42333455397`;
- Release Verification #957, ID `42333455392`.

Focused job readback:
- Release verification job ID `128284947159`: completed/failure; step summary endpoint empty.
- Build, test and QA job ID `128284946772`: completed/failure; step summary endpoint empty.

Attempts to retrieve a job log produced a GitHub artifact/blob retrieval error (`BlobNotFound`) during the combined fetch. No raw step transcript was recovered.

### 4.3 Correct CI interpretation

These run conclusions are real GitHub metadata, but without recorded step summaries or retrievable logs they do **not** establish which application commands executed, whether a workflow failed before checkout, whether tests failed, or whether setup/runner startup failed.

Do not claim “all app tests failed”. Do not claim CI passed. Classify sampled runs as **completed failure; no job steps/logs available through current connector retrieval**. The required protected, runnable CI and independent approval gate stays OPEN.

---

## 5. Governance and branch protection reconciliation

Observed:
- Jobs main branch endpoint: `protected:false`.
- Jobs R891 review base endpoint: `protected:false`.
- Privacy main branch endpoint: `protected:false`.
- Privacy #230/R836 declared base endpoint: `protected:false`.
- Jobs repository-level rulesets endpoint: empty array.
- Privacy repository-level rulesets endpoint: empty array.
- Jobs branch-protection detail endpoint: 403 from the integration.
- Privacy branch-protection detail endpoint: 403 from the integration.
- Organization-level ruleset endpoint could not be fetched via the allowed API route.

Interpretation:
- The available repository branch metadata does not report classic protection.
- No repository-level rulesets were returned by the endpoint.
- Actual effective protection, inherited organization policy, admin bypass, required reviewer identity and required check names are NOT CERTIFIED because full policy APIs are not accessible.
- The founder/authorized GitHub administrator must inspect the effective settings directly. No branch bypass, merge or deploy is authorized.

---

## 6. Core technical reconciliation remains as R968

Do not reopen or erase the established R968 distinctions:

### Three separate acceptance lineages
A. R647 Privacy dispatcher donor — prepared, NOT DEPLOYED; exports `dispatchPendingJobsRevocations`; exact donor blobs and four R960 incompatibilities with R20 are recorded in R968.

B. Jobs #371 three-case Storage revocation emulator harness — expects a different `consent-jobs-*` Privacy source interface; exact compatible original source not recovered in inspected trees/history.

C. Privacy R818/R836 native callable acceptance — Jobs compiled identity/transport to Privacy actual consent callable in demo emulators, denial and review-only issuer path. It is not the outbox dispatcher or Jobs #371 deletion harness.

### Jobs derivative cleanup
Generation-pinned deletion, owner/tenant/project scope validation, refusal to delete unknown objects, persistent unresolved in-flight marker. It still explicitly cannot certify future write fence or full historical erasure.

### Privacy R20 and proposed v3
R20 immutable outbox and prior grant evidence exist. R963 v3 event/ACK remains proposal-only. R964/R965 require Privacy receiver-side event/Jobs receipt/action binding or approved attestation model, stable consumer identity and crash-safe idempotent ACK recovery. No v3 protocol is approved or implemented.

### Privacy issue #83
Still OPEN. The canonical consent source implementation exists, but protected deployed runtime, registered consumer acknowledgments and provider-call prevention remain unverified.

### Other release blockers
Jobs operator post-admission withdrawal policy; worker auth and deployment provenance; actual rollback rehearsal; Studio private-output hard-off; R879 complete native run; CI/branch governance; live Storage IAM denial, upload draining and purge ACK; authenticated C6 lifecycle; device/accessibility/visual acceptance; external launch operations; independent review and founder GO.

---

## 7. R969 execution and environment

R969 actually executed:
- refreshed Jobs and Privacy PR metadata;
- compared Jobs #371 with current main and its declared R891 review base;
- compared Privacy #232 with its declared #230 base and main;
- fetched commit metadata for main-only Jobs R933/revert commits;
- read `next-env.d.ts` at both R836 refs and confirmed identical blob;
- queried workflow run metadata, job summaries and step summaries;
- queried branch protection metadata and repository rulesets;
- retried `git ls-remote` in container.

Direct Git command:
```bash
git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104
```
Actual result: exit 128, `Could not resolve host: github.com`.

R969 did NOT:
- clone/checkout a complete repository;
- install dependencies;
- run any donor Node test;
- execute Jobs three-case emulator harness;
- execute R836 native runner;
- run typecheck/build;
- start emulator services;
- invoke an HTTP endpoint/dispatcher;
- access live GCP resources or effective IAM;
- mutate source/runtime/branch settings.

No new application-test PASS is claimed.

---

## 8. R970 exact next execution plan

### A. Resolve branch-stack/governance before merging
1. Preserve Jobs #371 declared R891 base. Reconcile the 60-commit R923 stack with its predecessor PR chain, not a direct main merge.
2. Inspect the 629-ahead/2-behind main comparison using full history. The two main-only commits are add/revert of an R933 test file; verify tree identities before concluding no content difference.
3. Preserve Privacy #232 two-parent R836 ancestry. The only compared `next-env.d.ts` path has identical final blob; verify other tree/parent identity and the full R836 runner pin.
4. Authorized admin independently inspects Jobs/Privacy main and review-branch effective protection, org rulesets, required checks, reviewer rules and bypass policy. Do not merge until evidenced.

### B. Restore actual CI execution evidence
5. Retrieve job step transcripts from GitHub Actions with authorized API/log access or reproduce in a clean protected runner. Capture setup/checkout/install/build/test stages and exact exit codes.
6. Do not re-run failed workflows blindly until it is clear whether they failed before executing steps. Keep “no step logs” distinct from application test failures.
7. Require the complete Jobs and Privacy acceptance runners on exact source SHAs; independent reviewer must not be the author.

### C. Complete source and integration acceptance
8. Recover the Jobs #371 harness's original Privacy `consent-jobs-*` modules from a grounded source archive/workspace; otherwise draft a clearly labelled review-only harness rewrite.
9. Compare R647 dispatcher, Jobs #371 harness and R818/R836 callable runner as three separate paths. Choose one protocol for outbox delivery; do not activate multiple dispatchers.
10. Approve the canonical v3 event/ACK design with Privacy/legal/security; then prepare separate review-only Privacy/Jobs code, build and same-SHA Firebase emulator acceptance.
11. Run the R647 donor 10 + 16 Node suites separately; run the Jobs three-case emulator only with compatible source; run R836 native runner independently with exact clean Privacy/Jobs SHA pins, Node22, pnpm8.15.9 and Java.

### D. Prove provider/deployment gates
12. Authorized read-only inventory of deployed Functions, Cloud Run, Scheduler, Tasks, Pub/Sub, Eventarc, source/image digests, workload identities, endpoint secrets/audiences, ingress and effective IAM.
13. Separate approved nonproduction GCS tests: stale/alternate privileged writer 403 after revocation, active upload/stream drain, generation-specific deletion and durable final absence/purge ACK.
14. Complete worker auth, operator withdrawal policy, rollback to prior healthy revision, C6 lifecycle, devices/accessibility/visual, external operations and founder GO gates.

---

## 9. Final R969 disposition

**Reconciled:** current PR graph; Jobs #371 stack target and ancestry; main-vs-PR drift; main-only R933 add/revert pair; R836 base/head path content equality and ancestry divergence; branch protection visibility; sampled Actions execution/log boundary; all three integration lineages and R968 technical blockers.

**Not certified:** effective branch protection/inherited rulesets; executable Actions steps; complete clean checkout/test execution; deployed source/image/runtime; real service identities and effective IAM; future GCS write denial and physical purge.

**Not executed:** R647 donor suites, Jobs #371 emulator harness, R836 exact-head native runner, builds/typechecks, live provider inventory and GCS test.

**No code change. No merge. No deploy. No dispatch. No private media. No IAM change. No paid compute.**

# ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.
