# ONE URAI GENESIS — Jobs R952 required authentication regression gate and full next-worker handoff

**Checkpoint: 2026-11-09 UTC. PRODUCTION HOLD / NO-GO. Incremental spend: $0.** No paid tools, live cloud/Firebase/GCP metadata, production IAM/Rules, actual customer jobs/media, deployment, merge or CI bypass.

## 1. Recovered authority and exact source

- Master Genesis registry [Labs #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) entry `docs/estate/00_START_HERE.md`; master Jobs cross-chat [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304); complete Jobs R944–R951 source/cloud/security/test and historical handoffs [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379).
- Combined Jobs security review parent [#388](https://github.com/LifeLoggerAI/urai-jobs/pull/388), exact parent `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`. It is built on #387 Narrator Docker/auth regression, #386 manual rollback fail-close, #384 57/57 source-pin closure, #383 original Rules #381 + longform fixture #382. Preserve earlier independent branches, test receipts, SHA ancestry and failures.
- **This R952 candidate** is isolated `review/chalk-r952-auth-regression-release-gate-20261109`, initial exact source HEAD `1ee17f10e300e81833ef12226b12466a64257b1e` (refresh before running). Jobs main remains `9d29be1bcd3a45a4b9a743df9c9706c00811f38b` at inspection. No production authority or deployed identity is inferred from these source refs.

## 2. Justified missing verification enrollment — now source-fixed

R951 had narrowed the missing-bearer emulator bypass for four worker modules (Asset, Studio, Private Source and legacy Spatial) and introduced original source-reading test `scripts/r951-worker-emulator-auth-precedence.test.mjs`, Git blob `d27cc3880aa2ae0387f81bb660ca340d830e22dc`. Original worker source expressions enforce production/staging before `FUNCTIONS_EMULATOR=true`. However, **R951 had not enrolled the new original standalone test in the root `urai-jobs:verify` command or in the original guarded R879 native runner**. The earlier 48/48 isolated expression fixture does not rectify release gate omission.

R952 changes **only two existing verification files** (plus this additive handoff):
- `package.json`, previously blob `4804276332491e1e57a95a2a0cec7050df3a595c`, now exact Git blob **`bd50af6bead1c62f36ada6c012123fe0c5d94da7`**. Adds `node --test scripts/r951-worker-emulator-auth-precedence.test.mjs` **exactly once** after the existing `check-secure-worker-deploy.mjs` command in `urai-jobs:verify`. All original root commands and unrelated `security:worker-deploy` alias remain unchanged. **78 unique root command segments ENROLLED, NOT EXECUTED**.
- `scripts/run-r879-unified-native-acceptance.sh`, previously blob `145641d4de868945deadb577540571783bf74eab`, now exact Git blob **`8a42dcad4416d5896b4886d6c5bad079463d5324`**. Re-pins updated `package.json`, adds the exact original R951 test blob to `check_blob`, and adds the original Node `stage r951_worker_auth_emulator_precedence_4 120s node --test ...` plus `# pass 4` fail-closed assertion near existing R946 five-case stage, before expensive inherited emulator acceptance. **No original R879 production credential, project, clean-tree, Git-ancestor, CLI version, explicit `--run-exact-review-only` or negative P0 Storage guards removed.**
- Original worker implementation, Firestore/Storage Rules, Dockerfiles, Cloud Run, IAM, package dependency lock, private media and customer information are unchanged by R952.

## 3. Independent source-integrity readback and precisely scoped execution

After the two-file patch, read the exact GitHub branch SHA tree: `1ee17f10e300e81833ef12226b12466a64257b1e`, **1,463 tree entries, non-truncated**. Extracted every original R879 literal source pin and compared to matching Git tree entries: **58/58 exact Git blobs matched, zero mismatches**. The original root script parsed into **78 distinct command strings, zero duplicates**. Both new test stage and `# pass 4` requirement are present; test pin `d27cc3880aa2ae0387f81bb660ca340d830e22dc` and package pin `bd50af6bead1c62f36ada6c012123fe0c5d94da7` equal tree entries. This is **source metadata verification**, not end-to-end runtime success.

The original R951 isolated source-expression Node matrix previously ran 48 scenarios, and **was rerun in this R952 session** from existing `/mnt/data/jobs_r951_verify/source_expression_matrix.mjs`: Node22.16.0, exit 0, **48/48 PASS**, raw one-line log SHA256 `065252d57407c696a545961d59df7bd7bc09bb04815d1759e656884289e6b963`. It is the same source-excerpt/synthetic truth table, **not a fresh full original standalone test**, not forty-eight HTTP requests, and not Firebase/GCS proof. The complete original checked-in standalone Node test on a cloned full source tree is **NOT_RUN**, as are the root 78 commands, complete typecheck/build, Java/Firebase tools, four native disposable Firebase emulators, current GitHub protected CI, service revision/image HTTP auth and real provider IAM.

## 4. Exact-source cloud/resource gaps and release hold

- Firebase `.firebaserc` source declares alias `urai-jobs`; `firebase.json` declares Node22 Functions, Firestore/Storage Rules, Hosting site `urai-jobs-563121397472` and disposable emulator ports. None proves a live project, apps, Functions, Cloud Run revision, installed index, bucket/IAM, deployed Rules, Scheduler/PubSub/Tasks/Eventarc, App Check/Auth, logs, quotas or billing.
- Actual real Firebase/GCP resource inventory, deployed source SHA, effective principal/IAM/read-only revision receipt **UNKNOWN**. Connected GitHub Actions on parent #388 returned **9 completed failure workflows**, no authenticated clean protected CI pass.
- P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): real alternate/stale privileged GCS writer **403** after revocation, active upload drain, generation-pinned purge and durable downstream acknowledgement; private Studio consent and write-authority hard-offs remain intentionally active.
- P0 positive authenticated owner-issued C6 Privacy → Studio → Jobs protected private MP4/SRT → Spatial owner-only Replay → revocation/deletion/physical purge ACK **NOT_CERTIFIED**.
- P1 [Jobs #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission rights, [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Firestore user-binding Rules; P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) concurrent quota and index; protected CI, independent review, governed actual rollback and founder GO remain absent.

## 5. Immediate next-Chalk execution with zero paid credits

On an **already approved free, credential-free**, completely cloned immutable R952 Git source with Node22, pnpm8.15.9, Java21, frozen original lockfiles and installed original Firebase tooling:

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r952
cd jobs-r952
git checkout --detach <EXACT_CURRENT_REVIEWED_R952_40_CHAR_SHA>
test "$(git rev-parse HEAD)" = "<EXACT_CURRENT_REVIEWED_R952_40_CHAR_SHA>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version
pnpm --version
pnpm install --frozen-lockfile
node scripts/r946-r879-source-pin-preflight.mjs scripts/run-r879-unified-native-acceptance.sh
node --test scripts/r951-worker-emulator-auth-precedence.test.mjs
node scripts/check-secure-worker-deploy.mjs
pnpm urai-jobs:verify       # all 78 actual commands, NOT 78 tests previously passed
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

The guarded R879 original script requires explicit CLI flag, clean complete checkout, immutable Git SHA, exact source pins, no inherited production cloud credentials or bucket selectors, and disposable `urai-staging-test` and nested `demo-urai-jobs` identities. **Do not relax this to make tests green.** Capture individual command status, original complete TAP, SHA256 log, actual emulator 403/200 ID-token, role/owner/quota/revoke rules and test service identity. Separately verify actual authorized cloud metadata and Storage data-plane only when approved.

**No main merge, live deploy, unapproved billing, real media, IAM mutation, protected-CI bypass or release GO. ONE URAI GENESIS PRODUCTION HOLD.**
