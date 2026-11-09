# R885 — Exact-source R884 native runner isolation test: executed 10/10 PASS

**Date:** 2026-11-07. **Source base:** [Jobs draft #360](https://github.com/LifeLoggerAI/urai-jobs/pull/360), exact pre-attestation head `3e03e57a8533ced68ce19ff6ce5212c81c4d0164`. This is an **additive evidence-only** change to the existing R884 branch; no runtime source, test code, IAM, production data or deployment modifications.

## Original GitHub objects independently reconstructed and executed

| Exact file | Verified Git blob SHA-1 | Original UTF-8 byte count |
| --- | --- | ---: |
| `scripts/run-r879-jobs-native-auth-acceptance.sh` | `67ae8515bd206456c8d181ff52ef173e67f65cc2` | 5,595 |
| `scripts/r884-emulator-env-isolation.test.mjs` | `edbb4fc44f026d1d972021020ca4198d0561c79b` | 3,012 |

Retrieved both originals from connected GitHub at immutable R884 head; wrote their exact bytes into the isolated `/mnt/data/jobs_r884_exact/scripts/` local test tree and independently ran `git hash-object`. Both identities matched the source objects. Environment: Linux; Node **v22.16.0**, GNU Bash **5.2.37**, Git 2.47.3. No GCP credentials, GitHub clone, service principal, Functions process, Firebase emulators, provider calls or real media were needed or invoked.

Executed **unchanged original committed test**:

```bash
bash -n scripts/run-r879-jobs-native-auth-acceptance.sh
node --check scripts/r884-emulator-env-isolation.test.mjs
node --test scripts/r884-emulator-env-isolation.test.mjs
```

All three commands exit **0**. The original Node test subprocesses extracted the actual runner's Bash preflight function and invoked it with disposable local directories. **10/10 PASS**: clean directory accepted; documentation-only `.env.example` accepted; `.env`, `.env.local`, `.env.demo-urai-jobs`, `.env.other-project`, `.secret.local`, `.runtimeconfig.json`, and symlinked `.env.local` denied; pre/post-build guard checks present. The run was repeated to capture complete raw TAP and its digest, **exit 0, SHA-256 `ece548de8d50b7545849366d488ca4462e73e28da4a8a6679ede429824376e2b`**. Duration varies; do not require byte-for-byte identical TAP on a rerun.

**Raw 1,592-byte TAP:** [`docs/security/attestations/R885_R884_exact_node_test.tap`](attestations/R885_R884_exact_node_test.tap). Independently fetched after upload and verified Git blob `ced32835de78ff071d4aee5acb68ae02f1e5eaae`, 10 PASS entries and no failures. Preserve it with its precise R884 source pin, not a later moving branch.

## What R885 does NOT prove

This is an actual local test of the **source-level environment-file guard**. It does **not** execute the entire native R879 runner, clean frozen workspace `pnpm install` or full `pnpm urai-jobs:verify/typecheck/build`; neither Firebase Auth/Firestore/Functions/Storage emulators nor production-equivalent GCS IAM were run. `pnpm` and complete repository checkout were unavailable, and `git ls-remote https://github.com/LifeLoggerAI/urai-jobs.git HEAD` failed DNS resolution in the container. The runner still has security boundaries beyond file names (ambient credentials, Firebase Secret Manager and provider calls) that cannot be certified by these ten fixtures alone.

**Outstanding:** P1 Jobs [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) actual native authorization; P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) deterministic concurrent job admission; **P0 [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) privileged post-revocation GCS write denial / active-upload drain / safe ACK**; signed positive owner C6, protected Studio rendering and Replay and production release. **All HOLD.** No merge, production access, cloud billable compute, IAM, private media or user data was changed.
