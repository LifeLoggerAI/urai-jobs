# ONE URAI GENESIS — exact-source engineering handoff (2026-11-06, Central)

**Mission:** Continue the real LifeLogger → LifeOS → One UrAi system already built since 2024. UrAi is the consumer experience; RuAi is the professional hub. Prove an owner-authorized, revocable, protected Life Movie inside the existing Home → Ascent → Life Map → Focus → Replay → Escape → Focus → Life Map → Home experience. **Do not collapse earlier built systems into “attempts.”**

**Status: GENESIS PRODUCTION HOLD.** This is a source-grounded handoff, *not* an authorization, deployment, or runtime receipt. All branches below are DRAFT and must be rechecked before working because parallel Chalk workers may advance them.

## 1. The most important newly verified result — Jobs + Studio

- **Jobs [PR #310](https://github.com/LifeLoggerAI/urai-jobs/pull/310)**, exact executed SHA `4755101eb1182ead9e89b5effcd91adef3e7b8aa`, Git tree `84565134a915670d0d3a463b6437dfa863bc2265`.
- **Studio [PR #179](https://github.com/LifeLoggerAI/urai-studio/pull/179)**, independently pinned SHA `153d6c35557c66a8b9f8629778ca796b83730464`.
- Existing Runpod CPU pod `otbikvulxafzdf` in disposable `demo-urai-jobs` completed and is **EXITED**. Exact source pins verified. Original Jobs `URAI_ACCEPTANCE_SHA=4755101e... bash scripts/run-four-emulator-acceptance.sh` passed, exit **0**. Original frozen pnpm 8.15.9 install, Node 22 full typecheck/build, Java 21 native Auth/Firestore/Functions/Storage, owner/foreign Storage denials, static owner Rules **13/13**, native owner Rules **29/29**, data rights, revocation, queue, idempotency, cancellation/outbox: PASS. Original FFmpeg generated **two fictional MP4s** and proved cancellation, timeout, cleanup and mid-render owner/tenant change denials. Real protected movie output writes remained **hard off**. Original standalone Studio→Jobs HTTP four-emulator script also passed, exit **0**, with 10 actual fail-closed assertions including authenticated consent gate **503**, no unauthorized jobs, no protected playback/download. The final observed receipt was `R823_FINAL_FULL_0_STUDIO_HTTP_0`.
- Immutable original stdout SHA256: Jobs four-emulator `fb6c0151b7f8b528bce3d4e07214f4bfd1972263a842593d0d19b6c419623035`, Studio HTTP `fe73745de5c4d2c727a56dbfde9deb924c1798fe461820443112ba75bb18358d`. These were container-local logs; stopping a pod can erase ephemeral files. The evidence is preserved as text on [Jobs PR #310](https://github.com/LifeLoggerAI/urai-jobs/pull/310#issuecomment-6699090051).
- Jobs [PR #309](https://github.com/LifeLoggerAI/urai-jobs/pull/309) SHA `8b47a1990770e08fe12f0ace47b11b13b81e7765` has **the same tree** as #310, but it is a distinct commit. Do not claim the #310 receipt formally executes #309. **Do not create yet another merge branch just because the parent order differs.**

## 2. Privacy, Spatial and current donor lines

| Workstream | Current pinned review head | Proven / remaining |
|---|---|---|
| **Privacy [#224](https://github.com/LifeLoggerAI/urai-privacy/pull/224)** | `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed` | True original Jobs→Privacy HTTP callable **denial** PASS in four Firebase emulators, using separate older Jobs source `14c7c0482833a915ed6b33da7836b536d4585f18` and an explicitly synthetic local RSA fixture. Fake service identity got **403**, no scoped C6 grant/job/queue. Not production-signed identity proof. [Evidence](https://github.com/LifeLoggerAI/urai-privacy/pull/224#issuecomment-6698918302). |
| **Privacy [#225](https://github.com/LifeLoggerAI/urai-privacy/pull/225)** | `03e48cbe8e1aaf25934b0e6cbf504552472f03bb` | R824 review-only C6 candidate grant issuer denies disabled/central-deletion-pending/malformed owner profiles. Added native Firestore transaction regressions. **Source committed, native R824 emulator test not executed.** Never expose test-only grant as production. |
| **Spatial [#2061](https://github.com/LifeLoggerAI/urai-spatial/pull/2061)** | `851402d3a355f4ba2ff7fb3dd8c65508c32def72` | R817 aligned four native Firestore Rules suites to demo project. Full original frozen build, native Auth/Firestore/Storage/Functions first-private-memory and protected Replay not proven on this exact head. |
| **Studio [#179](https://github.com/LifeLoggerAI/urai-studio/pull/179)** | `153d6c35557c66a8b9f8629778ca796b83730464` | Its genuine client was used against real Jobs Functions HTTP on Jobs #310. Earlier standalone loopback donor test alone was synthetic and must not be overstated. |
| **Jobs [#310](https://github.com/LifeLoggerAI/urai-jobs/pull/310)** | `4755101eb1182ead9e89b5effcd91adef3e7b8aa` | Original full source + all four emulators + actual synthetic FFmpeg + Studio HTTP negative integration **PASS** as described above. Positive rendering still **not** authorized. |

All source IDs are immutable. Verify PR heads before continuing. Never transfer results from historical heads to descendants without checking the exact tree, test scope and changed code.

## 3. Preserve earlier workers' implementations — do not recreate them

The Jobs #310 Git tree **already contains** original historical IAM/revocation assets, including:

- `scripts/review-only/studio-storage-iam-snapshot-audit.mjs` — from historical Jobs [#261](https://github.com/LifeLoggerAI/urai-jobs/pull/261). Read-only IAM analysis; never establishes live IAM grant.
- `scripts/review-only/life-movie-writer-fence-model.mjs`, `scripts/life-movie-writer-fence-race-model.test.mjs`, and `docs/security/R521_PRIVATE_LIFE_MOVIE_DURABLE_WRITE_FENCE_CONTRACT.md` — historical Jobs [#263](https://github.com/LifeLoggerAI/urai-jobs/pull/263) and [#264](https://github.com/LifeLoggerAI/urai-jobs/pull/264). **Review-only models** correctly distinguish fenced revocation from confirmed deletion ACK. The late-upload negative demo does **not** prove production GCS revocation.
- `docs/security/R526_PRIVATE_STORAGE_IAM_EVIDENCE_REVIEW.md`, `docs/security/R536_PRIVATE_IAM_EVIDENCE_COLLECTION.md`, `docs/security/R584_CLOUD_RUN_EXECUTION_IAM_EVIDENCE_HOLD.md` — follow historic worker identity, inherited role, effective bucket IAM and alternate principal checks. Treat historical broad objectAdmin roles as a blocker; do not run cloud IAM mutation without independent approval.
- `workers/studio-worker/private-output-write-authority.js` — deliberately returns **false**. Do not patch with a boolean/env bypass; a revocation-epoch/active-attempt-draining write broker, actual enforced cloud IAM, and old-writer/late-upload denial must be independently proved before enabling real private MP4 writes.
- Privacy [#192](https://github.com/LifeLoggerAI/urai-privacy/pull/192) contains earlier Privacy rights revocation → Jobs Storage derivative deletion emulator review; it was not a live-cloud write broker or protected Replay acceptance. Spatial [#2043](https://github.com/LifeLoggerAI/urai-spatial/pull/2043) contains native first-memory callable journey donor work; Spatial [#2033](https://github.com/LifeLoggerAI/urai-spatial/pull/2033) aligns granted memory C1 with Life Movie/Replay authorization.

**Important:** old review PR code may exist in the current tree, but that does not make the entire donor branch or all its tests release-executed. Check ancestry and original test inclusion before citing.

## 4. This handoff's narrow source change: hosted Jobs CI parity

Jobs #310 `.github/workflows/urai-jobs-runtime-ci.yml` callable E2E ran only `node scripts/urai-jobs-e2e.mjs` inside its actual four emulators, omitting `node --test scripts/user_authority_rules.firebase-emulator.test.mjs`. The standalone #310 Jobs acceptance *did* execute the original native Rules suite and got **29/29 PASS**, but an eventual green hosted CI must not be mistaken for the same coverage.

On this **R825 review branch**, the hosted CI emulator command now requires:
`node scripts/urai-jobs-e2e.mjs && node --test scripts/user_authority_rules.firebase-emulator.test.mjs`
inside the existing pinned `firebase-tools@15.24.0`, Auth/Firestore/Functions/Storage emulator invocation. It retains original exact checkout, 20-minute job timeout, log artifact upload and failure enforcement. No production logic or IAM change. **This new branch has no hosted CI success or original full runtime pass yet**; the R823 acceptance belongs to #310 original source.

Jobs/Privacy GitHub Actions have failed **before any steps** (Jobs run `42314642525`; Privacy R824 run `42316119453`, validate job `128229013260` has `steps:[]`). Do not interpret such runs as code failures. Original account 2FA/billing restriction support case `#4889576` remains a separate external obstacle. A connected GitHub API can push/review/rerun, not fix billing/2FA.

## 5. Next worker: do these actual release gates, in order

1. **Recheck all review heads and parallel workers first.** Do not duplicate #309/#310 identical trees, or lift HOLD on source similarity alone. Preserve exact SHA + timestamps + original logs and whether the result was source, native emulator, full build, physical device or production.
2. **Privacy R824 native four-service review-only issuer tests:** clean `03e48cbe8e1aaf25934b0e6cbf504552472f03bb`, Node22/Java21/frozen dependencies, original `test:life-movie:review:firestore:emulated`. Check duplicate transaction, disabled account vs profile, central deletion, malformed owner, source scope, audit atomicity, no real production consent. Do not spend on Runpod without cost authorization.
3. **Spatial R817 native release:** clean `851402d3a355f4ba2ff7fb3dd8c65508c32def72`; frozen deps/build, original `scripts/genesis-r799-exact-head-acceptance.sh` (inspect exact runner flags first), owner/foreign real C1 memory create/activate, private byte fixity, Focus/Replay hidden and post-revocation denial, four emulator Rules. Never claim IAM-positive playback from emulator-only tests.
4. **True positive scoped consent:** independently approved owner sign-in/active state; independently recorded notice, per-selected-source ownership/rights, tenant/project/scope hashes and current revocation epoch. Dedicated Jobs service identity signed and authenticated at Privacy. No caller-controlled consent booleans, copied test grants, unsigned emulator tokens or test-only `reviewOnlyEmulator` record may satisfy production authorization.
5. **Real protected output and playback:** design + review sole-writer revocation-safe GCS broker, enforce least privilege for all current/historic principals, active-upload drain, after-revocation late-write denial, generation-bound private derivatives, real owner-only protected Replay, delete/ACK reconciliation. Do not set `privateOutputWriteAuthorityAvailable()` true or make Jobs consent hard-off return true until independent staging tests and IAM approval support it.
6. **Full Genesis journey on devices:** Home → Ascent → Life Map → Focus → Replay → Escape → Focus → Life Map → Home, visual continuity, photo/audio decoding, XR/desktop/mobile, keyboard/screen-reader/blind haptics, reduced motion, PTSD/TBI-safe modes and protected media behavior. Record actual device/screenshots and user/independent acceptance.
7. **Final production gates:** restore protected frozen CI, independently approve security/privacy, production billing/services and rollback, protected staging and founder authorization. Preserve production **HOLD** until every required gate is demonstrated. Existing `urai-4dc1d` and other GCP billing notices require owner attention; never silently deploy or incur paid services.

### Worker operating discipline
No new paid pods or GPUs without explicit budget authority. If a parallel worker already has a running test, use read-only logs and avoid competing changes. Never save real personal memories into synthetic tests. Keep positive consent/render hard-off during review, and record every run's exact SHA, command, environment class, native tests, PASS/FAIL, negative-vs-positive scope, artifact digest and stopped resource status. Evidence is more important than another R-number.

**This handoff does not claim One UrAi shipped. The built estate is real; the remaining work is integrated authorization, private delivery, device proof and release authorization.**

## 6. Parallel-worker addendum: Spatial R818 actual build repair (discovered during R825 handoff)

A parallel worker has already advanced Spatial past the R817 source above. **Spatial [PR #2062](https://github.com/LifeLoggerAI/urai-spatial/pull/2062)** at exact SHA `ed6d92fe90bf2b640a0f571ae80cfb871329fd42` is a one-file source fix over R817 #2061. Actual frozen `pnpm install --frozen-lockfile` and the original Spatial R817 Functions build were attempted on an earlier Runpod pod; the build returned **exit 2**, `TS18048` due to possibly undefined `policy` and `c` in `apps/functions/src/lifeMovie.ts:324`. That is a **genuine code compile blocker**, not a CI pre-execution failure. #2062 explicitly denies missing C1 policy/consent and narrows their types; it does not relax consent. Earlier Functions build failure log SHA256 `59799849f03048de8cc7693017cc2c03aff64498e473d6ed6f1df4dc661b6bb0`.

An already-started parallel worker Runpod CPU pod `f8out0bg80mpnw` was **RUNNING** at this addendum: its live log verified Node22/pnpm10/Java21, clean pinned #2062 SHA `ed6d92fe90bf2b640a0f571ae80cfb871329fd42` and free disk pre-install. **No final result was yet observed**. Do not start a competing pod or stop theirs. Check its later logs and exact head before treating the new compiler fix as a pass; a source-pinned build, native Rules and full four-emulator acceptance remain required.

Jobs R825 hosted CI run `42317166262` failed with `Validate runtime` and `Callable emulator E2E` skipped; inspect job steps before calling this a source test failure. The new CI native-Rules enrollment is **committed but not executed successfully** on R825. Recheck all branches because these workers are actively working in parallel.

