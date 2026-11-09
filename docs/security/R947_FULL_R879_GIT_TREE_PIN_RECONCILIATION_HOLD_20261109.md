# ONE URAI GENESIS — R947 exact-tree Jobs R879 verification-pin repair

**Checkpoint:** 2026-11-09 UTC. **Production HOLD / NO-GO.** **New spending $0.**  
**Work type:** isolated original-source runner integrity repair and source-only verification. No active peer branches overwritten, no production deploy, IAM/Rules edits, real jobs, user media, emulator start or paid cloud access.

## Start here / origin

- Genesis master registry: [Labs #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262); permanent Jobs audit [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), master cross-chat [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).
- Immediately preceding source-integrated Jobs candidate: [#383](https://github.com/LifeLoggerAI/urai-jobs/pull/383), immutable parent commit `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`. It includes original protected owner Rules from [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) and original longform idempotency test blob from [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382), 77 unique root commands, exact donor test enrollment and guarded R879 stage. Not merged or certified.
- R946 predecessor: `docs/estate/JOBS_R946_LATEST_NEXT_CHALK_AND_EVIDENCE_RECONCILIATION_20261109.md` on Jobs #379.
- This R947 new isolated branch: `review/chalk-r947-r879-source-pin-safety-repair-20261109` from exact #383 head; first correction commit **`5e5ccf3d70c6ce0e05dd0c33760ad6f31e555ba0`**. The branch remains review-only.

## A. Two independently reproduced runner source-pin defects

The *unaltered* original R945 source at commit `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` has a full Git tree with **1,455 paths, 1,238 blobs, truncated=false**. The original `scripts/run-r879-unified-native-acceptance.sh` has **55 exact `check_blob` declarations**, but only **53/55** matched the tree.

| Original R879 line / file | Stale expected Git blob | Actual original file Git blob at R940, R943, R945 | Classification |
| --- | --- | --- | --- |
| 166 — `scripts/life-movies-longform-resume-transaction-contract.mjs` | `ef439bbe7a6a697ab04f2ebfc53b7e98d5466dd1` | `75d5e73151a3dd7b4726fe10251ebd63332bd165` | Source-pin stale — the runner's explicit guard would stop before emulator tests |
| 167 — `scripts/r417-original-donor-longform-resume-transaction-contract.mjs` | `19969a9aa34fc19c0ebc520d39f4a368a8402a24` | `800834dcfb3db0ff5fdda54ecc83203d7a1a71a3` | Source-pin stale — the runner's explicit guard would stop before emulator tests |

The actual two GitHub original source files were separately fetched at R940, R943 and R945. Their byte hashes were stable across these commits. The files are authentic review-source original donor tests; **do not restore earlier source merely to satisfy an obsolete pin**, weaken owner/org checks, or disable `check_blob`.

**Minimal committed patch:** replace only those two expected hashes in the original R879 runner. No changes to the two tests, runtime implementation, `functions/src`, Firestore/Storage Rules, worker, dependency manifest or lockfile.

## B. Independent current Git tree verification

After commit `5e5ccf3d70c6ce0e05dd0c33760ad6f31e555ba0`, GitHub file readback plus a fresh recursive exact SHA Git tree were checked using a 40-hex hash parser:

- **55 expected `check_blob` entries / 55 matching Git tree blobs / 0 mismatches**. The underlying tree is not truncated.
- `package.json` continues to contain **77 unique verification commands** including one original source-faithful 17-case longform idempotency test.
- `--run-exact-review-only` argument remains mandatory. `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY`, 40-character `URAI_JOBS_ACCEPTANCE_SHA`, clean full source checkout, Node22, pnpm8.15.9, no inherited live GCP credentials or forbidden project, and nested disposable emulator guards remain intact.
- The original source tests `scripts/life-movies-longform-resume-transaction-contract.mjs` and `scripts/r417-original-donor-longform-resume-transaction-contract.mjs` were **not executed in this R947 pass**; this verification is a direct match against exact Git object identities, not a Firebase or Node-test receipt.
- No source-authority changes to revoke/delete, no positive private output enabling and no real provider action occurred.

**Evidence level:** GitHub Git tree/readback and direct source hash comparisons **PASS**. Original 77-command root, R879 native four emulators, source deployment mapping, live GCS IAM 403, genuine C6 signed owner render/Replay/deletion and release gates **NOT_RUN / UNKNOWN**. Treat the previously inconsistent runner as a documented fixed preflight condition on this review branch only.

## C. Exact safe commands for independently approved, credential-free complete checkout

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r947
cd jobs-r947
git checkout --detach <EXACT_CURRENT_R947_HEAD_FROM_GITHUB>
test "$(git rev-parse HEAD)" = "<EXACT_CURRENT_R947_HEAD_FROM_GITHUB>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version                # Node22 required
pnpm --version                # pnpm 8.15.9 required
pnpm install --frozen-lockfile
node --test scripts/owner_authority_rules.static.test.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
node --test scripts/r417-original-donor-longform-resume-transaction-contract.mjs scripts/life-movies-longform-resume-transaction-contract.mjs
pnpm urai-jobs:verify         # actually execute all 77 commands
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

**REQUIRED:** Review and honor original R879 stop conditions, prohibit production credentials, use only disposable `urai-staging-test` / `demo-urai-jobs` emulators and stop on first failed source command or mismatched original source. Record all actual exit codes, test names, source SHA, full stdout/stderr log hashes, native emulator identities and signed ID-token negative status, without any real media.

**Before any certified release:** independently close [P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) actual GCS stale/alternate privileged writer deny/active upload drain and exact-generation deletion ACK; trust-proven owner C6 → Studio → Jobs → Spatial protected Replay → revoke/purge; [P1 #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission rights; [P1 #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Rules; source-to-live IAM/Rules revision; protected CI/reviewer and founder authorization. **PRODUCTION HOLD / NO-GO, no payment or deploy.**
