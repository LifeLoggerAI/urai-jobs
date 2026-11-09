# ONE URAI GENESIS — Jobs R955 Independent Review of R952 Gate and Current CI

**Date:** November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Review-only source inspection of Jobs PR #389 and its R951/R952 parent chain. No source/runtime/Rules/IAM/deployment mutations were made in this R955 pass.

## 1. Exact reviewed source state

- Jobs PR [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389): open, draft, unmerged.
- Base: `review/chalk-r951-worker-emulator-auth-boundary-20261109`.
- Head: `review/chalk-r952-auth-regression-release-gate-20261109`.
- Exact head: `b865209cc352241602d8b9714672f3401aed7669`.
- Three changed files:
  1. `package.json`
  2. `scripts/run-r879-unified-native-acceptance.sh`
  3. `docs/security/R952_AUTH_REGRESSION_ENROLLED_VERIFICATION_HANDOFF_HOLD_20261109.md`
- Exact package blob: `bd50af6bead1c62f36ada6c012123fe0c5d94da7`.
- Exact R879 runner blob: `8a42dcad4416d5896b4886d6c5bad079463d5324`.
- Original R951 standalone test blob: `d27cc3880aa2ae0387f81bb660ca340d830e22dc`.

The candidate is a child of PR #388's review head `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`; it is not based on production `main`. Do not merge or deploy based on this audit.

## 2. What R955 independently confirmed in the diff

### Root verification enrollment

The #389 package change adds exactly one command to the existing `urai-jobs:verify` script:

```sh
node --test scripts/r951-worker-emulator-auth-precedence.test.mjs
```

It appears after `node scripts/check-secure-worker-deploy.mjs`. The recorded total is **78 unique root command segments enrolled**, not 78 commands executed and not a claim of 78 test cases passed.

### Guarded R879 enrollment

The #389 R879 script:
- Pins the updated `package.json` blob.
- Pins the original R951 standalone test blob.
- Executes `node --test scripts/r951-worker-emulator-auth-precedence.test.mjs` as a named fail-closed stage.
- Requires `# pass 4` in that stage log.
- Retains the existing explicit `--run-exact-review-only`, disposable-emulator scope, full-checkout, clean-tree, immutable-HEAD, ancestor, exact-source-pin, tool-version, credential/environment refusal, and negative Storage test requirements.

This is a correct source-level acceptance-enrollment improvement. The guarded runner has not been executed end-to-end on this reviewed head.

## 3. Independent inspection of the original R951 standalone test

The original test reads these four complete source files by relative path:
- `workers/asset-worker/index.js`
- `workers/studio-worker/index.js`
- `workers/private-source-worker/src/index.ts`
- `workers/spatial-worker/index.js`

For each file, it:
1. Locates the relevant `localBypass` or `local` declaration.
2. Requires its expression to equal the expected production-first expression exactly.
3. Requires the file to contain the expected missing-token guard text.
4. Evaluates that extracted expression over six environment values (`prod`, `production`, `staging`, `local`, `test`, `development`) and both emulator-flag states.

It defines four Node test groups. The expected behavior is: missing-token local bypass is false in production/staging regardless of `FUNCTIONS_EMULATOR`; local/test may bypass as designed; development with emulator flag can also satisfy the expression.

### Evidence-grade correction

The most precise description of the R954 “5/5 complete source files verified” result is **four worker implementation files plus the standalone regression test file**—not five distinct worker implementations. The #388 changed-file inventory lists these four worker sources and the regression test, in addition to a deployment checker and documentation.

The test is source-reading and expression-evaluation. It does not launch the workers, instantiate their Express middleware, invoke the protected routes, verify the runtime's actual `URAI_ENV`/process environment, or issue HTTP requests. The guard check uses `source.includes(...)`, so it proves the expected bearer-guard text exists in the file, not by itself that every relevant route is wired through that middleware. The separate deployment checker covers some route/source invariants (including Asset and Narrator), but the total contract still requires real HTTP integration tests.

R954 reported **4/4** groups passing in an adapted harness, and the unsafe mutation was detected. This R955 readback verified the original test's content and Git blob, not a fresh execution of that test. It is not a new test pass.

## 4. Current GitHub Actions readback at #389 head

The commit workflow-run query returned ten completed workflow runs, all with conclusion `failure`:

| Workflow | Run ID | Result |
|---|---:|---|
| URAI Jobs System Audit | 42589887660 | failure |
| URAI Production Verify | 42589887640 | failure |
| URAI Jobs Typecheck Diagnostics | 42589887621 | failure |
| URAI Jobs Runtime CI | 42589887656 | failure |
| Career Surfaces CI | 42589887624 | failure |
| CI | 42589887604 | failure |
| URAI Jobs Final CI | 42589887690 | failure |
| Defined Gitlink Guard | 42589887581 | failure |
| Firebase CLI Pin Guard | 42589887663 | failure |
| URAI Jobs Visual Proof | 42589887599 | failure |

A follow-up read of the associated job records found **13 jobs total** across these runs. The step-list endpoint returned **zero recorded steps for every job**. Runtime CI's Callable emulator E2E job was skipped. The combined commit-status endpoint returned an empty statuses array.

### What this means — and what it does not mean

- Protected CI is **not passing**. There is no successful protected-CI certificate at this head.
- Because each queried job has zero recorded steps, these failures do **not** establish that the source tests, typecheck, build, or emulator behavior failed after execution.
- They also do **not** establish a billing cause, runner outage cause, compilation failure, or application regression. The exact startup cause is not established by the evidence read in this pass.
- No job was rerun. No Actions state was changed.

The next worker should inspect the raw workflow-run and job API records, workflow event metadata, runner provisioning failure fields, and any available logs. Do not rerun CI until the cause and authorization are understood; a retry may be useful later, but it is not evidence today.

## 5. R955 evidence ledger

| Claim | Status |
|---|---|
| #389 remains open/draft/unmerged | **Verified by live GitHub metadata** |
| #389 based on R951 review branch, not main | **Verified by live GitHub metadata** |
| Three-file diff contents and paths | **Verified by live GitHub readback** |
| Package test enrollment | **Source inspected** |
| R879 test pin and required fail-closed stage | **Source inspected** |
| Original test Git blob identity | **Verified by GitHub blob SHA metadata** |
| Four worker source files are the test's inputs | **Source inspected** |
| R954 4/4 adapted-harness execution | **Prior R954 reported evidence; not rerun in R955** |
| Full original standalone test on full checkout | **NOT RUN in R955** |
| All 78 root command segments | **NOT RUN** |
| Native four-emulator R879 acceptance | **NOT RUN** |
| Worker HTTP middleware/routes | **NOT TESTED in R955** |
| Ten current workflow runs | **Verified by live GitHub readback; all failure** |
| Thirteen job records / zero recorded steps | **Verified by live GitHub readback** |
| Actual deployed image/revision, Cloud Run ingress, effective IAM | **UNKNOWN** |
| GCS post-revocation 403, upload drain, exact-generation deletion ACK | **NOT CERTIFIED** |
| Signed owner consent → private Replay → deletion/purge ACK | **NOT CERTIFIED** |

## 6. Next execution sequence

1. Retrieve full run/job JSON for all ten run IDs and inspect the `status`, `conclusion`, `completed_at`, `started_at`, `runner_name`, `check_run_url`, `html_url`, `labels`, and any failure annotations. Establish whether failure occurred before runner allocation, during setup, or in a step. Do not attribute cause without those fields.
2. Obtain an approved full repository checkout at the exact #389 SHA. Record Node 22, pnpm 8.15.9, Java 21, dependency lock, clean worktree and exact HEAD.
3. Run the original standalone test unchanged; retain complete TAP and SHA-256.
4. Run the 78-command root verification exactly as enrolled; no substitutions or skipped commands.
5. Run builds/typechecks and the guarded R879 runner only under its original disposable-only environment and credentials refusal checks.
6. Add actual HTTP middleware tests for missing, malformed, wrong, revoked and valid tokens, including production/staging with the emulator flag set. Cover route wiring, not just expression text.
7. Preserve private-render/output hard-offs until independent Storage IAM revocation, upload-drain, exact-generation deletion, downstream acknowledgement, and positive owner-authorized private Replay are proven.
8. Obtain independently authorized read-only provider inventory, actual deployed source/image digests and effective IAM. Rehearse rollback in a governed non-production environment.
9. Update Jobs PR #379 and Genesis PR #304 with exact receipts and any newly proven facts.

## 7. Release decision

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

No source merge, production deployment, IAM/Rules change, paid compute, CI bypass, real job dispatch, customer-data access or private-media access is authorized by R955. The test-enrollment correction is real and useful, but the full suite and runtime acceptance remain outstanding.

---
*This report records direct GitHub readback and source inspection performed in R955. It preserves the R954 reported test receipt as historical evidence, without claiming to have rerun it.*
