# R893 — Independent Jobs R891 branch convergence (HOLD / NO-GO)

**Scope:** review-only engineering integration of two *unmerged*, divergent R891 Jobs branches. No main merge, private render enablement, GCS/IAM deployment, secrets, paid compute or production modifications.

## Frozen provenance

- Source repo: `LifeLoggerAI/urai-jobs`
- Independent convergence commit: `e2b70b8c177557b915a26363ccc4e47266fa4f1c`
- Git tree: `e681358f24a3472386c7f592900d8547d4f699ca`
- **Two actual Git parents, ordered:** Jobs #369 `e2f22162fe0ff03b4da3ba85cca4d466f31a704e`; Jobs #368 `ebdf5f62338822f99b7293bdd5b9a0cda4917dd9`. Both original histories retained; neither branch rewritten.
- Original PR #369 (base) preserves Jobs-owned `jobsCreateRateLimit` deletion during governed Jobs-scope data-rights cleanup, retains `dataRightsDeletionPendingCentralPrivacy`, the request link and original `r888-quota-ledger-deletion-contract.test.mjs` and `r881-admin-callable-parser.test.mjs`.
- Original PR #368 contributes live current-owner, tenant and organization checks *inside the same transaction* before Life Movie cancellation mutates child jobs, plus its original `r890-cancel-authority-regression.test.mjs` and `r887-disposable-project-handoff.test.mjs`, original authority Rules static contract and safer nested emulator project clearing.

## Exact source reconciliation

The divergence was proven by independently fetching the entire Git trees: #368 = 1,223 blobs, #369 = 1,227 blobs; **19 paths had different/missing Git blob IDs**, including four high-risk code/verification areas. Direct GitHub comparison returned `diverged` (59 ahead, 31 behind for #369 relative to #368). Simply selecting the newest-numbered PR would lose the prior cancellation authority fix.

Convergence tree uses #369's checked original code as base, imports four **exact** #368 Git blobs and creates two reconciled text blobs:

| Path | Converged exact Git blob |
| --- | --- |
| `functions/src/jobs/studioLifeMovieLongformBridge.ts` | `888e9645e78d1bd723df883e0a73f042143f1e03` |
| `functions/src/privacy/dataRightsExecution.ts` | `756547684397788d8051acace70ac0e5c03e2e17` (unchanged from #369) |
| `scripts/r890-cancel-authority-regression.test.mjs` | `8ef3f1e799016eafd3f254f5fa2805f0e6ba2c18` |
| `scripts/r887-disposable-project-handoff.test.mjs` | `5d6aa48ab8111280f983f05821209c60b9a92299` |
| `scripts/owner_authority_rules.static.test.mjs` | `3c1dcedbdb5d988da32e85a8e06241bc0bda8bb2` |
| `package.json` | `37fe4b7de45547709eda9b26bfba02b8dbbd2443` |
| `scripts/run-r879-unified-native-acceptance.sh` | `1c518456804cc3b8905b032e9d3651573c05e6d3` |

Package `pnpm@8.15.9`. Original Jobs root verification retains **76 unique shell-joined verification commands**: both parents' original suites plus R890 cancellation and R887 nested project contract. No dependency changes. Native runner retains R854 revoked-Storage **negative** acceptance and nine-case physical-generation review; 14-concurrent Auth/Firestore/Functions/Storage positive admission demo runner stays opt-in and disposable only, with inherited `FIREBASE_PROJECT_ID` and `CLOUDSDK_CORE_PROJECT` cleared. Two additional source stages retain the #369 quota-deletion (6-case) and admin parser (2-case) assertions.

## Independently verified in this continuation

- Readback of the actual merged **two-parent** commit and untruncated tree: **1,229 tracked blobs**, immutable source `e2b70b8c177557b915a26363ccc4e47266fa4f1c`.
- Every one of the original acceptance runner's **53/53 Git blob source pins** matched the actual merged Git tree, no missing/mismatched pins. All 21 stage IDs unique. This is a **source integrity result**, not a native execution result.
- Independent **17/17 static source/wiring checks** of the actual merged Git files: owner read within cancel transaction before child reads; disabled/deletion/tenant/org checks; quota timestamp erasure while keeping central Privacy deletion fence and request binding; consent hard-off; enrollment of original cancellation, quota-deletion, nested emulator, parser and native checks; safer no-inherited-project behavior; unresolved P0 hard-off markers. All true at the recorded source.
- Separately reran prior R892 byte-matched offline subset on Node22.16: **10/10 original quota pure tests**, **7/7 independent consent hard-off tests**, combined zero exit and log SHA256 `551a7ab9d8484d848e0d25bf6c60b8af3b54bd13f868ec557cbe73dbe94f61eb`. These source files were unchanged at merge; these **do not certify** the combined native repository.
- Full repo clone unavailable: `git ls-remote https://github.com/LifeLoggerAI/urai-jobs.git HEAD` gave `Could not resolve host: github.com`. Local Node22.16, Java21, npm10.9, git2.47 are installed; pnpm 8.15.9, Firebase CLI and original dependencies are unavailable. Therefore `bash -n` against the complete merged runner, original full 76-command suite, workspace typecheck/build, four-emulator tests **NOT_RUN**.
- GitHub Actions available PR evidence may show failed, skipped or startup-failure jobs without executed steps/logs; no hosted success is inherited or claimed.

## Original authoritative verification recipe — NOT EXECUTED

In a disposable clean full checkout at exactly `e2b70b8c177557b915a26363ccc4e47266fa4f1c`, with reviewed Node22, pnpm8.15.9, Java21 and Firebase Tools15.24.0 (no cloud tokens or project credentials):

```bash
git rev-parse HEAD
git status --porcelain --untracked-files=all
bash -n scripts/run-r879-unified-native-acceptance.sh
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY \
URAI_JOBS_ACCEPTANCE_SHA=e2b70b8c177557b915a26363ccc4e47266fa4f1c \
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

Run only under a capable **isolated no-production-credential** runner. The original acceptance driver has strict prereqs, SHA guards, output receipts, per-stage log hashes and purposely demonstrates the privileged post-revoke Storage bypass. Successful local emulators **do not verify** production GCS IAM. Preserve original positive signed-C6 hard-off and private-movie output writer hard-off.

## Release blockers

**P0** Jobs #252: privileged retired/alternate GCS writer data-plane 403 and in-flight upload drain not independently demonstrated; true private output and owner-only Replay not certified. **P1** Jobs #337 scope/old operator claims, review. Production Firestore Rules publisher conflict, effective active Rules, verified signed positive C6, Jobs/Privacy/Studio/Replay real authorization + revocation/deletion, protected CI, rollback and physical-device/AAA+++ acceptance remain unresolved.

**No release GO.** This candidate is a review target only. Maintain the full system-wide Genesis HOLD.
