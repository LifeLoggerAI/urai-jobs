# ONE URAI GENESIS — Jobs R957 Branch-Protection and Actions Workflow Governance Audit

**Date:** November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Read-only GitHub API inspection of Jobs PR #389, the current `main` branch protection record, repository Rulesets collection, and relevant Actions workflow YAML. No GitHub settings, source, workflows, CI runs, cloud resources, IAM, or production systems were changed.

## 1. Critical new finding — main is not protected

The current GitHub branch API response for `LifeLoggerAI/urai-jobs` branch `main` reports:

- Branch head: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`.
- `protected: false`.
- `protection.enabled: false`.
- `required_status_checks.enforcement_level: off`.
- Required status-check contexts: empty.
- Required status-check checks: empty.

The repository Rulesets endpoint, requested with `includes_parents=true`, returned an empty array (`[]`).

**Interpretation:** the GitHub API surfaces no active branch protection for Jobs main and no repository-visible or inherited Rulesets in that response. This is direct configuration evidence, not an inference from failed CI. Main currently has no API-reported required-check enforcement or branch protection.

**Release consequence:** protected branch governance is not satisfied. Do not merge review candidates into main. Before any future promotion, an authorized repository administrator must configure and independently verify:
1. Branch protection or a ruleset applying to `main`.
2. Pull requests required; direct pushes restricted.
3. Required status checks bound to the exact current commit and relevant workflows.
4. Required independent eligible review/approval.
5. No administrator or actor bypass that defeats the approved policy.
6. Required conversation resolution and stale-review dismissal as policy requires.
7. Ruleset/branch protection readback proving enforcement is active.

This pass does not configure the settings because it is a read-only forensic audit and does not establish the appropriate administrators, reviewer identities, or final policy choices.

## 2. Current R952 review candidate remains isolated

Jobs PR [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389):
- Open, draft, unmerged.
- Base branch: `review/chalk-r951-worker-emulator-auth-boundary-20261109`.
- Head branch: `review/chalk-r952-auth-regression-release-gate-20261109`.
- Exact reviewed head: `b865209cc352241602d8b9714672f3401aed7669`.
- Jobs main still resolves to `9d29be1bcd3a45a4b9a743df9c9706c00811f38b` in the R957 branch query.
- Ten previous workflow runs remain failed; no new runs were created in R957.

The review candidate does not become production-authoritative by existing or being green in a review branch. Main remains unchanged at the observed SHA.

## 3. R957 Actions workflow-source inspection

The workflow directory at the exact #389 head contains 22 workflow YAML files. Five were directly read and inspected:

| Workflow | Blob SHA | Relevant source |
|---|---|---|
| `.github/workflows/urai-jobs-runtime-ci.yml` | `296bbf93a543724d6b834e5efdf6c6e34cc579e5` | `pull_request` and main/hardening push triggers; `runs-on: ubuntu-latest`; 20-minute job timeout; frozen install, 78-command root verification, typecheck/build/unit/smoke; separate callable emulator E2E dependent on validate |
| `.github/workflows/urai-jobs-final-ci.yml` | `ad6e4d882c18d6a6032c666cbddbfd1e69262bc4` | Pull-request and main push triggers; four independent `ubuntu-latest` jobs: workspace/launch lock, web, Functions, Firebase config |
| `.github/workflows/urai-production-verify.yml` | `e7b50462126fa0db072addec183a9005cfe36973` | Pull-request trigger; `ubuntu-latest`; exact-head checkout, frozen install, production verifier; always-captured source mutation diagnostics |
| `.github/workflows/system-audit.yml` | `987320c6bb4f18d7461b30dfa19c83a8928e7dcc` | Pull-request and main push triggers; `ubuntu-latest`; exact-head checkout, frozen install and captured system audit |
| `.github/workflows/ci.yml` | `93d21e147170dc1923ecb2ebb843d02c8962bc28` | Pull-request and main push triggers; `ubuntu-latest`; checkout, frozen install, lint/typecheck/test/build |

The inspected workflows specify GitHub-hosted `ubuntu-latest` runners, not a custom self-hosted runner label. They have ordinary concurrency groups with `cancel-in-progress: true`. Runtime CI has a 20-minute timeout; system audit 20 minutes; main CI 30 minutes. The workflow definitions do not themselves identify a self-hosted runner dependency.

### Runner failure is still not causally resolved

R956's sampled job metadata showed runner ID 0, blank runner/group names, empty steps, and approximately 2–4 seconds from start to completion across failed jobs. R957 inspected the workflow source and confirmed `runs-on: ubuntu-latest` for the relevant major workflows.

This supports the pre-step runner-allocation diagnosis. It does **not** identify why GitHub did not assign a hosted runner. Possible causes such as service incident, hosted-runner availability, account/billing/usage policy, repository plan or permissions remain unconfirmed until the full GitHub-side failure details are observed.

Do not change `runs-on`, add self-hosted runners, weaken checks, remove workflow stages, or rerun all workflows to mask the issue.

## 4. Evidence ledger

| Item | R957 result |
|---|---|
| Jobs #389 current PR metadata | Verified open/draft/unmerged and exact branch/head |
| Jobs main SHA | Verified `9d29be1...` |
| Main branch protection | **API reports disabled** |
| Main required checks | **Enforcement off; no contexts/checks** |
| Repository Rulesets (including parents) | **Empty API response** |
| Five workflow YAML files | Source inspected; Git blob SHAs recorded |
| Hosted runner selector | `ubuntu-latest` in inspected workflows |
| Prior Actions failures | Still failed; no rerun |
| Runner allocation exact cause | Unknown |
| Full 78-command suite | Not run |
| Native disposable Firebase emulators | Not run |
| Live Cloud Run/GCS IAM | Unknown / not certified |
| Production release | No-go |

## 5. R957 next actions — correct sequence

1. Resolve Actions runner allocation by inspecting full GitHub job/check-run messages and any account-level Actions availability or billing/usage notices available to an authorized administrator. Correlate the exact UTC run window with official GitHub status history if needed. Do not assume root cause.
2. Have an authorized repository administrator establish required main protection/rulesets and independent review policy. Verify branch protection and ruleset readback after configuration. Do not use bypasses.
3. Once hosted runner access is demonstrably working, choose one narrow review-only run on the immutable #389 SHA first; capture runner ID, job steps, artifacts, logs, and source SHA.
4. Then run the original R951 test, full 78-command suite, build/typecheck, and guarded disposable R879 native emulator acceptance.
5. Add actual HTTP middleware tests for missing, malformed, wrong, revoked and valid worker tokens in production/staging with the emulator flag set.
6. Preserve Studio consent and private-write hard-offs until real GCS post-revocation 403, upload drain, exact-generation deletion, downstream acknowledgement, and positive owner-authorized private Replay are independently proven.
7. Obtain read-only live Firebase/GCP inventory, effective IAM and deployed revision/image digest evidence; exercise operational rollback in a governed non-production environment.
8. Update Jobs #379 and Genesis #304 with exact rule IDs/settings readbacks, CI run IDs, source hashes, test logs and remaining blockers.

## 6. Release decision

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

Two independent governance gates remain unsatisfied:
- CI workflows have a pre-step runner-allocation failure, exact cause unknown.
- Jobs main has no API-reported branch protection, required checks or visible rulesets.

No main merge, branch-protection change, workflow rerun, deployment, IAM/Rules mutation, paid compute, real job dispatch, private-media access or customer-data operation was performed or authorized by this read-only R957 audit.

---
*Source readback: Jobs #389 head `b865209cc352241602d8b9714672f3401aed7669`; main API branch record at `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; Rulesets query with `includes_parents=true` returned `[]`.*
