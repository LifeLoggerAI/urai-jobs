# ONE URAI GENESIS — R954 main-versus-review worker authentication divergence

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**  
**Scope:** read-only GitHub source comparison of Jobs `main` and review-only Jobs R951/R952. No source edits, merges, deployments, credentials, live HTTP calls, Firebase/GCP access or media processing.

## 1. Finding

The production-default Jobs `main` branch still contains the pre-R951 worker authentication predicates in all four inspected worker files. The corrected production-first predicates exist in the unmerged review chain [Jobs #388](https://github.com/LifeLoggerAI/urai-jobs/pull/388) (R951), and their regression is enrolled in [Jobs #389](https://github.com/LifeLoggerAI/urai-jobs/pull/389) (R952).

This is a confirmed **source integration gap**. It is not evidence that any particular Cloud Run service is deployed from `main`, has the affected environment flags, or is exploitable over a live endpoint. Deployed source, environment values, secrets, ingress and service IAM remain UNKNOWN.

## 2. Exact immutable source comparison

Repository: `LifeLoggerAI/urai-jobs`

- Current `main`: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- R951 corrected review head: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- R952 enrollment review head: `b865209cc352241602d8b9714672f3401aed7669`
- R952 original standalone regression test blob: `d27cc3880aa2ae0387f81bb660ca340d830e22dc`

| Worker source | `main` blob (pre-fix) | R951 review blob (corrected) |
|---|---|---|
| `workers/asset-worker/index.js` | `c2c720701a5de07cb747e03159335eca48604fc0` | `b22962bdeea24d369caa6aa13d06eecb9b40f478` |
| `workers/studio-worker/index.js` | `ae09a89d80a024301ba9df41db4265216bd6eb6b` | `d63056168b53ef29f55285724eff6fe2a6b60cb5` |
| `workers/private-source-worker/src/index.ts` | `ec3f28af4bc0c42c46bc2da3350ecc999ec449ef` | `1fa8b8ef593b5dbecdd8f8d1e59afb4e8808ade3` |
| `workers/spatial-worker/index.js` | `1265e08e45be23d24986e90dc367888ff40346ae` | `47fea308eb126e4a2e5f8eebb23a74de45417d17` |

The GitHub file readbacks independently returned all eight blob identities above. These are source pins, not deployment fingerprints.

## 3. Behavioral difference

The old source permits a missing worker token to bypass authentication whenever the worker considers itself local/test **or** `FUNCTIONS_EMULATOR=true`. In Asset, the file already computes `productionRuntime` but the old bypass predicate does not use it. Private Source already has a `productionRuntime()` helper, but the old bypass predicate does not call it. Studio and legacy Spatial derive the environment inline.

The R951 corrected form first excludes `prod`, `production` and `staging`, then permits the local/test/emulator bypass only outside those environments:

```js
const localBypass = !productionRuntime && (
  runtimeEnv === 'local' ||
  runtimeEnv === 'test' ||
  process.env.FUNCTIONS_EMULATOR === 'true'
);
```

The exact variable/helper form differs by worker; use the original reviewed expressions, not a copy/paste replacement across languages. The original R951 test asserts each source expression and bearer guard call over six environments and both emulator-flag states.

## 4. Regression evidence — scope kept precise

The R953 source-pinned handoff records execution of the exact original R951 test file (Git blob above) against short, source-matched worker guard excerpts, not complete original worker modules:

- Node v22.16.0; original Node test: 4/4 PASS, zero failures, exit 0.
- The four cases each exercise 6 environments × 2 emulator-flag settings (48 condition evaluations).
- Local mutation removing the production exclusion from the Asset excerpt: 3 PASS / 1 expected FAIL, exit 1.
- Restoring the protected expression: 4/4 PASS.

The same-task local truth-table cross-check in this continuation also executed 48/48 logic cases. Its test is a hand-authored matrix of expressions read from the immutable source readbacks, **not** the original checked-in Node test and not a source-file parser. It is supplemental only.

None of these runs tested full worker modules, HTTP ingress, Docker images, Firebase, Cloud Run, GCS IAM or a deployed service. Do not transfer these passes to production acceptance.

## 5. R952 release-enrollment state

R952 #389 pins the original R951 test in the mandatory root verification and guarded R879 runner. GitHub PR metadata reports 78 unique root command segments enrolled and 58/58 R879 source pins matching its immutable tree. These commands and pins have not thereby been executed as one suite.

At #389 head `b865209cc352241602d8b9714672f3401aed7669`, the GitHub check-runs readback returned 14 checks: 13 failures and one skipped callable-emulator job. The workflows completed within roughly three to four seconds. A sampled job exposed zero recorded steps; its log retrieval returned 404 BlobNotFound. Cause remains UNKNOWN; do not label it a source build/test failure without runner/provider evidence.

## 6. Required next steps

1. Keep `main` and all existing review branches untouched while an independent integrator evaluates the R951/#388 corrected worker source and R952/#389 test enrollment as one reviewable source chain.
2. On a full clean checkout of one immutable review SHA, verify original full worker file hashes, run the exact original R951 test without excerpt substitution, mutation-test the actual original worker source in an isolated copy, and run the secure-worker deployment source checker.
3. Restore an eligible protected CI path and obtain actionable logs; do not bypass required checks or promote a draft because the local test passed.
4. Separately verify actual deployed source digest, environment and token bindings, Cloud Run ingress and IAM through authorized read-only provider access, followed by an independently approved HTTP 503/401 acceptance. No endpoint probing against production is authorized here.
5. Keep Jobs P0 #252 (effective privileged GCS write denial after revocation, upload drain and physical purge ACK), positive signed C6 cross-service private Replay/deletion, native Firebase authorization, full 78-command suite, protected CI and independent release approval as separate release gates.

## 7. Final classification

**Confirmed:** four pre-fix worker authentication blobs remain on Jobs `main`; four corrected worker blobs exist in R951 review; the original regression test is enrolled by R952 review.

**Not established:** what is deployed, whether any affected environment is live, whether a bearerless production request can reach an affected deployed worker, or whether GCS and cross-service privacy gates are satisfied.

**NO MERGE / NO DEPLOY / NO PRODUCTION GO. ONE URAI GENESIS — PRODUCTION HOLD.**
