# ONE URAI GENESIS — R946: full R879 source-pin closure and fail-fast acceptance review

**Date:** 2026-11-09 (America/Chicago). **Scope:** Source integrity, Jobs acceptance runner only. **Production decision:** **HOLD / NO-GO**.

## Executive result

Independent GitHub review of Jobs [#383](https://github.com/LifeLoggerAI/urai-jobs/pull/383) at immutable SHA `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` found **53 of 55** literal source blob pins in original `scripts/run-r879-unified-native-acceptance.sh` matched the repository's *complete, non-truncated 1,455-entry Git tree*. Two pins were stale after prior worker corrections to original long-form resume tests:

| File | Stale runner expectation | Actual immutable tree blob |
|---|---|---|
| `scripts/life-movies-longform-resume-transaction-contract.mjs` | `ef439bbe7a6a697ab04f2ebfc53b7e98d5466dd1` | `75d5e73151a3dd7b4726fe10251ebd63332bd165` |
| `scripts/r417-original-donor-longform-resume-transaction-contract.mjs` | `19969a9aa34fc19c0ebc520d39f4a368a8402a24` | `800834dcfb3db0ff5fdda54ecc83203d7a1a71a3` |

This source mismatch would fail the original fail-closed `check_blob` validation before the new 17-case Jobs test, making the specific *review candidate's* R879 acceptance **FAIL/HOLD** irrespective of current test execution. It does **not** mean the original resume test implementation was wrong or the production app had a new bug.

## Corrective review-only work

New child branch `review/chalk-r946-runner-source-pin-closure-20261109`, parent commit `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`. Preserves Jobs #383, #382, #381, and all other worker branches. Changed only **acceptance tooling and documentation**, not application/runtime source or production resources:

1. Corrected exactly the two source pins to the current known Git-tree blob IDs; no wildcard/skip/allowlist bypass was introduced.
2. Added `scripts/r946-r879-source-pin-preflight.mjs`, blob `73b69cb02c5708a2fa581dea965b5c3c55a449e2`, which parses all literal `check_blob` calls, checks the source paths against **the local immutable `git ls-tree -r --full-tree HEAD`** and fails on mismatch, missing path, duplicates, or no pins. It does **not** mutate files, auto-rewrite pins, or infer that real deployment corresponds to HEAD.
3. Added `scripts/r946-preflight.test.mjs`, exact Git blob `918260ac8ab90aecb5170673f14aeda094a767cc`, five native Node/Git fixture tests. The actual locally executed file was confirmed byte-identical by `git hash-object`.
4. Wired the preflight before expensive original R879 stages. Original R879 runner now pins both new exact blobs and runs a mandatory `r946_source_pin_preflight_5` stage with `# pass 5` assertion; the runner's existing native Firebase guard, source history checks, required env refusal, and production HOLD remain intact.

## Verifications actually executed

**Environment:** local container, Node v22.16.0, npm 10.9.2, Git 2.47.3, Java 21. No local pnpm 8.15.9 or complete GitHub checkout, no Firebase CLI/emulators, and `git ls-remote https://github.com/LifeLoggerAI/urai-jobs.git HEAD` returned `Could not resolve host: github.com` (network). Authenticated connected GitHub readback works. No production credentials, paid compute, private user media, customer jobs, or cloud mutations.

| Check | Evidence level | Result |
|---|---|---|
| Original PR #383 R879 literal pins against exact GitHub recursive tree | Authenticated complete Git-tree **static**, not native checkout | **FAIL: 53/55**, two mismatches, tree `truncated=false` |
| New exact original Node + Git local test file | Local **native** synthetic Git fixture tests, no Firebase | **PASS: 5/5**, zero failed/skipped, exit 0; TAP SHA256 `e99454d8b19e8b543867e242bf367a8727c3d2f3965f309bfc919ea137211fc2` |
| Independent rerun of exact original same five-case test and helper | Local native Git fixture | **PASS: 5/5**, exit 0; rerun TAP SHA256 `aaf82ec1034aac5a4ae6ef02c4d67a2b65ba46376f82` |
| New helper reconstructed locally / GitHub readback | Git blob identity | **PASS**, source blob `73b69cb02c5708a2fa581dea965b5c3c55a449e2` |
| Final corrected R879 entire source-pin inventory | Authenticated complete Git-tree static | **PASS: 57/57**, zero mismatches/duplicates, final candidate commit `3ec4a96b02b1b37193a8c9c34e1df9b0a1779168`; tree `truncated=false`, 1,457 entries |
| Full new R879 acceptance script at final candidate | Not executed / blocked | **NOT_RUN** (complete checkout/dependencies/emulators unavailable) |
| R942 original test isolated A/B | Previous independent R944 evidence, **NOT new independent certification** | R940 expected-red 13/14; R942 isolated source 17/17 PASS; full Jobs runner still NOT_RUN |

The static 57/57 check proves each literal pin is currently consistent with the candidate Git tree. It does **not** prove the full script is executable on the original environment, branch protection, Firebase Rules runtime, GCS IAM, positive owner consent, private Replay, or release approval.

## Exact reproducible next commands

On an *approved, credential-free and source-complete* runner (do not use production environment, billing or customer credentials):

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git
cd urai-jobs
git checkout --detach 3ec4a96b02b1b37193a8c9c34e1df9b0a1779168
test "$(git rev-parse HEAD)" = "3ec4a96b02b1b37193a8c9c34e1df9b0a1779168"
test -z "$(git status --porcelain --untracked-files=all)"
node --version
pnpm --version
node scripts/r946-r879-source-pin-preflight.mjs scripts/run-r879-unified-native-acceptance.sh
node --test scripts/r946-preflight.test.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
```

Only after full clean source and dependency acceptance, inspect and use the original R879 runner's deliberate `--run-exact-review-only`, `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY`, and `URAI_JOBS_ACCEPTANCE_SHA=<exact approved review SHA>` checks, with *no inherited cloud credentials*. Its original four Firebase emulators and Storage negative gates must run; this report does not invoke them.

## Critical blockers inherited

- P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): privileged post-revocation Storage future-write denial and active-upload drain, real data-plane alternate principal `403`, GCS exact-generation purge ACK.
- Positive signed Privacy C6 Life Movie consent authority deliberately hard-off; real owner-private Privacy→Studio→Jobs→MP4/SRT→Spatial Replay→revoke/delete acknowledgment **NOT_RUN**.
- Shared Firestore Rules publication collision and live effective Rules/IAM/Functions/Hosting parity and billing, protected Actions CI, independent reviewer and rollback unverified.
- Original 77-command Jobs root and exact four-emulator acceptance still **NOT_RUN** on this source. Tests enrolled are not tests executed.
- XR/mobile/desktop accessibility, full nine-state journey and Founder AAA+++ visual acceptance remain gated.

**Source-only repair/diagnostic is not a release authorization. No merges, production deploys, paid compute, IAM, private media, live GCS access, or owner data mutations. ONE URAI GENESIS = HOLD.**
