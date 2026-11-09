# ONE URAI GENESIS — Jobs R956 Actions Runner-Allocation Forensics and Next-Chalk Handoff

**Date:** November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Read-only investigation of the ten GitHub Actions workflow failures associated with Jobs PR #389 exact HEAD `b865209cc352241602d8b9714672f3401aed7669`. No workflow reruns, source/runtime/Rules/IAM/deployment mutations, credentials, customer data, or production resources were used.

## 1. Executive finding

R955 established that all sampled Actions jobs reported failure with zero steps. R956 retrieved the raw GitHub Actions run and job metadata for representative runs and confirmed a consistent runner-allocation signature:

- Workflows were triggered by `pull_request` for PR #389 at the exact same reviewed HEAD.
- Most jobs were recorded as started and completed within approximately **2–4 seconds**.
- The executed job records show `runner_id: 0`, blank `runner_name`, blank `runner_group_name`, zero steps, and the requested label `ubuntu-latest`.
- This pattern occurs across System Audit, Production Verify, Typecheck Diagnostics, Runtime CI, main CI build, Final CI build/typecheck/Firebase smoke, Defined Gitlink Guard, Firebase CLI Pin Guard, Visual Proof and Career Surfaces CI.
- Runtime CI's Callable emulator E2E job was skipped.
- The combined commit-status endpoint returned no status records.

**Evidence-based diagnosis:** the failed jobs did not reach an assigned GitHub-hosted runner and did not execute their workflow steps. This is a runner-allocation / pre-step startup failure signature, not an application test failure.

**Cause remains UNKNOWN:** the available read-only run/job record does not identify why GitHub failed to provision/assign the runner. Do not label it as a GitHub service outage, account billing issue, concurrency limit, repository permission problem, or workflow YAML defect until additional evidence identifies the cause.

## 2. Exact source and run identity

PR [Jobs #389](https://github.com/LifeLoggerAI/urai-jobs/pull/389):
- State: open, draft, unmerged.
- Base branch: `review/chalk-r951-worker-emulator-auth-boundary-20261109`.
- Head branch: `review/chalk-r952-auth-regression-release-gate-20261109`.
- Exact HEAD: `b865209cc352241602d8b9714672f3401aed7669`.
- All runs sampled below were `pull_request` events against this SHA and PR #389.

## 3. Ten failed workflow runs — raw metadata

| Workflow | Run ID | Job name(s) | Job ID(s) | Conclusion |
|---|---:|---|---|---|
| URAI Jobs System Audit | 42589887660 | System audit | 129068673722 | failure |
| URAI Production Verify | 42589887640 | Verify Jobs production candidate | 129068673204 | failure |
| URAI Jobs Typecheck Diagnostics | 42589887621 | Capture checkout, typecheck, and contract output | 129068673178 | failure |
| URAI Jobs Runtime CI | 42589887656 | Validate runtime; Callable emulator E2E | 129068673620; 129068696948 | failure; skipped |
| Career Surfaces CI | 42589887624 | Verify career surfaces | 129068673513 | failure |
| CI | 42589887604 | build | 129068673663 | failure |
| URAI Jobs Final CI | 42589887690 | Web typecheck and build; Functions build and tests; Verify workspace and launch lock; Firebase config smoke | 129068676479; 129068676706; 129068676717; 129068676725 | all failure |
| Defined Gitlink Guard | 42589887581 | Verify defined gitlinks | 129068673756 | failure |
| Firebase CLI Pin Guard | 42589887663 | Verify immutable Firebase CLI authority | 129068673676 | failure |
| URAI Jobs Visual Proof | 42589887599 | visual-proof | 129068674006 | failure |

### Raw metadata signature

For the 12 executed job records (excluding the skipped Callable emulator E2E job):
- `runner_id = 0`
- `runner_name = ""`
- `runner_group_name = ""`
- `labels = ["ubuntu-latest"]`
- `steps = []`
- started/completed timestamps differ by roughly 2–4 seconds.

The skipped Callable emulator E2E job has no runner allocation and zero steps, as expected for a skipped job.

Representative direct links:
- [Runtime CI run #42589887656](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887656)
- [Final CI run #42589887690](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887690)
- [System audit run #42589887660](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887660)
- [Build run #42589887604](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887604)
- [Production Verify run #42589887640](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887640)

## 4. Implications for the earlier CI interpretation

Correct interpretation:
- Protected CI is not passing.
- No workflow command ran in the sampled jobs.
- Typecheck, build, runtime, test and Firebase smoke outcomes are **unknown**, not failed by compiler/test assertion.
- The source candidate cannot be considered CI-certified.
- Rerunning all workflows blindly would not add useful evidence until the runner-allocation cause is understood.

The prior R955 statement “ten workflows failed” remains true. R956 adds that these were pre-step failures with no runner allocated in the returned job metadata.

## 5. R956 follow-up actions to diagnose the allocation failure

Next Chalk should retrieve and preserve the exact workflow-run and job JSON through the GitHub UI or an authorized API surface with full access. The relevant fields include:
- run `run_attempt`, `event`, `workflow_id`, `check_suite_id`, `head_sha`, `head_branch`, `created_at`, `run_started_at`, `updated_at`;
- job `runner_id`, `runner_name`, `runner_group_name`, `labels`, `started_at`, `completed_at`, `steps`, `check_run_url`;
- check-run `output`, `details_url`, and annotations if accessible;
- repository Actions settings, hosted-runner availability/usage and any concurrency or policy message shown in the GitHub UI;
- any GitHub Status incident that matches the exact UTC window (only as corroboration, not as cause without matching evidence).

Do not rerun a workflow until the cause has been identified or an authorized controlled retry is selected. If retrying later, retry a single low-risk review-only workflow first; capture the new run's assigned runner ID and steps. Do not modify workflow logic to hide or skip failing checks.

## 6. R952/R955 acceptance findings remain unchanged

#389 still contains only:
1. `package.json` — required R951 test enrollment in root verification.
2. `scripts/run-r879-unified-native-acceptance.sh` — exact original test blob pin and mandatory `# pass 4` stage.
3. R952 handoff documentation.

Exact source blobs:
- package: `bd50af6bead1c62f36ada6c012123fe0c5d94da7`
- guarded runner: `8a42dcad4416d5896b4886d6c5bad079463d5324`
- original R951 test: `d27cc3880aa2ae0387f81bb660ca340d830e22dc`

The original R951 test is a source-reading test of four worker files and their local auth-bypass expressions. It is not a live HTTP middleware test. The reported 78 root commands are enrolled, not run. The R879 guarded runner remains unexecuted on a complete checkout. R954's adapted 4/4 and mutation detection remain historical reported evidence; R956 did not rerun them.

## 7. Remaining release blockers

The Actions startup problem is only one blocker. These remain independent and unchanged:

- Full original 78-command Jobs verification, build/typecheck and four disposable Firebase emulator acceptance.
- Actual worker HTTP authorization tests for missing, malformed, wrong, revoked and valid tokens.
- P0 real GCS post-revocation 403 for every privileged/alternate writer, in-flight upload drain, exact-generation delete and durable downstream ACK.
- Positive authenticated owner consent → Privacy → Studio → Jobs → protected private output → Spatial Replay → revocation/deletion/purge acknowledgement.
- Effective live Firebase/GCP resource inventory, service identities, IAM, Cloud Run revisions/image digests and deployed source parity.
- Protected CI and independent approval.
- Proven rollback rehearsal.
- Post-admission data-rights execution/revocation policy, Firestore user binding, quota concurrency and index parity.
- Founder release authorization.

Studio consent and private Storage output authority hard-offs remain in place; do not enable them to force readiness.

## 8. Release decision

**ONE URAI GENESIS — JOBS: PRODUCTION HOLD / NO-GO.**

No merge, deployment, workflow bypass, IAM/Rules mutation, paid compute, real job dispatch, private-media access or customer-data operation was performed or authorized by this R956 read-only audit.

---
*R956 direct GitHub metadata reads are limited to the listed run/job records. The specific GitHub-side reason the runner was not assigned remains unresolved.*
