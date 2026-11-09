# ONE URAI GENESIS — R973 Studio→Jobs integration, source verification and release hold

**Date:** 2026-11-09  
**Release:** PRODUCTION HOLD / NO-GO  
**Type:** Actual review-only engineering change + cross-repo source refresh; not native acceptance or deployment.

## 1. New engineering PR

- Repository: LifeLoggerAI/urai-jobs
- PR #393: https://github.com/LifeLoggerAI/urai-jobs/pull/393
- Draft, unmerged; base: `review/chalk-r932-real-zod-studio-envelope-20261109`
- Base SHA: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- Head SHA at creation: `5fc1def0be77c75f7d9073efbeb41599d4dcd717`
- Branch: `review/chalk-r973-studio-producer-zod-enrollment-20261109`
- Changed only `package.json` and `scripts/run-r879-unified-native-acceptance.sh`.
- No source implementation, consent policy, worker runtime or deployed Firebase Rules changed.

### 1.1 Source-history reconciliation

The corrected test file `scripts/studio-life-movie-actual-producer-zod-contract.test.mjs` was already present at the exact #390 head, blob `74e94da0a118a043ab76af611474f3f73d329cea`. It is the same blob as #391. #391 itself diverges from #390 by 1 ahead / 2 behind. Therefore **do not merge #391 to recover the correction**; its corrected test is already present on the canonical parent.

### 1.2 Actual integration

Root `urai-jobs:verify` now enrolls once:

```sh
node --experimental-strip-types --test scripts/studio-life-movie-actual-producer-zod-contract.test.mjs
```

R879 adds a required stage:

```sh
stage studio_producer_jobs_zod_3_source 120s node --experimental-strip-types --test scripts/studio-life-movie-actual-producer-zod-contract.test.mjs
grep -q '# pass 3' "$OUT/studio_producer_jobs_zod_3_source.log" || hold 'Studio producer Jobs Zod three-case acceptance missing'
```

The R879 script also adds exact `check_blob` pins for the original test, Studio R931 producer fixture, synthetic input fixture, captured dispatch route source, actual Jobs strict Zod contract and Jobs hard-off consent gate. The root `package.json` pin is updated.

### 1.3 Exact readback

- package.json: `38c9bb6af14f2807656e19e333a7be5a0a992eff`
- R879 runner: `92e98f810ff82063bba907fc6c66d817c561cdbb`
- original producer Zod test: `74e94da0a118a043ab76af611474f3f73d329cea`
- Studio builder fixture: `701be51e861e0a5ff47d88ceaba1e3812433d659`
- Studio input: `535486ddc13d9419afdd72f155a33018b6562c4d`
- Studio captured route: `ef8e2bd124f7ea2da213d07fca3c5e82d80a056a`
- Jobs Zod contract: `5f944e906de7243d7415ac479cf92356b09c84c9`
- Jobs consent hard-off: `53761ac0f5c0340563b13fdd9a12a90e75409d42`

Readback inspection confirmed:
- root JSON parses;
- root command contains the exact test once;
- R879 contains the required stage once;
- 64 total `check_blob` pins;
- all seven targeted pins match exact Git blobs;
- required three-case `# pass 3` check is present.

**NOT EXECUTED:** Node test, Zod runtime, R946 offline Git pin preflight, R879, native Firebase emulator, CI, build/typecheck, provider integration, live private media. Static connector readback does not substitute for executable test evidence.

## 2. Refresh of critical review heads

| Candidate | Latest R973 head | Meaning |
|---|---|---|
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Actual producer Zod test source; new #393 base |
| Jobs #391 | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Diverged branch; corrected test already in #390 |
| Jobs #381 | `a295fd834c1cc01710a36b04523b023de2283240` | Corrected deletion-request Rules candidate |
| Jobs #383 | `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` | Rules + long-form test stack, unmerged |
| Privacy #257 | `fbdc590376376b758be968f174d71709f326c61f` | Advanced since R972; re-review before any execution |
| Labs #261 | `2980ca804fe04c37256a00af6e291a79a05004e4` | Shared Rules publisher detector |
| Labs #284 | `fd87082c7f9f0aec040f07fd217e826008d10d10` | Firebase source registry also advanced |

Privacy #257's new `functions/src/consent-api.ts` blob is `db8619c6d7fdf1309d5d89d7cfc8e77e346dbbf1`; new R27 boundary test blob `4ff5e6ca30a0152d22a05347f405b8c20ad2c8ed`. The test still asserts Life Movie purpose is not registered and the callable is denial-only. Do not use the older R972 Privacy #257 head `a3f711...` for new actions.

## 3. Safety and integration architecture

The Studio R931 builder's actual dispatch route source calls Jobs with `action`, `tenantId`, `userId`, `idempotencyKey` and `payload`, but no canonical `consent` object. Jobs strict Zod schema requires a Life Movie consent reference. A dummy shape-correct receipt must never authorize processing. Jobs `lifeMovieConsentAuthorityAvailable()` remains `false`; `deferLifeMovieJob()` blocks Life Movie jobs.

Privacy #257 deliberately does not register `life-movie.render`, issue a positive C6 grant, or enable render. Its verifier is denial-only. The R973 test enrollment therefore guards rejection of an unsafe or incomplete contract; it is **not a positive end-to-end Studio→Jobs integration**.

## 4. Remaining P0 and verification work

1. Run #393's three-case test on a clean exact-head checkout with Node 22 and actual Zod dependency; capture TAP, exit code and Git SHA. Then run R946 source-pin preflight, root verification and R879 native disposable-emulator suite. Review whether any other test/runner pin requires reconciliation. Do not claim pass until executed.
2. Native signed-in Auth/Firestore Rules emulator tests for Jobs #381/#383 deletion-request field add/change/remove, safe owner edits and server/Admin path.
3. Authorized read-only Firebase project/database/deployed Rules release/IAM inventory for shared `urai-4dc1d/(default)`; assign one Rules publisher. Admin main's broad Rules deployment capability remains unresolved.
4. Execute Privacy #257 current exact-head Vitest/typecheck/build and denial-only callable tests; keep C6 disabled pending Privacy/legal approval and actual issuer.
5. Preserve R647 dispatcher, Jobs #371 harness and R818/R836 callable test as separate acceptance tracks. Approve canonical revocation event/ACK semantics before implementation.
6. Jobs #252: durable monotonic GCS write fence, stale/alternate writer 403, in-flight upload drain, exact-generation purge and final downstream ACK.
7. Protected CI, independent non-author review, effective branch/rulesets, service identity/IAM, rollback, private Replay, accessibility/device/AAA visuals and explicit founder GO.

## 5. Next Chalk execution

Start from this report, R972 full reconciliation and machine checkpoint. Refresh #393/#390/#391/#381/#383, Privacy #257, Labs #261/#284, main refs and provider evidence. Prefer executing the new test on an immutable exact-head checkout and resolving any test failure without weakening the missing-consent rejection. Preserve source pins and write a new checkpoint. Do not merge, deploy, dispatch, enable C1/C6, touch customer media or mutate Rules/IAM during verification.

**PRODUCTION HOLD / NO-GO.**
